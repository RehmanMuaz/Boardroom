import {randomUUID} from 'node:crypto';
import {type RequestHandler} from 'express';
export type LogEvent={event:string;level?:'info'|'error';requestId?:string;method?:string;path?:string;status?:number;durationMs?:number;code?:string};
export type Logger=(entry:LogEvent)=>void;
export const logger:Logger=entry=>console.log(JSON.stringify({time:new Date().toISOString(),...entry}));
export function requestLog(log:Logger):RequestHandler{return(req,res,next)=>{
 const requestId=randomUUID(),started=performance.now();res.locals.requestId=requestId;res.set('X-Request-ID',requestId);
 res.once('finish',()=>log({event:'http_request',requestId,method:req.method,path:req.route?.path??'unmatched',status:res.statusCode,durationMs:Math.round(performance.now()-started)}));next();
};}
// Never log bodies, tokens, cookie headers, SMTP responses, query strings or raw errors.
export function errorCode(error:unknown){const code=(error as {code?:unknown})?.code;return typeof code==='string'&&/^[A-Z0-9_]{1,40}$/.test(code)?code:'INTERNAL';}
