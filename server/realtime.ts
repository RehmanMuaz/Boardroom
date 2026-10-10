import {type Server,ServerResponse} from 'node:http';
import {randomUUID} from 'node:crypto';
import {type Express,type Request,type Response,type RequestHandler} from 'express';
import {type Pool} from 'pg';
import {WebSocketServer,WebSocket} from 'ws';
import {z} from 'zod';
import {operationSchema,persistOperation} from './operations';
import {AssetError} from './assets';
import {HttpError} from './workspace-store';
import {logger,errorCode,type Logger} from './observability';

export type RealtimeHooks={publish:(id:string,operationId?:string)=>Promise<void>;revoke:(id:string,userId:string)=>void;logout:(sessionId:string)=>void};
type Peer={socket:WebSocket;request:Request;id:string;workspaceId?:string;boardId?:string;alive:boolean;messages:number;window:number};
const messageSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('subscribe'),workspaceId:z.string().uuid(),csrf:z.string().min(1).max(128)}).strict(),
 z.object({type:z.literal('operation'),operation:operationSchema}).strict(),
 z.object({type:z.literal('presence'),boardId:z.string().min(1).max(128)}).strict(),
]);

export function attachRealtime(server:Server,app:Express,pool:Pool,origin:string){
 const log=(app.locals.logger??logger) as Logger;const logFailure=(error:unknown)=>log({event:'realtime_failed',level:'error',code:errorCode(error)});
 const sockets=new WebSocketServer({noServer:true,maxPayload:2*1024*1024});
 const peers=new Set<Peer>();
 const lanes=new Map<string,Promise<void>>();
 function send(peer:Peer,message:unknown){if(peer.socket.readyState===WebSocket.OPEN){if(peer.socket.bufferedAmount>4*1024*1024){peer.socket.terminate();return;}peer.socket.send(JSON.stringify(message));}}
 function revokePeer(peer:Peer,reason='Workspace access changed. Reopen the workspace.') {send(peer,{type:'revoked',error:reason});peer.socket.close(1008,'Access changed');}
 async function authorize(peer:Peer,workspaceId=peer.workspaceId){
  await new Promise<void>((resolve,reject)=>peer.request.session.reload(error=>error?reject(new HttpError(401,'Session expired')):resolve()));
  if(!peer.request.session.userId)throw new HttpError(401,'Sign in required');
  if(!workspaceId)throw new HttpError(400,'Subscribe first');
  const result=await pool.query('SELECT m.role,a.email,a.email_verified_at,a.session_version FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2',[workspaceId,peer.request.session.userId]);
  if(!result.rowCount)throw new HttpError(404,'Workspace not found');
  if(result.rows[0].session_version!==(peer.request.session.authVersion??0))throw new HttpError(401,'Session revoked');
  if(app.locals.requireVerification&&!result.rows[0].email_verified_at)throw new HttpError(403,'Verify your email first');
  return {userId:peer.request.session.userId,role:result.rows[0].role as string,email:result.rows[0].email as string};
 }
 async function presence(workspaceId:string){
  const members:{connectionId:string;userId:string;email:string;boardId?:string}[]=[];
  const active:Peer[]=[];
  for(const peer of peers)if(peer.workspaceId===workspaceId&&peer.socket.readyState===WebSocket.OPEN){try{const identity=await authorize(peer);active.push(peer);members.push({connectionId:peer.id,userId:identity.userId,email:identity.email,boardId:peer.boardId});}catch{revokePeer(peer);}}
  for(const peer of active)send(peer,{type:'presence',members});
 }
 async function publish(id:string,operationId?:string){
  const previous=lanes.get(id)??Promise.resolve();
  const next=previous.then(async()=>{
   const result=await pool.query('SELECT snapshot,revision,name FROM team_workspaces WHERE id=$1',[id]);if(!result.rowCount)return;
   for(const peer of peers)if(peer.workspaceId===id&&peer.socket.readyState===WebSocket.OPEN){try{const identity=await authorize(peer);send(peer,{type:'snapshot',...result.rows[0],role:identity.role,operationId});}catch{revokePeer(peer);}}
  }).catch(error=>{logFailure(error);for(const peer of peers)if(peer.workspaceId===id)peer.socket.terminate();});
  lanes.set(id,next);await next;if(lanes.get(id)===next)lanes.delete(id);
 }
 const hooks:RealtimeHooks={publish,revoke(id,userId){for(const peer of peers)if(peer.workspaceId===id&&peer.request.session.userId===userId)revokePeer(peer);void presence(id).catch(logFailure);},logout(sessionId){for(const peer of peers)if(peer.request.sessionID===sessionId)revokePeer(peer,'Signed out.');}};
 app.locals.realtime=hooks;
 server.on('upgrade',(incoming,socket,head)=>{
  if(incoming.url!=='/api/live'||incoming.headers.origin!==origin){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  const request=incoming as Request;
  const sessionMiddleware=app.locals.sessionMiddleware as RequestHandler;
  sessionMiddleware(request,new ServerResponse(incoming) as unknown as Response,error=>{
   if(error||!request.session?.userId){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return;}
   sockets.handleUpgrade(incoming,socket,head,ws=>{
    const peer:Peer={socket:ws,request,id:randomUUID(),alive:true,messages:0,window:Date.now()};peers.add(peer);
    ws.on('pong',()=>{peer.alive=true;});
    let chain=Promise.resolve();
    ws.on('message',raw=>{
     if(Date.now()-peer.window>1000){peer.window=Date.now();peer.messages=0;}if(++peer.messages>120){ws.close(1008,'Too many messages');return;}
     chain=chain.then(async()=>{
      if(ws.readyState!==WebSocket.OPEN)return;
      let operationId:string|undefined;
      try{
       const message=messageSchema.parse(JSON.parse(raw.toString()));
       if(message.type==='subscribe'){
        if(peer.workspaceId)throw new HttpError(400,'Already subscribed');
        const identity=await authorize(peer,message.workspaceId);if(message.csrf!==peer.request.session.csrf)throw new HttpError(403,'Invalid CSRF token');
        peer.workspaceId=message.workspaceId;
        const result=await pool.query('SELECT snapshot,revision,name FROM team_workspaces WHERE id=$1',[peer.workspaceId]);
        send(peer,{type:'snapshot',...result.rows[0],role:identity.role});await presence(peer.workspaceId);
       }else if(message.type==='operation'){
        operationId=message.operation.id;const identity=await authorize(peer);
        const result=await persistOperation(pool,peer.workspaceId!,identity.userId,message.operation);
        // Commit precedes both acknowledgement and broadcasting.
        send(peer,{type:'ack',...result});await publish(peer.workspaceId!,operationId);
       }else{
        await authorize(peer);const result=await pool.query('SELECT snapshot FROM team_workspaces WHERE id=$1',[peer.workspaceId]);
        // Deletion can race a legitimate navigation update. Fall back to the root board.
        peer.boardId=result.rows[0].snapshot.boards.some((board:{id:string})=>board.id===message.boardId)?message.boardId:result.rows[0].snapshot.boards[0].id;await presence(peer.workspaceId!);
       }
      }catch(error){
       const status=(error instanceof HttpError||error instanceof AssetError)?error.status:error instanceof z.ZodError||error instanceof SyntaxError?400:500;
       send(peer,{type:'error',status,operationId,error:status===500?'Server unavailable':error instanceof Error?error.message:'Invalid message'});
       if([401,403,404].includes(status))revokePeer(peer);if(status===500){logFailure(error);ws.close(1011,'Server unavailable');}
      }
     });
    });
    ws.on('close',()=>{peers.delete(peer);if(peer.workspaceId)void presence(peer.workspaceId).catch(logFailure);});
    ws.on('error',()=>ws.terminate());
   });
  });
 });
 const timer=setInterval(()=>{
  for(const peer of peers){if(!peer.alive||!peer.workspaceId){peer.socket.terminate();continue;}peer.alive=false;peer.socket.ping();void authorize(peer).then(identity=>send(peer,{type:'role',role:identity.role})).catch(()=>revokePeer(peer));}
 },10000);
 timer.unref();
 return {async close(){clearInterval(timer);for(const peer of peers)peer.socket.terminate();await new Promise<void>(resolve=>sockets.close(()=>resolve()));}};
}
