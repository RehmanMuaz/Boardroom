import express,{type Express,type Request,type Response,type NextFunction} from 'express';
import {type Pool} from 'pg';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {hashToken} from './server/security';
import {validWorkspace,type Workspace} from './src/model';
import {HttpError} from './server/workspace-store';
import {requestLog,errorCode,type Logger} from './server/observability';

export type FlowSettings={tokenHash:string;email:string;origin:string;requireVerification?:boolean};
export function flowSettings(env:NodeJS.ProcessEnv,origin:string,requireVerification=false):FlowSettings|undefined{
 if(!env.FLOW_IMPORT_TOKEN_SHA256)return undefined;
 if(!/^[a-f0-9]{64}$/.test(env.FLOW_IMPORT_TOKEN_SHA256))throw Error('FLOW_IMPORT_TOKEN_SHA256 requires a SHA256 hex digest');
 const email=z.string().email().parse(env.FLOW_IMPORT_EMAIL??'muazrehman@vertexfilms.ca').toLowerCase();
 return {tokenHash:env.FLOW_IMPORT_TOKEN_SHA256,email,origin,requireVerification};
}
export async function migrateFlow(pool:Pool){await pool.query(`CREATE TABLE IF NOT EXISTS flow_imports (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, payload_hash text NOT NULL, name text NOT NULL, snapshot jsonb NOT NULL,
 expires_at timestamptz NOT NULL, workspace_id uuid REFERENCES team_workspaces(id), UNIQUE(user_id,request_id))`);}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function withFlow(base:Express,pool:Pool,settings?:FlowSettings):Express{
 if(!settings)return base;
 const app=express();app.disable('x-powered-by');app.locals=base.locals;app.set('trust proxy',base.get('trust proxy'));
 if(base.locals.logger){app.use(['/api/flow','/flow-review'],requestLog(base.locals.logger as Logger));}
 app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});next();});
 app.post('/api/flow/previews',async(req,res,next)=>{
  try{
   const token=req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token||!timingSafeEqual(Buffer.from(hashToken(token),'hex'),Buffer.from(settings.tokenHash,'hex')))throw new HttpError(401,'Invalid integration credential');
   next();
  }catch(e){next(e);}
 },express.json({limit:'1500kb'}),async(req,res)=>{
  const body=z.object({requestId:z.string().uuid(),name:z.string().trim().min(1).max(120),snapshot:z.unknown()}).strict().parse(req.body);
  if(!validWorkspace(body.snapshot))throw new HttpError(400,'Invalid workspace');
  if((body.snapshot as Workspace).boards.some(b=>b.cards.some(c=>['image','video','file'].includes(c.kind))))throw new HttpError(400,'Portable imports cannot reference private assets');
  const payloadHash=hashToken(JSON.stringify({name:body.name,snapshot:body.snapshot}));
  const db=await pool.connect();let result;
  try{await db.query('BEGIN');
   const user=(await db.query('SELECT id,email_verified_at FROM accounts WHERE email=$1 FOR SHARE',[settings.email])).rows[0];
   if(!user||settings.requireVerification&&!user.email_verified_at)throw new HttpError(403,'Configured account unavailable or unverified');
   // One actor lock serializes repeated requests and bounds pending payload storage.
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[user.id]);
   await db.query('DELETE FROM flow_imports WHERE expires_at < now() AND workspace_id IS NULL AND user_id=$1',[user.id]);
   const existing=(await db.query('SELECT * FROM flow_imports WHERE user_id=$1 AND request_id=$2',[user.id,body.requestId])).rows[0];
   if(existing){if(existing.payload_hash!==payloadHash)throw new HttpError(409,'Request ID already used for different content');result=existing;}
   else{
    if(Number((await db.query('SELECT count(*) FROM flow_imports WHERE user_id=$1 AND workspace_id IS NULL',[user.id])).rows[0].count)>=20)throw new HttpError(429,'Too many pending imports; review or wait for expiry');
    result=(await db.query('INSERT INTO flow_imports(id,user_id,request_id,payload_hash,name,snapshot,expires_at) VALUES ($1,$2,$3,$4,$5,$6,now()+interval \'10 minutes\') RETURNING *',[randomUUID(),user.id,body.requestId,payloadHash,body.name,JSON.stringify(body.snapshot)])).rows[0];
   }await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  res.status(201).json({status:result.workspace_id?'created':'awaiting_account_approval',reviewUrl:settings.origin+'/flow-review/'+result.id,workspaceId:result.workspace_id??null,expiresAt:result.expires_at,account:settings.email});
 });
 app.use('/flow-review',base.locals.sessionMiddleware);
 app.use('/flow-review',express.urlencoded({extended:false,limit:'2kb'}));
 async function actor(req:Request){
  if(!req.session.userId)throw new HttpError(401,'Sign in to Boardroom, then reopen this review link');
  const account=(await pool.query('SELECT email,email_verified_at,session_version FROM accounts WHERE id=$1',[req.session.userId])).rows[0];
  if(!account||account.session_version!==(req.session.authVersion??0))throw new HttpError(401,'Sign in again');
  if(account.email!==settings!.email||settings!.requireVerification&&!account.email_verified_at)throw new HttpError(403,'This import belongs to the configured verified account');
  return req.session.userId;
 }
 app.get('/flow-review/:id',async(req,res)=>{
  const userId=await actor(req),id=z.string().uuid().parse(req.params.id);
  const item=(await pool.query('SELECT * FROM flow_imports WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];
  if(!item)throw new HttpError(404,'Import not found');
  if(!item.workspace_id&&new Date(item.expires_at).getTime()<=Date.now())throw new HttpError(410,'Preview expired; prepare again');
  req.session.csrf??=randomBytes(32).toString('hex');
  const snapshot=(item.workspace_id?{version:1,boards:[]}:item.snapshot) as Workspace;
  const content=snapshot.boards.map(b=>'<h2>'+escape(b.title)+'</h2>'+b.cards.map(c=>'<pre>'+escape(c.text)+'</pre>').join('')+(b.annotations??[]).filter(a=>a.kind==='text').map(a=>'<p>'+escape(a.kind==='text'?a.text:'')+'</p>').join('')).join('');
  res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Review Flow board</title><main><h1>'+escape(item.name)+'</h1><p>Account: '+escape(settings.email)+'. Creates a new workspace; existing boards are preserved.</p>'+ (item.workspace_id?'<p>Workspace created. <a href="/">Open Boardroom and select '+escape(item.name)+'</a>.</p>':'<form method="post"><input type="hidden" name="csrf" value="'+escape(req.session.csrf)+'"><button type="submit">Create workspace in my account</button></form>')+'<details><summary>Review all board content</summary>'+content+'</details></main></html>');
 });
 app.post('/flow-review/:id',async(req,res)=>{
  const userId=await actor(req),id=z.string().uuid().parse(req.params.id);
  if(req.get('origin')!==settings.origin||!req.session.csrf||req.body?.csrf!==req.session.csrf)throw new HttpError(403,'Invalid origin or CSRF token');
  const db=await pool.connect();
  try{await db.query('BEGIN');
   const account=(await db.query('SELECT email,email_verified_at,session_version FROM accounts WHERE id=$1 FOR SHARE',[userId])).rows[0];
   if(!account||account.email!==settings.email||account.session_version!==(req.session.authVersion??0)||settings.requireVerification&&!account.email_verified_at)throw new HttpError(403,'Account authorization changed');
   const item=(await db.query('SELECT * FROM flow_imports WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0];
   if(!item)throw new HttpError(404,'Import not found');
   if(!item.workspace_id){
    if(new Date(item.expires_at).getTime()<=Date.now())throw new HttpError(410,'Preview expired; prepare again');
    const workspaceId=randomUUID();
    await db.query('INSERT INTO team_workspaces(id,name,snapshot) VALUES ($1,$2,$3)',[workspaceId,item.name,JSON.stringify(item.snapshot)]);
    await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,\'owner\')',[workspaceId,userId]);
    // Keep only deduplication metadata once approved; the workspace owns the content.
    await db.query('UPDATE flow_imports SET workspace_id=$1,snapshot=\'{}\'::jsonb WHERE id=$2',[workspaceId,id]);
   }await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  res.redirect(303,'/');
 });
 app.use(base);
 app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(error instanceof HttpError)return res.status(error.status).json({error:error.message});
  if(error instanceof z.ZodError||error instanceof SyntaxError)return res.status(400).json({error:'Invalid import request'});
  if((error as {type?:string}).type==='entity.too.large')return res.status(413).json({error:'Import too large'});
  (base.locals.logger as Logger|undefined)?.({event:'flow_import_failed',level:'error',code:errorCode(error)});
  res.status(500).json({error:'Import unavailable'});
 });
 return app;
}
