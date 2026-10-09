import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrate} from '../server/migrate';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {seed} from '../src/model';

test('sessions, persistence, permissions, conflicts, and one-use invitations',async()=>{
 if(!process.env.TEST_DATABASE_URL&&!process.env.DATABASE_URL)throw Error('Backend tests require DATABASE_URL or TEST_DATABASE_URL; start docker compose first.');
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});
 await migrate(pool);await migrate(pool);
 const origin='http://localhost:5173';
 const app=createApp(pool,{rateNamespace:'test-'+randomUUID(),log:()=>{},secret:'test-session-secret-at-least-32-characters',origin});
 const owner=request.agent(app), viewer=request.agent(app), stranger=request.agent(app);
 const suffix=randomUUID();
 async function account(agent:typeof owner,email:string){const session=await agent.get('/api/session').expect(200);const result=await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email,password:'correct-horse-test-password'}).expect(201);return result.body;}
 const ownerAccount=await account(owner,`owner-${suffix}@example.com`),viewerAccount=await account(viewer,`viewer-${suffix}@example.com`),strangerAccount=await account(stranger,`stranger-${suffix}@example.com`);
 const post=(agent:typeof owner,path:string,csrf:string,body:object)=>agent.post(path).set('Origin',origin).set('x-csrf-token',csrf).send(body);
 try{
  await request(app).get('/api/workspaces').expect(401);
  await owner.post('/api/workspaces').send({name:'Missing CSRF'}).expect(403);
  await owner.post('/api/workspaces').set('Origin','http://evil.example').set('x-csrf-token',ownerAccount.csrf).send({name:'Wrong origin'}).expect(403);
  const workspace=await post(owner,'/api/workspaces',ownerAccount.csrf,{name:'Team'}).expect(201);const id=workspace.body.id;
  await stranger.get(`/api/workspaces/${id}`).expect(404);
  const invite=await post(owner,`/api/workspaces/${id}/invitations`,ownerAccount.csrf,{email:`viewer-${suffix}@example.com`,role:'viewer'}).expect(201);
  await post(stranger,'/api/invitations/accept',strangerAccount.csrf,{token:invite.body.token}).expect(400);
  await post(viewer,'/api/invitations/accept',viewerAccount.csrf,{token:invite.body.token}).expect(200);
  await post(viewer,'/api/invitations/accept',viewerAccount.csrf,{token:invite.body.token}).expect(400);
  const put=(agent:typeof owner,csrf:string,snapshot:unknown,expectedRevision=0)=>agent.put(`/api/workspaces/${id}`).set('Origin',origin).set('x-csrf-token',csrf).send({snapshot,expectedRevision});
  await put(viewer,viewerAccount.csrf,seed).expect(403);
  await put(stranger,strangerAccount.csrf,seed).expect(404);
  await viewer.get(`/api/workspaces/${id}/members`).expect(403);
  await stranger.get(`/api/workspaces/${id}/members`).expect(404);
  await post(viewer,`/api/workspaces/${id}/invitations`,viewerAccount.csrf,{email:'x@example.com',role:'editor'}).expect(403);
  await post(stranger,`/api/workspaces/${id}/invitations`,strangerAccount.csrf,{email:'x@example.com',role:'editor'}).expect(404);
  const changed=structuredClone(seed);changed.boards[0].cards[0].text='Durable shared edit';
  await put(owner,ownerAccount.csrf,changed).expect(200);
  await put(owner,ownerAccount.csrf,seed).expect(409);
  const reloaded=await viewer.get(`/api/workspaces/${id}`).expect(200);assert.equal(reloaded.body.snapshot.boards[0].cards[0].text,'Durable shared edit');assert.equal(reloaded.body.revision,1);
  // A fresh API instance and cookie jar load the same data using a new session.
  const restart=request.agent(createApp(pool,{rateNamespace:'test-'+randomUUID(),log:()=>{},secret:'test-session-secret-at-least-32-characters',origin}));const session=await restart.get('/api/session');await post(restart,'/api/auth/login',session.body.csrf,{email:`owner-${suffix}@example.com`,password:'correct-horse-test-password'}).expect(200);assert.deepEqual((await restart.get(`/api/workspaces/${id}`).expect(200)).body.snapshot,changed);
  await put(owner,ownerAccount.csrf,{version:1,boards:[{id:'bad'}]},1).expect(400);
  const base=`/api/workspaces/${id}/boards`;
  for(const path of [base,`${base}/home`]){await viewer.get(path).expect(200);await stranger.get(path).expect(404);}
  const protectedWrites:[string,string,object][]=[
   ['post',base,{expectedRevision:1,board:{id:'extra',title:'Extra'}}],
   ['patch',`${base}/home`,{expectedRevision:1,title:'Denied'}],
   ['delete',`${base}/film`,{expectedRevision:1}],
   ['post',`${base}/home/cards`,{expectedRevision:1,card:{id:'test',kind:'note',x:0,y:0,text:'Denied',color:'#fff'}}],
   ['patch',`${base}/home/cards/welcome`,{expectedRevision:1,patch:{text:'Denied'}}],
   ['delete',`${base}/home/cards/welcome`,{expectedRevision:1}],
  ];
  for(const [method,path,body] of protectedWrites){
   for(const [agent,csrf,status] of [[viewer,viewerAccount.csrf,403],[stranger,strangerAccount.csrf,404]] as const){
    const call=method==='post'?agent.post(path):method==='patch'?agent.patch(path):agent.delete(path);
    await call.set('Origin',origin).set('x-csrf-token',csrf).send(body).expect(status);
   }
  }
  const expired=await post(owner,`/api/workspaces/${id}/invitations`,ownerAccount.csrf,{email:`stranger-${suffix}@example.com`,role:'editor'}).expect(201);
  await pool.query('UPDATE team_invitations SET expires_at=$1 WHERE email=$2',[new Date(0),`stranger-${suffix}@example.com`]);
  await post(stranger,'/api/invitations/accept',strangerAccount.csrf,{token:expired.body.token}).expect(400);
  const stored=await pool.query('SELECT token_hash FROM team_invitations WHERE workspace_id=$1',[id]);assert.ok(stored.rows.every(row=>row.token_hash!==invite.body.token&&row.token_hash!==expired.body.token));
  const patch=(agent:typeof owner,csrf:string,userId:string,role:string)=>agent.patch(`/api/workspaces/${id}/members/${userId}`).set('Origin',origin).set('x-csrf-token',csrf).send({role});
  await patch(stranger,strangerAccount.csrf,viewerAccount.userId,'editor').expect(404);
  await patch(viewer,viewerAccount.csrf,viewerAccount.userId,'editor').expect(403);
  await patch(owner,ownerAccount.csrf,ownerAccount.userId,'viewer').expect(404);
  await patch(owner,ownerAccount.csrf,viewerAccount.userId,'editor').expect(204);
  await put(viewer,viewerAccount.csrf,changed,1).expect(200);
  await viewer.delete(`/api/workspaces/${id}/members/${ownerAccount.userId}`).set('Origin',origin).set('x-csrf-token',viewerAccount.csrf).expect(403);
  await stranger.delete(`/api/workspaces/${id}/members/${viewerAccount.userId}`).set('Origin',origin).set('x-csrf-token',strangerAccount.csrf).expect(404);
  await owner.delete(`/api/workspaces/${id}/members/${viewerAccount.userId}`).set('Origin',origin).set('x-csrf-token',ownerAccount.csrf).expect(204);
  await viewer.get(`/api/workspaces/${id}`).expect(404);await put(viewer,viewerAccount.csrf,changed,2).expect(404);
  const ownerWrite=(method:'post'|'patch'|'delete',path:string,body:object)=>{const call=method==='post'?owner.post(path):method==='patch'?owner.patch(path):owner.delete(path);return call.set('Origin',origin).set('x-csrf-token',ownerAccount.csrf).send(body);};
  await ownerWrite('post',base,{expectedRevision:2,board:{id:'extra',title:'Extra',parent:'home'}}).expect(201);
  await ownerWrite('patch',`${base}/extra`,{expectedRevision:3,title:'Renamed'}).expect(200);
  await ownerWrite('post',`${base}/extra/cards`,{expectedRevision:4,card:{id:'api-note',kind:'note',x:10,y:20,text:'API created',color:'#fff'}}).expect(201);
  await ownerWrite('patch',`${base}/extra/cards/api-note`,{expectedRevision:5,patch:{text:'API updated'}}).expect(200);
  assert.equal((await owner.get(`${base}/extra`).expect(200)).body.board.cards[0].text,'API updated');
  await ownerWrite('patch',`${base}/extra/cards/api-note`,{expectedRevision:5,patch:{text:'Stale'}}).expect(409);
  await ownerWrite('delete',`${base}/extra/cards/api-note`,{expectedRevision:6}).expect(200);
  await ownerWrite('delete',`${base}/extra`,{expectedRevision:7}).expect(200);
  await ownerWrite('post',base,{expectedRevision:8,board:{id:'home',title:'Duplicate'}}).expect(400);
  await ownerWrite('post',base,{expectedRevision:8,board:{id:'cycle',parent:'cycle',title:'Cycle'}}).expect(400);
  await ownerWrite('post',`${base}/home/cards`,{expectedRevision:8,card:{id:'cross-board',kind:'board',x:0,y:0,text:'Bad target',color:'#fff',target:'unrelated'}}).expect(400);
  // Competing writes with one expected revision cannot both commit.
  const other=structuredClone(changed);other.boards[0].title='Concurrent winner';
  const writes=await Promise.all([put(owner,ownerAccount.csrf,changed,8),put(owner,ownerAccount.csrf,other,8)]);
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);assert.equal((await owner.get(`/api/workspaces/${id}`)).body.revision,9);
  await post(owner,'/api/logout',ownerAccount.csrf,{}).expect(204);await owner.get('/api/workspaces').expect(401);
 }finally{
  await pool.query('DELETE FROM team_workspaces WHERE id IN (SELECT workspace_id FROM memberships WHERE user_id=$1)',[ownerAccount.userId]);
  await pool.query("DELETE FROM session WHERE sess->>'userId' IN ($1,$2,$3)",[ownerAccount.userId,viewerAccount.userId,strangerAccount.userId]);
  await pool.query('DELETE FROM accounts WHERE id=$1 OR id=$2 OR id=$3',[ownerAccount.userId,viewerAccount.userId,strangerAccount.userId]);
  await pool.end();
 }
});
