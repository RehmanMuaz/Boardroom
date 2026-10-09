import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {type AddressInfo} from 'node:net';
import {Pool} from 'pg';
import request from 'supertest';
import {WebSocket} from 'ws';
import {createApp} from '../server/app';
import {attachRealtime} from '../server/realtime';
import {migrate} from '../server/migrate';
import {diffWorkspace} from '../src/operations';
import {seed,type Workspace} from '../src/model';

type Message={type:string;operationId?:string;revision?:number;status?:number;duplicate?:boolean;snapshot?:Workspace;members?:unknown[]};
class SocketClient {
 messages:Message[]=[];
 constructor(public socket:WebSocket){socket.on('message',data=>{this.messages.push(JSON.parse(data.toString()));});}
 send(message:unknown){this.socket.send(JSON.stringify(message));}
 async wait(predicate:(message:Message)=>boolean,timeout=4000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const index=this.messages.findIndex(predicate);if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,10));}
  throw Error('Timed out waiting for socket message; received '+JSON.stringify(this.messages));
 }
}
test('authorized real-time operations persist, merge, replay safely, reconnect and revoke immediately',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);
 const origin='http://localhost:5173',app=createApp(pool,{rateNamespace:'test-'+randomUUID(),log:()=>{},secret:'realtime-test-secret-at-least-32-characters',origin});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const realtime=attachRealtime(server,app,pool,origin),url=`ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/live`;
 const suffix=randomUUID(),clients:SocketClient[]=[],accountIds:string[]=[];let workspaceId='';
 async function account(name:string){const agent=request.agent(app);const session=await agent.get('/api/session');const result=await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:`${name}-${suffix}@example.com`,password:'realtime-test-password'}).expect(201);accountIds.push(result.body.userId);return {agent,userId:result.body.userId as string,csrf:result.body.csrf as string,cookie:(result.headers['set-cookie'] as unknown as string[])[0].split(';')[0]};}
 async function connect(identity:Awaited<ReturnType<typeof account>>,csrf=identity.csrf){const ws=new WebSocket(url,{headers:{Origin:origin,Cookie:identity.cookie}});const client=new SocketClient(ws);clients.push(client);await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});client.send({type:'subscribe',workspaceId,csrf});return client;}
 const post=(identity:Awaited<ReturnType<typeof account>>,path:string,body:object)=>identity.agent.post(path).set('Origin',origin).set('x-csrf-token',identity.csrf).send(body);
 try{
  const owner=await account('owner'),editor=await account('editor'),viewer=await account('viewer'),stranger=await account('stranger');
  workspaceId=(await post(owner,'/api/workspaces',{name:'Realtime test'}).expect(201)).body.id;
  for(const [identity,role] of [[editor,'editor'],[viewer,'viewer']] as const)await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[workspaceId,identity.userId,role]);
  const badOrigin=new WebSocket(url,{headers:{Origin:'http://evil.example',Cookie:owner.cookie}});const badStatus=await new Promise<number>(resolve=>{badOrigin.once('unexpected-response',(_req,res)=>{resolve(res.statusCode!);res.resume();badOrigin.terminate();});badOrigin.on('error',()=>{});});assert.equal(badStatus,403);
  const anonymous=new WebSocket(url,{headers:{Origin:origin}});const unauth=await new Promise<number>(resolve=>{anonymous.once('unexpected-response',(_req,res)=>{resolve(res.statusCode!);res.resume();anonymous.terminate();});anonymous.on('error',()=>{});});assert.equal(unauth,401);
  const denied=await connect(stranger);assert.equal((await denied.wait(m=>m.type==='error')).status,404);assert.ok(!denied.messages.some(m=>m.type==='snapshot'));
  const csrfDenied=await connect(owner,'wrong');assert.equal((await csrfDenied.wait(m=>m.type==='error')).status,403);assert.ok(!csrfDenied.messages.some(m=>m.type==='snapshot'));
  const a=await connect(owner),b=await connect(editor),read=await connect(viewer);await a.wait(m=>m.type==='snapshot');await b.wait(m=>m.type==='snapshot');await read.wait(m=>m.type==='snapshot');
  await a.wait(m=>m.type==='presence'&&(m.members?.length??0)>=3);
  const changed=structuredClone(seed);changed.boards[0].cards[0].text='Live text';const operation={id:randomUUID(),baseRevision:0,changes:diffWorkspace(seed,changed)};
  a.send({type:'operation',operation});const ack=await a.wait(m=>m.type==='ack'&&m.operationId===operation.id);assert.equal(ack.revision,1);
  assert.equal((await b.wait(m=>m.type==='snapshot'&&m.revision===1)).snapshot!.boards[0].cards[0].text,'Live text');
  const stored=await pool.query('SELECT snapshot FROM team_workspaces WHERE id=$1',[workspaceId]);assert.equal(stored.rows[0].snapshot.boards[0].cards[0].text,'Live text');
  const colored=structuredClone(seed);colored.boards[0].cards[0].color='#e3efe9';const colorOperation={id:randomUUID(),baseRevision:0,changes:diffWorkspace(seed,colored)};
  b.send({type:'operation',operation:colorOperation});const colorAck=await b.wait(m=>m.type==='ack'&&m.operationId===colorOperation.id);assert.equal(colorAck.snapshot!.boards[0].cards[0].text,'Live text');assert.equal(colorAck.snapshot!.boards[0].cards[0].color,'#e3efe9');
  const conflicting=structuredClone(seed);conflicting.boards[0].cards[0].text='Conflict';const conflictId=randomUUID();a.send({type:'operation',operation:{id:conflictId,baseRevision:0,changes:diffWorkspace(seed,conflicting)}});assert.equal((await a.wait(m=>m.type==='error'&&m.operationId===conflictId)).status,409);
  read.send({type:'operation',operation:{...operation,id:randomUUID()}});assert.equal((await read.wait(m=>m.type==='error')).status,403);
  // Reconnecting and replaying a committed operation (lost acknowledgement) is safe.
  a.socket.terminate();const reconnected=await connect(owner);assert.equal((await reconnected.wait(m=>m.type==='snapshot')).revision,2);
  reconnected.send({type:'operation',operation});const replay=await reconnected.wait(m=>m.type==='ack'&&m.operationId===operation.id);assert.equal(replay.duplicate,true);assert.equal(replay.revision,2);
  reconnected.send({type:'operation',operation:{...operation,changes:colorOperation.changes}});assert.equal((await reconnected.wait(m=>m.type==='error')).status,409);
  b.send({type:'operation',operation});assert.equal((await b.wait(m=>m.type==='error')).status,409); // another account cannot claim the ID
  const count=await pool.query('SELECT count(*) FROM workspace_operations WHERE workspace_id=$1',[workspaceId]);assert.equal(Number(count.rows[0].count),2);
  reconnected.send({type:'operation',operation:{id:randomUUID(),baseRevision:2,changes:[{boardId:'home',cardId:'welcome',field:'x',before:70,after:'not a number'}]}});assert.equal((await reconnected.wait(m=>m.type==='error')).status,400);
  reconnected.send({type:'operation',operation:{...colorOperation,id:randomUUID(),workspaceId:randomUUID()}});assert.equal((await reconnected.wait(m=>m.type==='error')).status,400);
  // A duplicate retry still checks current write permission.
  await owner.agent.patch(`/api/workspaces/${workspaceId}/members/${editor.userId}`).set('Origin',origin).set('x-csrf-token',owner.csrf).send({role:'viewer'}).expect(204);await b.wait(m=>m.type==='revoked');
  const downgraded=await connect(editor);await downgraded.wait(m=>m.type==='snapshot');downgraded.send({type:'operation',operation:colorOperation});assert.equal((await downgraded.wait(m=>m.type==='error')).status,403);
  const viewerLive=await connect(viewer);await viewerLive.wait(m=>m.type==='snapshot');await owner.agent.delete(`/api/workspaces/${workspaceId}/members/${viewer.userId}`).set('Origin',origin).set('x-csrf-token',owner.csrf).expect(204);await viewerLive.wait(m=>m.type==='revoked');
  const removed=await connect(viewer);assert.equal((await removed.wait(m=>m.type==='error')).status,404);
  const expired=await connect(editor);await expired.wait(m=>m.type==='snapshot');await pool.query("UPDATE session SET expire=$1 WHERE sess->>'userId'=$2",[new Date(0),editor.userId]);expired.send({type:'presence',boardId:'home'});assert.equal((await expired.wait(m=>m.type==='error')).status,401);
  await post(owner,'/api/logout',{}).expect(204);await reconnected.wait(m=>m.type==='revoked');
 }finally{
  clients.forEach(client=>client.socket.terminate());await realtime.close();await new Promise<void>(resolve=>server.close(()=>resolve()));
  if(workspaceId)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);
  for(const id of accountIds){await pool.query("DELETE FROM session WHERE sess->>'userId'=$1",[id]);await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
  await pool.end();
 }
});
