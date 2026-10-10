import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import express from 'express';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {hashToken} from '../server/security';
import {seed} from '../src/model';
import {flowSettings,migrateFlow,withFlow} from '../flowIntegration';

test('Flow settings are opt-in and credentials are validated',()=>{
 assert.equal(flowSettings({},'https://example.invalid'),undefined);
 assert.throws(()=>flowSettings({FLOW_IMPORT_TOKEN_SHA256:'bad'},'https://example.invalid'));
 assert.equal(flowSettings({FLOW_IMPORT_TOKEN_SHA256:'a'.repeat(64)},'https://example.invalid')?.email,'muazrehman@vertexfilms.ca');
});

test('staging rejects missing and incorrect credentials before any database access',async()=>{
 const pool={query:()=>{throw Error('Unexpected database access');},connect:()=>{throw Error('Unexpected database access');}} as unknown as Pool;
 const base=express();
 base.locals.sessionMiddleware=(_req:unknown,_res:unknown,next:()=>void)=>next();
 const app=withFlow(base,pool,{tokenHash:hashToken('a'.repeat(64)),email:'muazrehman@vertexfilms.ca',origin:'https://example.invalid'});
 await request(app).post('/api/flow/previews').send({}).expect(401);
 await request(app).post('/api/flow/previews').set('Authorization','Bearer '+'b'.repeat(64)).send({}).expect(401);
});

test('account review escapes untrusted content, rejects revoked/wrong accounts and cannot approve without CSRF',async()=>{
 const userId=randomUUID(),importId=randomUUID(),origin='https://example.invalid';
 let email='muazrehman@vertexfilms.ca',version=0;
 const snapshot=structuredClone(seed);snapshot.boards[0].title='<script>alert(1)</script>';snapshot.boards[0].cards[0].text='<img src=x onerror=alert(1)>';
 const pool={query:async(sql:string)=>({rows:sql.includes('FROM accounts')?[{email,session_version:version,email_verified_at:new Date()}]:[{id:importId,name:'<unsafe>',snapshot,expires_at:new Date(Date.now()+60000),workspace_id:null}]}),connect:()=>{throw Error('CSRF rejection must precede a database transaction');}} as unknown as Pool;
 const base=express();base.locals.sessionMiddleware=(req:{session:unknown},_res:unknown,next:()=>void)=>{req.session={userId,authVersion:0,csrf:'test-csrf'};next();};
 const app=withFlow(base,pool,{tokenHash:hashToken('a'.repeat(64)),email,origin,requireVerification:true});
 const path='/flow-review/'+importId;
 const page=await request(app).get(path).expect(200);
 assert.ok(page.text.includes('&lt;script&gt;'));assert.ok(!page.text.includes('<img src=x'));
 assert.match(page.headers['content-security-policy'],/form-action 'self'/);
 await request(app).post(path).set('Origin',origin).type('form').send({csrf:'wrong'}).expect(403);
 email='other@example.com';await request(app).get(path).expect(403);
 email='muazrehman@vertexfilms.ca';version=1;await request(app).get(path).expect(401);
});

test('Flow imports require account approval, preserve workspaces and deduplicate concurrent creation',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});
 const origin='http://localhost:5173',suffix=randomUUID(),email=`flow-${suffix}@example.com`,token='a'.repeat(64);
 const base=createApp(pool,{secret:'flow-test-session-secret-at-least-32',origin,rateNamespace:suffix,log:()=>{}});
 const app=withFlow(base,pool,{tokenHash:hashToken(token),email,origin});
 const owner=request.agent(app),stranger=request.agent(app);let ownerId='',strangerId='';
 try{
  await migrate(pool);await migrateFlow(pool);
  async function register(agent:typeof owner,address:string){const session=await agent.get('/api/session');return(await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:address,password:'correct-horse-test-password'}).expect(201)).body;}
  const account=await register(owner,email);ownerId=account.userId;
  strangerId=(await register(stranger,`other-${suffix}@example.com`)).userId;
  const body={requestId:randomUUID(),name:'Flow pitch',snapshot:seed};
  const stage=(payload:object=body)=>request(app).post('/api/flow/previews').set('Authorization','Bearer '+token).send(payload);
  await request(app).post('/api/flow/previews').send(body).expect(401);
  await request(app).post('/api/flow/previews').set('Authorization','Bearer '+'b'.repeat(64)).send(body).expect(401);
  await stage({...body,email:'another@example.com'}).expect(400);
  await stage({...body,snapshot:{version:1,boards:[]}}).expect(400);
  const media=structuredClone(seed);media.boards[0].cards.push({id:'media',kind:'image',assetId:randomUUID(),x:0,y:0,text:'private',color:'#fff'});
  await stage({...body,snapshot:media}).expect(400);
  const staged=(await stage().expect(201)).body,path=new URL(staged.reviewUrl).pathname;
  assert.equal(staged.status,'awaiting_account_approval');assert.equal(staged.workspaceId,null);
  assert.equal((await owner.get('/api/workspaces')).body.length,0);
  assert.equal((await stage().expect(201)).body.reviewUrl,staged.reviewUrl);
  await stage({...body,name:'Changed'}).expect(409);
  await request(app).get(path).expect(401);await stranger.get(path).expect(403);
  await owner.get(path).expect(200);
  await owner.post(path).type('form').send({csrf:account.csrf}).expect(403);
  const commit=()=>owner.post(path).set('Origin',origin).type('form').send({csrf:account.csrf});
  await Promise.all([commit().expect(303),commit().expect(303)]);
  const list=(await owner.get('/api/workspaces').expect(200)).body;assert.equal(list.length,1);assert.equal(list[0].role,'owner');
  const workspace=(await owner.get('/api/workspaces/'+list[0].id)).body;assert.deepEqual(workspace.snapshot,seed);
  await owner.get(path).expect(200);
  assert.equal((await stage().expect(201)).body.workspaceId,list[0].id);
  const next=(await stage({...body,requestId:randomUUID(),name:'Expired'}).expect(201)).body;
  const nextPath=new URL(next.reviewUrl).pathname;
  await pool.query('UPDATE flow_imports SET expires_at=now()-interval \'1 minute\' WHERE id=$1',[nextPath.split('/').pop()]);
  await owner.get(nextPath).expect(410);
  await owner.post(nextPath).set('Origin',origin).type('form').send({csrf:account.csrf}).expect(410);
  assert.equal((await owner.get('/api/workspaces')).body.length,1);
  await pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[ownerId]);
  await owner.get(path).expect(401);
 }finally{
  if(ownerId){await pool.query('DELETE FROM flow_imports WHERE user_id=$1',[ownerId]);await pool.query('DELETE FROM team_workspaces WHERE id IN (SELECT workspace_id FROM memberships WHERE user_id=$1)',[ownerId]);}
  await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[[ownerId,strangerId].filter(Boolean)]);await pool.end();
 }
});
