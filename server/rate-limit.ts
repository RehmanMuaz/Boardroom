import {type Pool} from 'pg';
import {type RequestHandler} from 'express';
import {hashToken} from './security';
export function authRateLimit(pool:Pool,namespace='auth',limit=20,windowSeconds=900):RequestHandler{return async(req,res,next)=>{
 try{
  const key=namespace+':'+hashToken(req.ip??'unknown');
  const result=await pool.query(`INSERT INTO auth_rate_limits(key,count,expires_at) VALUES ($1,1,now()+$2*interval '1 second')
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires_at <= now() THEN 1 ELSE auth_rate_limits.count+1 END,
   expires_at=CASE WHEN auth_rate_limits.expires_at <= now() THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
   RETURNING count,ceil(extract(epoch FROM expires_at-now()))::int AS retry`,[key,windowSeconds]);
  if(result.rows[0].count>limit){res.set('Retry-After',String(Math.max(1,result.rows[0].retry)));res.status(429).json({error:'Try again later'});return;}next();
 }catch(e){next(e);}
};}
