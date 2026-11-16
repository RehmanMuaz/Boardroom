import {randomUUID} from 'node:crypto';
import {type Pool,type PoolClient} from 'pg';
import {type FlowSettings} from './flow-integration';
import {operationSchema} from './operations';
import {hashToken} from './security';
import {applyChanges,OperationConflict,same} from '../src/operations';
import {type Workspace} from '../src/model';
import {validateAssetReferences,AssetError} from './assets';
import {HttpError} from './workspace-store';

type Actor={id:string;version:number};
// PostgreSQL JSONB reorders object keys; approval hashes must survive that
// roundtrip while still detecting any changed value, including nested styles.
export function flowEditHash(value:unknown){
 return hashToken(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item));
}
function scope(settings:FlowSettings,id:string){if(!settings.workspaceIds?.includes(id))throw new HttpError(404,'Workspace not found');}
async function context(db:PoolClient,settings:FlowSettings,id:string,actor?:Actor){
 scope(settings,id);
 const workspace=(await db.query('SELECT name,snapshot,revision FROM team_workspaces WHERE id=$1 FOR UPDATE',[id])).rows[0];
 const user=(await db.query('SELECT id,email_verified_at,session_version FROM accounts WHERE email=$1 FOR SHARE',[settings.email])).rows[0];
 if(!workspace||!user||settings.requireVerification&&!user.email_verified_at)throw new HttpError(403,'Workspace account unavailable');
 if(actor&&(user.id!==actor.id||user.session_version!==actor.version))throw new HttpError(403,'Account authorization changed');
 const member=(await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',[id,user.id])).rows[0];
 if(!member||member.role==='viewer')throw new HttpError(403,'Current edit permission required');
 return {workspace,user,role:member.role as string};
}
async function validate(db:PoolClient,id:string,snapshot:Workspace,role:string,operation:ReturnType<typeof operationSchema.parse>,revision:number){
 if(operation.changes.length>100)throw new HttpError(400,'At most 100 changes are allowed');
 if(operation.baseRevision!==revision)throw new HttpError(409,'Workspace changed. Read it again and prepare a new review.');
 let proposed:Workspace;
 try{proposed=applyChanges(snapshot,operation.changes);}catch(error){
  if(error instanceof OperationConflict)throw new HttpError(409,'An edited field changed. Prepare a new review.');
  throw new HttpError(400,'Changes produce an invalid workspace');
 }
 if(role!=='owner'&&!same(snapshot.workspaceStyle,proposed.workspaceStyle))throw new HttpError(403,'Only owners can manage workspace styles');
 try{await validateAssetReferences(db,id,proposed);}catch(error){if(error instanceof AssetError)throw new HttpError(error.status,error.message);throw error;}
 return proposed;
}

export async function stageFlowEdit(pool:Pool,settings:FlowSettings,workspaceId:string,input:unknown){
 const operation=operationSchema.parse(input),payloadHash=flowEditHash(operation);
 scope(settings,workspaceId);
 const db=await pool.connect();
 try{await db.query('BEGIN');
  const {workspace,user,role}=await context(db,settings,workspaceId);
  // One actor lock bounds pending proposals across all configured workspaces.
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[user.id]);
  const existing=(await db.query('SELECT * FROM flow_edits WHERE user_id=$1 AND workspace_id=$2 AND request_id=$3',[user.id,workspaceId,operation.id])).rows[0];
  if(existing){
   if(existing.payload_hash!==payloadHash)throw new HttpError(409,'Request ID already used for different changes');
   if(existing.applied_revision===null&&new Date(existing.expires_at).getTime()<=Date.now())throw new HttpError(410,'Review expired. Prepare a new review.');
   await db.query('COMMIT');return existing;
  }
  await validate(db,workspaceId,workspace.snapshot,role,operation,workspace.revision);
  await db.query('DELETE FROM flow_edits WHERE user_id=$1 AND applied_revision IS NULL AND expires_at < now()',[user.id]);
  if(Number((await db.query('SELECT count(*) FROM flow_edits WHERE user_id=$1 AND applied_revision IS NULL',[user.id])).rows[0].count)>=20)throw new HttpError(429,'Too many pending edit reviews');
  const item=(await db.query('INSERT INTO flow_edits(id,user_id,workspace_id,request_id,payload_hash,operation,expires_at) VALUES ($1,$2,$3,$4,$5,$6,now()+interval \'10 minutes\') RETURNING *',[randomUUID(),user.id,workspaceId,operation.id,payloadHash,JSON.stringify(operation)])).rows[0];
  await db.query('COMMIT');return item;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}

export async function approveFlowEdit(pool:Pool,settings:FlowSettings,id:string,actor:Actor){
 const db=await pool.connect();
 try{await db.query('BEGIN');
  // Read identity first; lock the workspace before the intent, matching other writers.
  const identity=(await db.query('SELECT workspace_id FROM flow_edits WHERE id=$1 AND user_id=$2',[id,actor.id])).rows[0];
  if(!identity)throw new HttpError(404,'Edit review not found');
  const {workspace,user,role}=await context(db,settings,identity.workspace_id,actor);
  const item=(await db.query('SELECT * FROM flow_edits WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,user.id])).rows[0];
  if(!item)throw new HttpError(404,'Edit review not found');
  if(item.applied_revision!==null){await db.query('COMMIT');return {workspaceId:item.workspace_id,operationId:item.request_id,revision:item.applied_revision,duplicate:true};}
  if(new Date(item.expires_at).getTime()<=Date.now())throw new HttpError(410,'Review expired. Prepare a new review.');
  const operation=operationSchema.parse(item.operation);
  if(flowEditHash(operation)!==item.payload_hash)throw new HttpError(409,'Review content changed');
  const snapshot=await validate(db,item.workspace_id,workspace.snapshot,role,operation,workspace.revision);
  const used=(await db.query('SELECT operation_id FROM workspace_operations WHERE workspace_id=$1 AND operation_id=$2',[item.workspace_id,operation.id])).rowCount;
  if(used)throw new HttpError(409,'Operation ID already used; prepare a new review');
  const revision=workspace.revision+1;
  await db.query('UPDATE team_workspaces SET snapshot=$1,revision=$2 WHERE id=$3',[JSON.stringify(snapshot),revision,item.workspace_id]);
  await db.query('INSERT INTO workspace_operations(workspace_id,operation_id,user_id,payload_hash,revision) VALUES ($1,$2,$3,$4,$5)',[item.workspace_id,operation.id,user.id,hashToken(JSON.stringify(operation)),revision]);
  await db.query('UPDATE flow_edits SET applied_revision=$1,applied_at=now() WHERE id=$2',[revision,id]);
  await db.query('COMMIT');
  return {workspaceId:item.workspace_id,operationId:operation.id,revision,duplicate:false};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
