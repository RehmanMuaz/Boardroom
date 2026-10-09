import {type Pool} from 'pg';
import {readFile} from 'node:fs/promises';
export async function migrate(pool:Pool){
 const db=await pool.connect();
 try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(72914382)');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY)');
  for(const [version,file] of [[2,'002_team_mvp.sql'],[3,'003_realtime.sql'],[4,'004_assets.sql'],[5,'005_production.sql'],[6,'006_session_version.sql']] as const){
   const applied=await db.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
   if(!applied.rowCount)await db.query(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
