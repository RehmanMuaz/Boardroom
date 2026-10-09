import express,{type Request,type RequestHandler} from 'express';
import {type Pool,type PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileTypeFromBuffer} from 'file-type';
import sharp from 'sharp';
import {z} from 'zod';
import {type Workspace} from '../src/model';

// Error has the same HTTP contract as workspace errors without a store dependency cycle.
export class AssetError extends Error{constructor(public status:number,message:string){super(message);}}
const imageMimes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const videoMimes=new Set(['video/mp4','video/webm']);
const fileMimes=new Set(['application/pdf','application/zip']);
export type Asset={id:string;name:string;mime:string;size_bytes:number};
export const assetKind=(mime:string)=>imageMimes.has(mime)?'image':videoMimes.has(mime)?'video':'file';
export async function validateAssetReferences(db:Pool|PoolClient,workspaceId:string,snapshot:Workspace){
 const cards=snapshot.boards.flatMap(b=>b.cards).filter(c=>c.assetId);
 if(!cards.length)return;
 const ids=[...new Set(cards.map(c=>c.assetId!))];
 const assets=await db.query('SELECT id,mime FROM team_assets WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[workspaceId,ids]);
 const byId=new Map<string,string>(assets.rows.map(row=>[row.id,row.mime]));
 for(const card of cards){const mime=byId.get(card.assetId!);if(!mime||assetKind(mime)!==card.kind)throw new AssetError(400,'Media must reference an existing asset of the correct type in this workspace');}
}
export function assetRouter(pool:Pool,options:{root?:string;maxBytes?:number}={}){
 const root=resolve(options.root??process.env.ASSET_DIR??'data/assets');
 const maximum=options.maxBytes??50*1024*1024;
 const router=express.Router({mergeParams:true});
 async function authorize(db:Pool|PoolClient,req:Request,write=false){
  const id=z.string().uuid().parse(req.params.id);
  const result=await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2'+(db===pool?'':' FOR SHARE'),[id,req.session.userId]);
  if(!result.rowCount)throw new AssetError(404,'Workspace not found');if(write&&result.rows[0].role==='viewer')throw new AssetError(403,'Permission denied');return id;
 }
 const mayUpload:RequestHandler=async(req,_res,next)=>{try{await authorize(pool,req,true);next();}catch(e){next(e);}};
 router.post('/',mayUpload,express.raw({type:'application/octet-stream',limit:maximum}),async(req,res)=>{
  const name=z.string().trim().min(1).max(255).regex(/^[^\x00-\x1f\x7f/\\]+$/).parse(req.query.name);
  if(!Buffer.isBuffer(req.body)||!req.body.length)throw new AssetError(400,'Upload nonempty bytes as application/octet-stream');
  const detected=await fileTypeFromBuffer(req.body).catch(()=>undefined);
  let mime=detected?.mime;
  if(!mime){const text=new TextDecoder('utf-8',{fatal:true});try{const content=text.decode(req.body);if(!/\x00/.test(content)&&/\.txt$/i.test(name))mime='text/plain';}catch{/* Unsupported binary type. */}}
  if(!mime||!imageMimes.has(mime)&&!videoMimes.has(mime)&&!fileMimes.has(mime)&&mime!=='text/plain')throw new AssetError(415,'Supported uploads: PNG, JPEG, WebP, GIF, MP4, WebM, PDF, ZIP, and plain .txt files');
  if(imageMimes.has(mime)){
   if(req.body.length>10*1024*1024)throw new AssetError(413,'Images are limited to 10 MB');
   try{await sharp(req.body,{limitInputPixels:40000000,failOn:'warning'}).stats();}catch{throw new AssetError(415,'Image cannot be decoded safely');}
  }
  const id=randomUUID(),path=join(root,id);await mkdir(root,{recursive:true});await writeFile(path,req.body,{flag:'wx'});
  const db=await pool.connect();
  try{await db.query('BEGIN');const workspaceId=await authorize(db,req,true);await db.query('INSERT INTO team_assets(id,workspace_id,uploaded_by,name,mime,size_bytes) VALUES ($1,$2,$3,$4,$5,$6)',[id,workspaceId,req.session.userId,name,mime,req.body.length]);await db.query('COMMIT');}
  catch(e){await db.query('ROLLBACK');await unlink(path).catch(()=>{});throw e;}finally{db.release();}
  res.status(201).json({id,name,mime,size_bytes:req.body.length,kind:assetKind(mime)});
 });
 router.get('/:assetId',async(req,res)=>{const workspaceId=await authorize(pool,req);const id=z.string().uuid().parse(req.params.assetId);const result=await pool.query('SELECT id,name,mime,size_bytes FROM team_assets WHERE workspace_id=$1 AND id=$2',[workspaceId,id]);if(!result.rowCount)throw new AssetError(404,'Asset not found');res.json(result.rows[0]);});
 router.get('/:assetId/content',async(req,res)=>{
  const workspaceId=await authorize(pool,req),id=z.string().uuid().parse(req.params.assetId);
  const result=await pool.query('SELECT id,name,mime,size_bytes FROM team_assets WHERE workspace_id=$1 AND id=$2',[workspaceId,id]);if(!result.rowCount)throw new AssetError(404,'Asset not found');
  const asset=result.rows[0] as Asset,path=join(root,id);let bytes:number;try{bytes=(await stat(path)).size;}catch{throw new AssetError(404,'Asset file missing');}
  const inline=(imageMimes.has(asset.mime)||videoMimes.has(asset.mime))&&req.query.download!=='1';
  const filename=encodeURIComponent(asset.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
  res.set({'Content-Type':asset.mime,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${filename}`,'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Accept-Ranges':'bytes'});
  let start=0,end=bytes-1;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||!match[1]&&!match[2]){res.set('Content-Range',`bytes */${bytes}`);res.sendStatus(416);return;}
   if(match[1]){start=Number(match[1]);if(match[2])end=Number(match[2]);}else start=Math.max(0,bytes-Number(match[2]));
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=bytes||end<start){res.set('Content-Range',`bytes */${bytes}`);res.sendStatus(416);return;}end=Math.min(end,bytes-1);res.status(206).set('Content-Range',`bytes ${start}-${end}/${bytes}`);
  }
  res.set('Content-Length',String(end-start+1));if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(path,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 });
 router.delete('/:assetId',async(req,res)=>{
  const workspaceId=z.string().uuid().parse((req.params as Record<string,string>).id),id=z.string().uuid().parse(req.params.assetId),db=await pool.connect();
  try{await db.query('BEGIN');const workspace=await db.query('SELECT snapshot FROM team_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);await authorize(db,req,true);
   if((workspace.rows[0].snapshot as Workspace).boards.some(b=>b.cards.some(c=>c.assetId===id)))throw new AssetError(409,'Asset is still used by a card');
   const result=await db.query('DELETE FROM team_assets WHERE workspace_id=$1 AND id=$2 RETURNING id',[workspaceId,id]);if(!result.rowCount)throw new AssetError(404,'Asset not found');await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  await unlink(join(root,id)).catch(()=>{});res.sendStatus(204);
 });
 return router;
}
