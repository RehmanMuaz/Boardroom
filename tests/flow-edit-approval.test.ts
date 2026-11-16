import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {withFlow,type FlowSettings} from '../server/flow-integration';
import {migrate} from '../server/migrate';
import {hashToken} from '../server/security';
import {persistOperation} from '../server/operations';
import {defaultWorkspaceStyle} from '../src/style-schema';

test('Flow exact edit reviews require native approval, reject stale/revoked requests and commit atomically',async t=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});
 const origin='http://localhost:5173',email='flow-edits-'+randomUUID()+'@example.com',token='a'.repeat(64);
 const settings:FlowSettings={tokenHash:hashToken(token),email,origin,workspaceIds:[]};
 const base=createApp(pool,{secret:'flow-edit-local-test-secret-at-least-32',origin,rateNamespace:randomUUID(),log:()=>{}});
 const publications:string[]=[];
 base.locals.realtime={publish:async(id:string)=>{publications.push(id);},logout:()=>{},revoke:()=>{}};
 const app=withFlow(base,pool,settings),owner=request.agent(app),other=request.agent(app);
 let ownerId='',otherId='',workspaceId='',csrf='';
 async function register(agent:typeof owner,address:string){
  const session=await agent.get('/api/session');
  return (await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:address,password:'correct-horse-test-password'}).expect(201)).body;
 }
 const read=async()=> (await owner.get('/api/workspaces/'+workspaceId).expect(200)).body;
 const stage=(operation:object)=>request(app).post('/api/flow/workspaces/'+workspaceId+'/reviews').set('Authorization','Bearer '+token).send(operation);
 const commit=(path:string)=>owner.post(path).set('Origin',origin).type('form').send({csrf});
 async function proposal(title='Revised title'){
  const current=await read();return {id:randomUUID(),baseRevision:current.revision,changes:[{boardId:current.snapshot.boards[0].id,field:'title',before:current.snapshot.boards[0].title,after:title}]};
 }
 async function review(operation:object){const result=await stage(operation).expect(201);return new URL(result.body.reviewUrl).pathname;}
 try{
  await migrate(pool);await migrate(pool);
  const account=await register(owner,email);ownerId=account.userId;csrf=account.csrf;
  otherId=(await register(other,'other-'+randomUUID()+'@example.com')).userId;
  workspaceId=(await owner.post('/api/workspaces').set('Origin',origin).set('x-csrf-token',csrf).send({name:'Flow editable workspace'}).expect(201)).body.id;
  settings.workspaceIds!.push(workspaceId);

  await t.test('scope, actor, session and CSRF checks precede approval',async()=>{
   const operation=await proposal('<script>proposed()</script>');
   const original=await read();const path=await review(operation);
   await request(app).post('/api/flow/workspaces/'+workspaceId+'/reviews').send(operation).expect(401);
   assert.deepEqual(await read(),original);
   const page=await owner.get(path).expect(200);assert.match(page.text,/Apply reviewed changes/);assert.match(page.text,/&lt;script&gt;/);assert.ok(!page.text.includes('<script>proposed'));
   await request(app).get(path).expect(401);await other.get(path).expect(403);
   await request(app).post(path).set('Authorization','Bearer '+token).expect(401);
   await owner.post(path).set('Origin',origin).type('form').send({csrf:'wrong'}).expect(403);
   await owner.post(path).type('form').send({csrf}).expect(403);
   await owner.post(path).set('Origin',origin).type('form').send({csrf,operation:'changed'}).expect(400);
   assert.equal((await stage(operation).expect(201)).body.reviewUrl,origin+path);
   await stage({...operation,changes:[{...operation.changes[0],after:'Changed proposal'}]}).expect(409);
   const result=await request(app).get('/api/flow/workspaces/'+workspaceId).set('Authorization','Bearer '+token).expect(200);
   assert.equal(result.body.revision,original.revision);
   settings.workspaceIds=[];await commit(path).expect(404);settings.workspaceIds=[workspaceId];
  });

  await t.test('concurrent approvals apply once, preserve unrelated cards and publish after commit',async()=>{
   const original=await read(),operation=await proposal('Approved title'),path=await review(operation);
   await Promise.all([commit(path).expect(303),commit(path).expect(303)]);
   const current=await read();assert.equal(current.revision,original.revision+1);
   assert.equal(current.snapshot.boards[0].title,'Approved title');
   assert.deepEqual(current.snapshot.boards[0].cards,original.snapshot.boards[0].cards);
   assert.equal(Number((await pool.query('SELECT count(*) FROM workspace_operations WHERE workspace_id=$1 AND operation_id=$2',[workspaceId,operation.id])).rows[0].count),1);
   assert.ok(publications.includes(workspaceId));
   assert.match((await owner.get(path).expect(200)).text,/already applied/);
  });

  await t.test('stale reviews never overwrite later manual work',async()=>{
   const operation=await proposal('Stale proposal'),path=await review(operation);
   await persistOperation(pool,workspaceId,ownerId,{...operation,id:randomUUID(),changes:[{...operation.changes[0],after:'Manual title'}]});
   await owner.get(path).expect(409);await commit(path).expect(409);
   assert.equal((await read()).snapshot.boards[0].title,'Manual title');
  });

  await t.test('expiry, account session version and downgraded membership block approval',async()=>{
   const operation=await proposal(),path=await review(operation),id=path.split('/').at(-1);
   await pool.query("UPDATE flow_edits SET expires_at=now()-interval '1 minute' WHERE id=$1",[id]);
   await owner.get(path).expect(410);await commit(path).expect(410);
   await stage(operation).expect(410);
   const freshPath=await review(await proposal());
   await pool.query("UPDATE memberships SET role='viewer' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,ownerId]);
   await commit(freshPath).expect(403);await stage(await proposal()).expect(403);
   await pool.query("UPDATE memberships SET role='owner' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,ownerId]);
   await pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[ownerId]);
   await commit(freshPath).expect(401);
   await pool.query('UPDATE accounts SET session_version=session_version-1 WHERE id=$1',[ownerId]);
  });

  await t.test('tampered persisted content and invalid asset references do not mutate the workspace',async()=>{
   const operation=await proposal(),path=await review(operation),id=path.split('/').at(-1),before=await read();
   await pool.query("UPDATE flow_edits SET operation=jsonb_set(operation,'{changes,0,after}','\"tampered\"'::jsonb) WHERE id=$1",[id]);
   await owner.get(path).expect(409);await commit(path).expect(409);
   const media={id:randomUUID(),kind:'image',x:0,y:0,text:'foreign',color:'#fff',assetId:randomUUID()};
   await stage({id:randomUUID(),baseRevision:before.revision,changes:[{boardId:before.snapshot.boards[0].id,cardId:media.id,field:'$card',before:null,after:media}]}).expect(400);
   assert.deepEqual(await read(),before);
  });

  await t.test('permission removal is rechecked at approval',async()=>{
   const path=await review(await proposal());
   await pool.query('DELETE FROM memberships WHERE workspace_id=$1 AND user_id=$2',[workspaceId,ownerId]);
   await commit(path).expect(403);
   await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'owner')",[workspaceId,ownerId]);
  });

  await t.test('owner-only style permissions are rechecked even after staging',async()=>{
   const before=await read();
   const operation={id:randomUUID(),baseRevision:before.revision,changes:[{boardId:'*',field:'$workspaceStyle',before:null,after:defaultWorkspaceStyle}]};
   const path=await review(operation);
   await owner.get(path).expect(200);
   await pool.query("UPDATE memberships SET role='editor' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,ownerId]);
   await commit(path).expect(403);
   const unchanged=await read();assert.deepEqual(unchanged.snapshot,before.snapshot);assert.equal(unchanged.revision,before.revision);
   await pool.query("UPDATE memberships SET role='owner' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,ownerId]);
  });

  await t.test('operation ID collision rolls back and a notification failure does not undo a committed approval',async()=>{
   const operation=await proposal(),path=await review(operation),before=await read();
   await pool.query('INSERT INTO workspace_operations(workspace_id,operation_id,user_id,payload_hash,revision) VALUES ($1,$2,$3,$4,$5)',[workspaceId,operation.id,ownerId,'different',before.revision]);
   await commit(path).expect(409);assert.deepEqual(await read(),before);
   const freshPath=await review(await proposal('Committed despite notification failure'));
   base.locals.realtime.publish=async()=>{throw Error('Synthetic notification failure');};
   await commit(freshPath).expect(303);
   assert.equal((await read()).snapshot.boards[0].title,'Committed despite notification failure');
   await commit(freshPath).expect(303);
  });
 }finally{
  if(workspaceId){await pool.query('DELETE FROM workspace_operations WHERE workspace_id=$1',[workspaceId]);await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);}
  if(ownerId||otherId)await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[[ownerId,otherId].filter(Boolean)]);
  await pool.end();
 }
});
