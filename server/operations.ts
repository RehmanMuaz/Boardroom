import {createHash} from 'node:crypto';
import {type Pool} from 'pg';
import {z} from 'zod';
import {applyChanges,OperationConflict} from '../src/operations';
import {type Workspace} from '../src/model';
import {validateAssetReferences} from './assets';
import {HttpError} from './workspace-store';

const value=z.json();
export const operationSchema=z.object({id:z.string().uuid(),baseRevision:z.number().int().nonnegative(),changes:z.array(z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128).optional(),annotationId:z.string().min(1).max(128).optional(),field:z.enum(['$board','$card','$annotation','$boardOrder','$cardOrder','$annotationOrder','title','parent','kind','x','y','text','color','target','width','height','assetId','columnId','captionVisible','richText','connectors','points','thickness','style','shape','fill','background','pattern']),before:value,after:value}).strict()).min(1).max(10000)}).strict();
export async function persistOperation(pool:Pool,workspaceId:string,userId:string,input:unknown){
 const operation=operationSchema.parse(input);
 const payloadHash=createHash('sha256').update(JSON.stringify(operation)).digest('hex');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const workspace=await db.query('SELECT snapshot,revision FROM team_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const membership=await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',[workspaceId,userId]);
  if(!workspace.rowCount||!membership.rowCount)throw new HttpError(404,'Workspace not found');
  if(membership.rows[0].role==='viewer')throw new HttpError(403,'Permission denied');
  const existing=await db.query('SELECT * FROM workspace_operations WHERE workspace_id=$1 AND operation_id=$2',[workspaceId,operation.id]);
  if(existing.rowCount){
   if(existing.rows[0].user_id!==userId||existing.rows[0].payload_hash!==payloadHash)throw new HttpError(409,'Operation ID already used for another payload');
   await db.query('COMMIT');return {operationId:operation.id,snapshot:workspace.rows[0].snapshot as Workspace,revision:workspace.rows[0].revision as number,duplicate:true};
  }
  if(operation.baseRevision>workspace.rows[0].revision)throw new HttpError(409,'Revision ahead of server');
  let snapshot:Workspace;
  try{snapshot=applyChanges(workspace.rows[0].snapshot,operation.changes);}catch(e){if(e instanceof OperationConflict)throw new HttpError(409,e.message);throw new HttpError(400,e instanceof Error?e.message:'Invalid operation');}
  await validateAssetReferences(db,workspaceId,snapshot);
  const revision=workspace.rows[0].revision+1;
  await db.query('UPDATE team_workspaces SET snapshot=$1,revision=$2 WHERE id=$3',[JSON.stringify(snapshot),revision,workspaceId]);
  await db.query('INSERT INTO workspace_operations(workspace_id,operation_id,user_id,payload_hash,revision) VALUES ($1,$2,$3,$4,$5)',[workspaceId,operation.id,userId,payloadHash,revision]);
  await db.query('COMMIT');return {operationId:operation.id,snapshot,revision,duplicate:false};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
