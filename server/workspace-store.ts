import {type Pool,type PoolClient} from 'pg';
import {validWorkspace,type Workspace} from '../src/model';
import {validateAssetReferences} from './assets';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export async function mutateWorkspace(pool:Pool,id:string,expectedRevision:number,authorize:(db:PoolClient)=>Promise<unknown>,mutate:(snapshot:Workspace)=>Workspace){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const result=await db.query('SELECT snapshot,revision FROM team_workspaces WHERE id=$1 FOR UPDATE',[id]);
  await authorize(db);
  if(!result.rowCount)throw new HttpError(404,'Workspace not found');
  if(result.rows[0].revision!==expectedRevision)throw new HttpError(409,'Workspace changed. Reload before saving.');
  const snapshot=mutate(result.rows[0].snapshot as Workspace);
  if(!validWorkspace(snapshot))throw new HttpError(400,'Invalid workspace snapshot or board references');
  await validateAssetReferences(db,id,snapshot);
  const updated=await db.query('UPDATE team_workspaces SET snapshot=$1,revision=revision+1 WHERE id=$2 RETURNING revision',[JSON.stringify(snapshot),id]);
  await db.query('COMMIT');return {snapshot,revision:updated.rows[0].revision as number};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
