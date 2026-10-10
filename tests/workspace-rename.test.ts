import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
test('workspace renaming enforces owner boundaries, persists without changing canvas and rejects competing names',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const suffix=randomUUID(),origin='http://localhost:5173',namespace='rename-'+suffix;
 const app=createApp(pool,{origin,secret:'rename-session-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}});const owner=request.agent(app),editor=request.agent(app),viewer=request.agent(app),stranger=request.agent(app);const accounts:string[]=[];let id='';
 async function register(agent:typeof owner){const session=await agent.get('/api/session');const info=(await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:`${randomUUID()}@example.com`,password:'rename-test-password-long'}).expect(201)).body;accounts.push(info.userId);return info;}
 try{
  const identity=await register(owner),editorIdentity=await register(editor),viewerIdentity=await register(viewer),strangerIdentity=await register(stranger);
  id=(await owner.post('/api/workspaces').set('Origin',origin).set('x-csrf-token',identity.csrf).send({name:'Original'}).expect(201)).body.id;
  await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'editor'),($1,$3,'viewer')",[id,editorIdentity.userId,viewerIdentity.userId]);
  const original=(await owner.get(`/api/workspaces/${id}`)).body;
  const rename=(agent:typeof owner,csrf:string,name:string,expectedName='Original')=>agent.patch(`/api/workspaces/${id}`).set('Origin',origin).set('x-csrf-token',csrf).send({name,expectedName});
  await request(app).patch(`/api/workspaces/${id}`).set('Origin',origin).send({name:'Denied',expectedName:'Original'}).expect(403);
  await rename(editor,editorIdentity.csrf,'Denied').expect(403);await rename(viewer,viewerIdentity.csrf,'Denied').expect(403);await rename(stranger,strangerIdentity.csrf,'Denied').expect(404);
  await rename(owner,identity.csrf,'   ').expect(400);await rename(owner,identity.csrf,'x'.repeat(121)).expect(400);
  const results=await Promise.all([rename(owner,identity.csrf,'First'),rename(owner,identity.csrf,'Second')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const winner=results.find(r=>r.status===200)!.body.name;
  await rename(owner,identity.csrf,winner).expect(200);
  await rename(owner,identity.csrf,'  Final name  ',winner).expect(200);const loaded=(await viewer.get(`/api/workspaces/${id}`).expect(200)).body;
  assert.equal(loaded.name,'Final name');assert.deepEqual(loaded.snapshot,original.snapshot);assert.equal(loaded.revision,original.revision);
  assert.equal((await editor.get('/api/workspaces')).body.find((w:{id:string})=>w.id===id).name,'Final name');
  await owner.patch(`/api/workspaces/${id}`).set('Origin','http://evil.example').set('x-csrf-token',identity.csrf).send({name:'Denied',expectedName:'Final name'}).expect(403);
 }finally{if(id)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[id]);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[accounts]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[accounts]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();}
});
