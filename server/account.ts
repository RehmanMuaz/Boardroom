import {Router,type Request} from 'express';
import {type Pool} from 'pg';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {HttpError} from './workspace-store';
import {hashToken,passwordHash,matches} from './security';
import {type Mailer} from './mail';
import {type Logger,errorCode} from './observability';
import {type RealtimeHooks} from './realtime';
export const emailInput=z.string().email().max(254).transform(v=>v.toLowerCase());
const password=z.string().min(12).max(128);
const credentials=z.object({email:emailInput,password}).strict();
const tokenInput=z.string().regex(/^[a-f0-9]{64}$/);
export type AccountOptions={origin:string;mailer?:Mailer;log:Logger;live:()=>RealtimeHooks|undefined};
export async function login(req:Request,id:string,version=0){
 await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
 req.session.userId=id;req.session.authVersion=version;req.session.csrf=randomBytes(32).toString('hex');
 await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
}
export function accountRouter(pool:Pool,options:AccountOptions){
 const router=Router();
 async function issue(userId:string,email:string,purpose:'verify'|'reset'){
  if(!options.mailer)throw new HttpError(503,'Email service is not configured');
  const token=randomBytes(32).toString('hex'),id=randomUUID();
  // Serialize issuance with consumption. Older links remain valid until used/expired.
  const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[userId]);
   await db.query('INSERT INTO account_tokens(id,user_id,purpose,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,userId,purpose,hashToken(token),new Date(Date.now()+(purpose==='reset'?3600000:86400000))]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  // URL fragments avoid leaking bearer tokens into proxy/access-log query strings.
  const link=options.origin+'/#'+(purpose==='reset'?'reset':'verify')+'='+token;
  try{await options.mailer.send({to:email,subject:purpose==='reset'?'Reset your Boardroom password':'Verify your Boardroom email',text:purpose==='reset'?`Reset your password using this one-use link (expires in 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`:`Verify your email using this one-use link (expires in 24 hours):\n${link}`});}
  catch(e){await pool.query('DELETE FROM account_tokens WHERE id=$1',[id]);options.log({event:'account_email_failed',level:'error',code:errorCode(e)});}
 }
 router.post('/register',async(req,res)=>{
  const body=credentials.parse(req.body),id=randomUUID();
  try{await pool.query('INSERT INTO accounts(id,email,password_hash) VALUES ($1,$2,$3)',[id,body.email,passwordHash(body.password)]);}catch(e){if((e as {code?:string}).code==='23505')throw new HttpError(409,'Email already registered');throw e;}
  await login(req,id);if(options.mailer)await issue(id,body.email,'verify');
  res.status(201).json({userId:id,csrf:req.session.csrf,emailVerified:false});
 });
 router.post('/login',async(req,res)=>{
  const body=credentials.parse(req.body),account=(await pool.query('SELECT * FROM accounts WHERE email=$1',[body.email])).rows[0];
  const correct=matches(body.password,account?.password_hash);if(!account||!correct)throw new HttpError(401,'Invalid email or password');
  await login(req,account.id,account.session_version);
  const current=(await pool.query('SELECT session_version FROM accounts WHERE id=$1',[account.id])).rows[0];
  if(!current||current.session_version!==account.session_version){await new Promise<void>((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));throw new HttpError(401,'Password changed. Sign in again.');}
  res.json({userId:account.id,csrf:req.session.csrf,emailVerified:Boolean(account.email_verified_at)});
 });
 router.post('/verification/request',async(req,res)=>{
  if(!req.session.userId)throw new HttpError(401,'Sign in required');
  z.object({}).strict().parse(req.body);const result=await pool.query('SELECT email,email_verified_at,session_version FROM accounts WHERE id=$1',[req.session.userId]);
  if(!result.rowCount||result.rows[0].session_version!==(req.session.authVersion??0))throw new HttpError(401,'Sign in required');if(!result.rows[0].email_verified_at)await issue(req.session.userId,result.rows[0].email,'verify');
  res.status(202).json({message:'If verification is needed, an email will be sent.'});
 });
 router.post('/reset/request',async(req,res)=>{
  if(!options.mailer)throw new HttpError(503,'Email service is not configured');
  const {email}=z.object({email:emailInput}).strict().parse(req.body),result=await pool.query('SELECT id FROM accounts WHERE email=$1',[email]);
  if(result.rowCount)await issue(result.rows[0].id,email,'reset');
  res.status(202).json({message:'If an account exists, a password reset email will be sent.'});
 });
 async function consume(token:string,purpose:'verify'|'reset',newPassword?:string){
  const db=await pool.connect();let revokedSessions:string[]=[];
  try{
   await db.query('BEGIN');const candidate=(await db.query('SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2',[hashToken(token),purpose])).rows[0];
   if(!candidate)throw new HttpError(400,'Link invalid, expired or already used');
   await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[candidate.user_id]);
   const row=(await db.query('SELECT * FROM account_tokens WHERE token_hash=$1 AND purpose=$2 FOR UPDATE',[hashToken(token),purpose])).rows[0];
   if(!row||row.used_at||new Date(row.expires_at).getTime()<=Date.now())throw new HttpError(400,'Link invalid, expired or already used');
   if(purpose==='verify')await db.query('UPDATE accounts SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1',[row.user_id]);
   else{
    await db.query('UPDATE accounts SET password_hash=$1,session_version=session_version+1 WHERE id=$2',[passwordHash(newPassword!),row.user_id]);
    const deleted=await db.query("DELETE FROM session WHERE sess->>'userId'=$1 RETURNING sid",[row.user_id]);revokedSessions=deleted.rows.map(r=>r.sid);
   }
   await db.query('UPDATE account_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL',[row.user_id,purpose]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  for(const sid of revokedSessions)options.live()?.logout(sid);
 }
 router.post('/verify',async(req,res)=>{const {token}=z.object({token:tokenInput}).strict().parse(req.body);await consume(token,'verify');res.json({message:'Email verified.'});});
 router.post('/reset',async(req,res)=>{const body=z.object({token:tokenInput,password}).strict().parse(req.body);await consume(body.token,'reset',body.password);res.clearCookie('connect.sid');res.json({message:'Password changed. Sign in with your new password.'});});
 return router;
}
