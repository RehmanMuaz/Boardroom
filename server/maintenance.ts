import {type Pool} from 'pg';
import {type Logger,errorCode} from './observability';
export async function maintenance(pool:Pool){
 const result=await pool.query(`WITH sessions AS (DELETE FROM session WHERE expire < now() RETURNING sid),
 limits AS (DELETE FROM auth_rate_limits WHERE expires_at < now() RETURNING key),
 tokens AS (DELETE FROM account_tokens WHERE expires_at < now() RETURNING id),
 invites AS (DELETE FROM team_invitations WHERE expires_at < now() - interval '7 days' RETURNING id)
 SELECT (SELECT count(*) FROM sessions)::int AS sessions,(SELECT count(*) FROM limits)::int AS limits,
 (SELECT count(*) FROM tokens)::int AS tokens,(SELECT count(*) FROM invites)::int AS invites`);
 return result.rows[0] as {sessions:number;limits:number;tokens:number;invites:number};
}
export function startMaintenance(pool:Pool,log:Logger){
 let running=false;
 const tick=async()=>{if(running)return;running=true;try{await maintenance(pool);}catch(e){log({event:'maintenance_failed',level:'error',code:errorCode(e)});}finally{running=false;}};
 const timer=setInterval(()=>void tick(),15*60*1000);timer.unref();void tick();
 return ()=>clearInterval(timer);
}
