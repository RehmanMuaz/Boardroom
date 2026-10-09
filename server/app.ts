import express, {type Request, type Response, type NextFunction} from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import {type Pool, type PoolClient} from 'pg';
import {randomUUID, randomBytes} from 'node:crypto';
import {accountRouter,emailInput} from './account';
import {hashToken as hash} from './security';
import {authRateLimit} from './rate-limit';
import {logger,requestLog,errorCode,type Logger} from './observability';
import {type Mailer} from './mail';
import {z} from 'zod';
import {validWorkspace, seed, type Workspace} from '../src/model';
import {mutateWorkspace,HttpError} from './workspace-store';
import {deleteSelection} from '../src/features/canvas/domain';
import {assetRouter,AssetError} from './assets';
import {type RealtimeHooks} from './realtime';

declare module 'express-session' { interface SessionData { userId?: string; csrf?: string;authVersion?:number } }
const uuid=z.string().uuid();
export function createApp(pool:Pool, options:{secret:string; origin:string; secure?:boolean;assetRoot?:string;maxAssetBytes?:number;trustProxy?:string[];requireVerification?:boolean;mailer?:Mailer;log?:Logger;rateNamespace?:string;rateLimit?:number;staticRoot?:string;readyCheck?:()=>Promise<void>}) {
 const app=express();
 app.disable('x-powered-by');
 if(options.trustProxy?.length)app.set('trust proxy',options.trustProxy);
 const log=options.log??logger;app.locals.logger=log;app.locals.requireVerification=options.requireVerification;app.use(requestLog(log));
 app.get('/health/live',(_req,res)=>res.json({status:'ok'}));
 app.get('/health/ready',async(_req,res)=>{try{await pool.query('SELECT 1');await options.readyCheck?.();res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});
 app.use(express.json({limit:'2mb'}));
 const Store=connectPg(session);
 const sessionMiddleware=session({store:new Store({pool,pruneSessionInterval:false}),secret:options.secret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:options.secure??false,maxAge:7*86400000}});
 app.locals.sessionMiddleware=sessionMiddleware;app.use(sessionMiddleware);
 app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"});next();});
 const live=()=>app.locals.realtime as RealtimeHooks|undefined;
 app.use((req,res,next)=>{res.set('Cache-Control','no-store'); if(!['GET','HEAD','OPTIONS'].includes(req.method) && (req.get('origin')!==options.origin || !req.session.csrf || req.get('x-csrf-token')!==req.session.csrf))return res.status(403).json({error:'Invalid origin or CSRF token'});next();});
 app.get('/api/session',async(req,res)=>{req.session.csrf??=randomBytes(32).toString('hex');const account=req.session.userId?(await pool.query('SELECT email,email_verified_at,session_version FROM accounts WHERE id=$1',[req.session.userId])).rows[0]:null;const valid=account&&account.session_version===(req.session.authVersion??0);res.json({userId:valid?req.session.userId:null,csrf:req.session.csrf,email:valid?account.email:null,emailVerified:Boolean(valid&&account.email_verified_at),requireVerification:options.requireVerification??false,recoveryAvailable:Boolean(options.mailer)});});
 app.use('/api/auth',authRateLimit(pool,options.rateNamespace??'auth',options.rateLimit??20));
 app.use('/api/auth',accountRouter(pool,{origin:options.origin,mailer:options.mailer,log,live}));
 app.post('/api/logout',async(req,res)=>{const sessionId=req.sessionID;await new Promise<void>((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));live()?.logout(sessionId);res.clearCookie('connect.sid');res.sendStatus(204);});
 app.use('/api',async(req,res,next)=>{if(!req.session.userId)return res.status(401).json({error:'Sign in required'});const account=(await pool.query('SELECT email_verified_at,session_version FROM accounts WHERE id=$1',[req.session.userId])).rows[0];if(!account||account.session_version!==(req.session.authVersion??0))return res.status(401).json({error:'Sign in required'});if(options.requireVerification&&!account.email_verified_at)return res.status(403).json({error:'Verify your email before using team workspaces'});next();});
 app.use('/api/workspaces/:id/assets',assetRouter(pool,{root:options.assetRoot,maxBytes:options.maxAssetBytes}));
 async function membership(db:Pool|PoolClient,req:Request,id:string,write=false,owner=false){uuid.parse(id);const result=await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2'+(db===pool?'':' FOR SHARE'),[id,req.session.userId]);const role=result.rows[0]?.role;if(!role)throw new HttpError(404,'Workspace not found');if((write&&role==='viewer')||(owner&&role!=='owner'))throw new HttpError(403,'Permission denied');return role as 'owner'|'editor'|'viewer';}
 app.get('/api/workspaces',async(req,res)=>{const result=await pool.query('SELECT w.id,w.name,m.role FROM team_workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.name',[req.session.userId]);res.json(result.rows);});
 app.post('/api/workspaces',async(req,res)=>{const {name}=z.object({name:z.string().trim().min(1).max(120)}).strict().parse(req.body);const id=randomUUID();const db=await pool.connect();try{await db.query('BEGIN');await db.query('INSERT INTO team_workspaces(id,name,snapshot) VALUES ($1,$2,$3)',[id,name,JSON.stringify(seed)]);await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[id,req.session.userId,'owner']);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}res.status(201).json({id,name,role:'owner'});});
 app.get('/api/workspaces/:id',async(req,res)=>{const id=String(req.params.id);const role=await membership(pool,req,id);const result=await pool.query('SELECT snapshot,revision,name FROM team_workspaces WHERE id=$1',[id]);res.json({...result.rows[0],role});});
 app.put('/api/workspaces/:id',async(req,res)=>{
  const body=z.object({expectedRevision:z.number().int().nonnegative(),snapshot:z.unknown()}).strict().parse(req.body);
  if(!validWorkspace(body.snapshot))throw new HttpError(400,'Invalid workspace snapshot');
  const id=uuid.parse(req.params.id);
  const result=await mutateWorkspace(pool,id,body.expectedRevision,db=>membership(db,req,id,true),()=>body.snapshot as Workspace);
  await live()?.publish(id);res.json({revision:result.revision});
 });
 const boardInput=z.object({id:z.string().min(1).max(128),title:z.string().max(500),parent:z.string().min(1).max(128).optional()}).strict();
 const cardInput=z.object({id:z.string().min(1).max(128),kind:z.enum(['note','link','checklist','board','image','video','file','column']),x:z.number().min(0).max(100000),y:z.number().min(0).max(100000),text:z.string().max(100000),color:z.string().regex(/^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/),target:z.string().min(1).max(128).optional(),width:z.number().min(160).max(4000).optional(),height:z.number().min(100).max(10000).optional(),assetId:z.string().uuid().optional(),columnId:z.string().min(1).max(128).optional(),captionVisible:z.boolean().optional(),richText:z.unknown().optional()}).strict();
 const revision=z.number().int().nonnegative();
 async function boardSnapshot(req:Request){const id=uuid.parse(req.params.id);await membership(pool,req,id);return (await pool.query('SELECT snapshot,revision FROM team_workspaces WHERE id=$1',[id])).rows[0] as {snapshot:Workspace;revision:number};}
 function findBoard(snapshot:Workspace,id:string){const board=snapshot.boards.find(b=>b.id===id);if(!board)throw new HttpError(404,'Board not found');return board;}
 async function edit(req:Request,expectedRevision:number,mutate:(snapshot:Workspace)=>Workspace){const id=uuid.parse(req.params.id);const result=await mutateWorkspace(pool,id,expectedRevision,db=>membership(db,req,id,true),mutate);await live()?.publish(id);return result;}
 app.get('/api/workspaces/:id/boards',async(req,res)=>{const result=await boardSnapshot(req);res.json({boards:result.snapshot.boards,revision:result.revision});});
 app.get('/api/workspaces/:id/boards/:boardId',async(req,res)=>{const result=await boardSnapshot(req);res.json({board:findBoard(result.snapshot,String(req.params.boardId)),revision:result.revision});});
 app.post('/api/workspaces/:id/boards',async(req,res)=>{const body=z.object({expectedRevision:revision,board:boardInput}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>({...snapshot,boards:[...snapshot.boards,{...body.board,cards:[]}]}));res.status(201).json(result);});
 app.patch('/api/workspaces/:id/boards/:boardId',async(req,res)=>{const body=z.object({expectedRevision:revision,title:z.string().max(500)}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>{findBoard(snapshot,String(req.params.boardId)).title=body.title;return snapshot;});res.json(result);});
 app.delete('/api/workspaces/:id/boards/:boardId',async(req,res)=>{const body=z.object({expectedRevision:revision}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>{const id=String(req.params.boardId);findBoard(snapshot,id);if(snapshot.boards.some(b=>b.parent===id)||snapshot.boards.some(b=>b.cards.some(c=>c.target===id)))throw new HttpError(409,'Remove board references and child boards first');return {...snapshot,boards:snapshot.boards.filter(b=>b.id!==id)};});res.json(result);});
 app.post('/api/workspaces/:id/boards/:boardId/cards',async(req,res)=>{const body=z.object({expectedRevision:revision,card:cardInput}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>{findBoard(snapshot,String(req.params.boardId)).cards.push(body.card as import('../src/model').Card);return snapshot;});res.status(201).json(result);});
 app.patch('/api/workspaces/:id/boards/:boardId/cards/:cardId',async(req,res)=>{const body=z.object({expectedRevision:revision,patch:cardInput.omit({id:true}).partial()}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>{const board=findBoard(snapshot,String(req.params.boardId));const card=board.cards.find(c=>c.id===req.params.cardId);if(!card)throw new HttpError(404,'Card not found');Object.assign(card,body.patch);return snapshot;});res.json(result);});
 app.delete('/api/workspaces/:id/boards/:boardId/cards/:cardId',async(req,res)=>{const body=z.object({expectedRevision:revision}).strict().parse(req.body);const result=await edit(req,body.expectedRevision,snapshot=>{const board=findBoard(snapshot,String(req.params.boardId));if(!board.cards.some(c=>c.id===req.params.cardId))throw new HttpError(404,'Card not found');return deleteSelection(snapshot,String(req.params.boardId),[String(req.params.cardId)]);});res.json(result);});
 app.get('/api/workspaces/:id/members',async(req,res)=>{const id=String(req.params.id);await membership(pool,req,id,false,true);const result=await pool.query('SELECT a.id,a.email,m.role FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE m.workspace_id=$1',[id]);res.json(result.rows);});
 app.patch('/api/workspaces/:id/members/:userId',async(req,res)=>{const id=String(req.params.id),userId=uuid.parse(req.params.userId);const {role}=z.object({role:z.enum(['editor','viewer'])}).strict().parse(req.body);await membership(pool,req,id,false,true);const result=await pool.query("UPDATE memberships SET role=$1 WHERE workspace_id=$2 AND user_id=$3 AND role<>'owner' RETURNING user_id",[role,id,userId]);if(!result.rowCount)throw new HttpError(404,'Non-owner member not found');live()?.revoke(id,userId);res.sendStatus(204);});
 app.delete('/api/workspaces/:id/members/:userId',async(req,res)=>{const id=String(req.params.id),userId=uuid.parse(req.params.userId);await membership(pool,req,id,false,true);const result=await pool.query("DELETE FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",[id,userId]);if(!result.rowCount)throw new HttpError(404,'Non-owner member not found');live()?.revoke(id,userId);res.sendStatus(204);});
 app.post('/api/workspaces/:id/invitations',async(req,res)=>{
  const id=String(req.params.id);await membership(pool,req,id,false,true);
  const body=z.object({email:emailInput,role:z.enum(['editor','viewer'])}).strict().parse(req.body),token=randomBytes(32).toString('hex');
  await pool.query('INSERT INTO team_invitations(id,workspace_id,email,role,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6)',[randomUUID(),id,body.email,body.role,hash(token),new Date(Date.now()+48*3600000)]);
  let delivery:'sent'|'failed'|'manual'='manual';
  if(options.mailer){try{await options.mailer.send({to:body.email,subject:'You are invited to a Boardroom workspace',text:`Sign in or create an account with this email address, then accept your invitation (expires in 48 hours):\n${options.origin}/#invite=${token}`});delivery='sent';}catch(e){delivery='failed';log({event:'invitation_email_failed',level:'error',code:errorCode(e)});}}
  res.status(201).json({token,expiresInHours:48,delivery});
 });
 app.post('/api/invitations/accept',async(req,res)=>{const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);const db=await pool.connect();try{await db.query('BEGIN');const result=await db.query('SELECT * FROM team_invitations WHERE token_hash=$1 FOR UPDATE',[hash(token)]);const invite=result.rows[0];const user=await db.query('SELECT email FROM accounts WHERE id=$1',[req.session.userId]);if(!invite||invite.accepted_at||new Date(invite.expires_at).getTime()<=Date.now()||invite.email!==user.rows[0].email)throw new HttpError(400,'Invitation invalid, expired, used, or addressed to another account');await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[invite.workspace_id,req.session.userId,invite.role]);await db.query('UPDATE team_invitations SET accepted_at=$1 WHERE id=$2',[new Date(),invite.id]);await db.query('COMMIT');res.json({workspaceId:invite.workspace_id});}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}});
 if(options.staticRoot){app.use(express.static(options.staticRoot,{index:false}));app.get('/{*path}',(req,res,next)=>{if(req.path.startsWith('/api/')||req.path==='/api')return next();res.sendFile('index.html',{root:options.staticRoot});});}
 app.use((_req,res)=>res.status(404).json({error:'Not found'}));
 app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(res.headersSent)return _next(error);if(error instanceof z.ZodError)return res.status(400).json({error:'Invalid request',details:error.issues});if(error instanceof HttpError||error instanceof AssetError)return res.status(error.status).json({error:error.message});if((error as {type?:string})?.type==='entity.too.large')return res.status(413).json({error:'Request body exceeds 2 MB'});if(error instanceof SyntaxError)return res.status(400).json({error:'Invalid JSON'});log({event:'request_failed',level:'error',requestId:res.locals.requestId,code:errorCode(error)});res.status(500).json({error:'Internal server error'});});
 return app;
}
