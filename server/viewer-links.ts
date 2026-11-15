import express,{type Request} from 'express';
import {randomUUID,randomBytes} from 'node:crypto';
import {type Pool,type PoolClient} from 'pg';
import {z} from 'zod';
import {hashToken} from './security';
import {HttpError} from './workspace-store';
import {assetRouter} from './assets';
import {type Mailer} from './mail';
import {type Workspace} from '../src/model';
declare module 'express-session'{interface SessionData{viewerGrants?:string[]}}
const uuid=z.string().uuid();
const activeSQL="SELECT l.id,l.workspace_id,w.name,w.snapshot,w.revision FROM workspace_viewer_links l JOIN team_workspaces w ON w.id=l.workspace_id WHERE l.revoked_at IS NULL AND l.expires_at>now() AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=l.workspace_id AND m.user_id=l.created_by AND m.role='owner')";
export function publicViewerRouter(pool:Pool,assetRoot?:string){
 const router=express.Router();
 async function grant(req:Request){const id=uuid.parse(req.params.linkId);if(!req.session.viewerGrants?.includes(id))throw new HttpError(404,'Viewer link unavailable. Open the original email link.');const result=await pool.query(activeSQL+' AND l.id=$1',[id]);if(!result.rowCount)throw new HttpError(404,'Viewer link expired or revoked.');return result.rows[0] as {id:string;workspace_id:string;name:string;snapshot:Workspace;revision:number};}
 router.post('/open',async(req,res)=>{const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);const result=await pool.query(activeSQL+' AND l.token_hash=$1',[hashToken(token)]);if(!result.rowCount)throw new HttpError(404,'Viewer link invalid, expired or revoked.');const link=result.rows[0];req.session.viewerGrants=[...(req.session.viewerGrants??[]).filter(id=>id!==link.id).slice(-9),link.id];await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));res.json({linkId:link.id});});
 router.get('/:linkId/workspace',async(req,res)=>{const link=await grant(req);res.json({id:link.workspace_id,name:link.name,snapshot:link.snapshot,revision:link.revision,role:'viewer'});});
 router.use('/:linkId/assets',(req,res,next)=>{if(!['GET','HEAD'].includes(req.method)){res.status(403).json({error:'Shared links are read-only'});return;}next();},assetRouter(pool,{root:assetRoot,authorizeRead:async req=>{const link=await grant(req);const id=uuid.parse(req.params.assetId);if(!link.snapshot.boards.some(b=>b.cards.some(c=>c.assetId===id)))throw new HttpError(404,'Asset not shared');return link.workspace_id;}}));
 return router;
}
export function viewerLinkRouter(pool:Pool,{origin,mailer}:{origin:string;mailer?:Mailer}){
 const router=express.Router({mergeParams:true});
 async function owner(db:Pool|PoolClient,req:Request){const id=uuid.parse(req.params.id);const result=await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2'+(db===pool?'':' FOR SHARE'),[id,req.session.userId]);if(!result.rowCount)throw new HttpError(404,'Workspace not found');if(result.rows[0].role!=='owner')throw new HttpError(403,'Only owners can manage viewer links');return id;}
 router.get('/',async(req,res)=>{const id=await owner(pool,req);res.json((await pool.query('SELECT id,email,expires_at,revoked_at,created_at FROM workspace_viewer_links WHERE workspace_id=$1 ORDER BY (revoked_at IS NULL AND expires_at>now()) DESC,created_at DESC LIMIT 100',[id])).rows);});
 router.post('/',async(req,res)=>{
  const {email,days}=z.object({email:z.string().trim().email().max(254).optional(),days:z.number().int().min(1).max(30).default(7)}).strict().parse(req.body),id=randomUUID(),token=randomBytes(32).toString('hex'),db=await pool.connect();let workspaceId='';
  try{await db.query('BEGIN');await db.query('SELECT id FROM team_workspaces WHERE id=$1 FOR UPDATE',[uuid.parse((req.params as Record<string,string>).id)]);workspaceId=await owner(db,req);const count=await db.query('SELECT count(*) FROM workspace_viewer_links WHERE workspace_id=$1 AND revoked_at IS NULL AND expires_at>now()',[workspaceId]);if(Number(count.rows[0].count)>=100)throw new HttpError(409,'Revoke an existing viewer link before creating another');await db.query("INSERT INTO workspace_viewer_links(id,workspace_id,created_by,token_hash,email,expires_at) VALUES ($1,$2,$3,$4,$5,now()+$6*interval '1 day')",[id,workspaceId,req.session.userId,hashToken(token),email?.toLowerCase()??null,days]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  const url=origin+'/#viewer='+token;let delivery='manual';if(email&&mailer){try{await mailer.send({to:email,subject:'View a shared Boardroom workspace',text:`You have been sent read-only access to a Boardroom workspace. Anyone with this link can view and download its content for ${days} days, unless the owner revokes it. No account is needed.\n\n${url}`});delivery='sent';}catch{delivery='failed';}}
  res.status(201).json({id,url,delivery});
 });
 router.delete('/:linkId',async(req,res)=>{const id=await owner(pool,req),linkId=uuid.parse(req.params.linkId);const result=await pool.query('UPDATE workspace_viewer_links SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND workspace_id=$2 RETURNING id',[linkId,id]);if(!result.rowCount)throw new HttpError(404,'Viewer link not found');res.sendStatus(204);});
 return router;
}
