import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {Pool} from 'pg';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {mentionedMembers} from '../src/comments';

test('mentions match exact member emails and never foreign addresses, prefixes or markup',()=>{
 const members=[{id:'a',email:'person+tag@example.com',role:'editor' as const},{id:'b',email:'other@example.com',role:'viewer' as const}];
 assert.deepEqual(mentionedMembers('Please @PERSON+tag@example.com. and (@other@example.com), thanks',members),['a','b']);
 assert.deepEqual(mentionedMembers('person+tag@example.com @person+tag@example.com.evil <@other@example.com> @foreign@example.com',members),[]);
});

test('durable feedback enforces membership, read-only viewers, mentions, idempotency, resolution conflicts and canvas compatibility',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const origin='http://localhost:5173',namespace='comments-'+randomUUID(),options={origin,secret:'comments-session-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}},app=createApp(pool,options),agents=Array.from({length:4},()=>request.agent(app)),users:{userId:string;csrf:string;email:string}[]=[];let workspace='';
 try{
  for(const a of agents){const session=await a.get('/api/session'),email=randomUUID()+'@example.com';const result=await a.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email,password:'comments-integration-password'}).expect(201);users.push({...result.body,email});}
  function send(index:number,path:string,body:object,method:'post'|'patch'='post'){return agents[index][method]('/api/workspaces/'+workspace+'/comments'+path).set('Origin',origin).set('x-csrf-token',users[index].csrf).send(body);}
  workspace=(await agents[0].post('/api/workspaces').set('Origin',origin).set('x-csrf-token',users[0].csrf).send({name:'Feedback compatibility'}).expect(201)).body.id;
  await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'editor'),($1,$3,'viewer')",[workspace,users[1].userId,users[2].userId]);
  const before=(await agents[0].get('/api/workspaces/'+workspace)).body;
  const path='/api/workspaces/'+workspace+'/comments',list='?boardId=home&filter=all';
  await request(app).get(path+list).expect(401);await agents[3].get(path+list).expect(404);
  await agents[0].get(path+'?boardId=home&offset=-1').expect(400);
  const id=randomUUID(),body={id,boardId:'home',cardId:'welcome',body:`Please review @${users[1].email}, @${users[2].email} and @${users[3].email}`};
  await agents[0].post(path).set('Origin',origin).send(body).expect(403);
  await send(2,'',body).expect(403);await send(3,'',body).expect(404);
  await send(0,'',{...body,cardId:'foreign'}).expect(404);await send(0,'',{...body,boardId:'missing'}).expect(404);
  await send(0,'',{...body,body:' '.repeat(10)}).expect(400);await send(0,'',{...body,body:'x'.repeat(4001)}).expect(400);
  await send(0,'',body).expect(201);await send(0,'',body).expect(201);await send(1,'',body).expect(409);
  assert.equal(Number((await pool.query('SELECT count(*) FROM comment_messages WHERE thread_id=$1',[id])).rows[0].count),1);
  const recipients=(await pool.query('SELECT user_id FROM comment_mentions WHERE message_id=$1 ORDER BY user_id',[id])).rows.map(r=>r.user_id).sort();assert.deepEqual(recipients,[users[1].userId,users[2].userId].sort());
  const editorList=(await agents[1].get(path+list).expect(200)).body;assert.equal(editorList.unread,1);assert.equal(editorList.mentions,1);assert.equal(editorList.threads[0].mentioned,true);
  await agents[3].get(path+'/'+id).expect(404);await send(3,'/'+id+'/read',{version:1}).expect(404);
  const viewer=(await agents[2].get(path+'/'+id).expect(200)).body;assert.equal(viewer.messages[0].body,body.body);assert.equal(viewer.targetMissing,false);
  await send(2,'/'+id+'/read',{version:1000}).expect(400);await send(2,'/'+id+'/read',{version:1}).expect(204);assert.equal((await agents[2].get(path+list)).body.unread,0);
  await send(2,'/'+id+'/messages',{id:randomUUID(),body:'Cannot write'}).expect(403);await send(2,'/'+id,{resolved:true,expectedVersion:1},'patch').expect(403);
  const reply={id:randomUUID(),body:'First reply'};await send(1,'/'+id+'/messages',reply).expect(201);await send(1,'/'+id+'/messages',reply).expect(201);await send(1,'/'+id+'/messages',{...reply,body:'Changed'}).expect(409);
  await send(0,'/'+id,{resolved:true,expectedVersion:1},'patch').expect(409);
  // Concurrent distinct replies serialize without losing either message.
  await Promise.all([send(0,'/'+id+'/messages',{id:randomUUID(),body:'Owner reply'}).expect(201),send(1,'/'+id+'/messages',{id:randomUUID(),body:'Parallel reply'}).expect(201)]);
  let detail=(await agents[0].get(path+'/'+id)).body;assert.equal(detail.messages.length,4);assert.equal(detail.thread.version,4);
  await send(0,'/'+id,{resolved:true,expectedVersion:4},'patch').expect(200);await send(1,'/'+id+'/messages',{id:randomUUID(),body:'Closed'}).expect(409);
  assert.equal((await agents[1].get(path+'?boardId=home&filter=resolved')).body.total,1);
  await send(1,'/'+id,{resolved:false,expectedVersion:5},'patch').expect(200);
  await send(1,'/'+id+'/read',{version:6}).expect(204);await send(1,'/'+id+'/read',{version:1}).expect(204);assert.equal((await agents[1].get(path+list)).body.unread,0);
  // A second app instance sees the same threads and receipts, not process-local state.
  const restarted=request.agent(createApp(pool,options)),session=(await restarted.get('/api/session')).body;await restarted.post('/api/auth/login').set('Origin',origin).set('x-csrf-token',session.csrf).send({email:users[1].email,password:'comments-integration-password'}).expect(200);assert.equal((await restarted.get(path+list)).body.unread,0);assert.equal((await restarted.get(path+'/'+id)).body.messages.length,4);
  const after=(await agents[0].get('/api/workspaces/'+workspace)).body;assert.deepEqual(after.snapshot,before.snapshot);assert.equal(after.revision,before.revision);
  // Removing an anchor preserves historical feedback. Missing anchors cannot receive new threads.
  const removed=structuredClone(before.snapshot);removed.boards[0].cards=removed.boards[0].cards.filter((c:{id:string})=>c.id!=='welcome');await pool.query('UPDATE team_workspaces SET snapshot=$1 WHERE id=$2',[JSON.stringify(removed),workspace]);assert.equal((await agents[0].get(path+'/'+id)).body.targetMissing,true);await send(0,'',{...body,id:randomUUID()}).expect(404);
  await pool.query('DELETE FROM memberships WHERE workspace_id=$1 AND user_id=$2',[workspace,users[1].userId]);await agents[1].get(path+list).expect(404);await agents[1].get(path+'/'+id).expect(404);await send(1,'/'+id+'/read',{version:6}).expect(404);await send(1,'/'+id+'/messages',{id:randomUUID(),body:'Revoked'}).expect(404);
  // Unread discovery includes other boards only when explicitly requesting workspace scope.
  const snapshot=(await agents[0].get('/api/workspaces/'+workspace)).body.snapshot;snapshot.boards.push({id:'another',title:'Other board',cards:[]});await pool.query('UPDATE team_workspaces SET snapshot=$1 WHERE id=$2',[JSON.stringify(snapshot),workspace]);
  await send(0,'',{id:randomUUID(),boardId:'another',body:'Other board feedback'}).expect(201);
  assert.equal((await agents[2].get(path+'?boardId=home&filter=all&scope=workspace')).body.total,2);assert.equal((await agents[2].get(path+list)).body.total,1);
  // Existing read versions never swallow a reply that arrives later.
  await send(0,'/'+id+'/messages',{id:randomUUID(),body:'New unread reply'}).expect(201);await send(2,'/'+id+'/read',{version:6}).expect(204);assert.equal((await agents[2].get(path+list)).body.unread,2);assert.equal((await agents[2].get(path+list)).body.threads[0].unread,true);
 }finally{if(workspace)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspace]);const ids=users.map(u=>u.userId);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[ids]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();}
});
