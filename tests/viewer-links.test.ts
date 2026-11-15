import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {seed} from '../src/model';
import {type Mail} from '../server/mail';
test('viewer links leave legacy workspaces private and unchanged; owner-only, hashed, scoped, read-only grants expire/revoke including media',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const root=await mkdtemp(join(tmpdir(),'boardroom-viewer-')),namespace='viewer-test-'+randomUUID(),origin='http://localhost:5173',mails:Mail[]=[];
 const app=createApp(pool,{origin,secret:'viewer-test-session-secret-long-enough',assetRoot:root,rateNamespace:namespace,log:()=>{},mailer:{async send(mail){mails.push(mail);}}}),owner=request.agent(app),editor=request.agent(app),viewer=request.agent(app),stranger=request.agent(app),client=request.agent(app);const accounts:string[]=[],workspaces:string[]=[],linkIds:string[]=[];
 async function register(agent:typeof owner){const session=await agent.get('/api/session');const identity=(await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:randomUUID()+'@example.com',password:'viewer-link-test-password'}).expect(201)).body;accounts.push(identity.userId);return identity;}
 try{
  const a=await register(owner),b=await register(editor),c=await register(viewer),d=await register(stranger),headers={Origin:origin,'x-csrf-token':a.csrf};const created=(await owner.post('/api/workspaces').set(headers).send({name:'Existing workspace'}).expect(201)).body;const id=created.id;workspaces.push(id);
  await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'editor'),($1,$3,'viewer')",[id,b.userId,c.userId]);
  const before=(await owner.get('/api/workspaces/'+id).expect(200)).body;assert.deepEqual(before.snapshot,seed);await migrate(pool);assert.deepEqual((await owner.get('/api/workspaces/'+id)).body,before);
  const path=`/api/workspaces/${id}/viewer-links`;await client.get(path).expect(401);for(const [agent,identity,status] of [[editor,b,403],[viewer,c,403],[stranger,d,404]] as const)await agent.post(path).set('Origin',origin).set('x-csrf-token',identity.csrf).send({days:7}).expect(status);
  await owner.post(path).set(headers).send({days:0}).expect(400);await owner.post(path).set('Origin','https://evil.example').set('x-csrf-token',a.csrf).send({days:7}).expect(403);
  const link=(await owner.post(path).set(headers).send({email:'client@example.com',days:7}).expect(201)).body,token=new URL(link.url).hash.slice('#viewer='.length);linkIds.push(link.id);assert.equal(link.delivery,'sent');assert.ok(mails.some(m=>m.to==='client@example.com'&&m.text.includes(link.url)));assert.notEqual((await pool.query('SELECT token_hash FROM workspace_viewer_links WHERE id=$1',[link.id])).rows[0].token_hash,token);
  assert.deepEqual((await owner.get('/api/workspaces/'+id)).body,before);assert.equal(JSON.stringify((await owner.get(path)).body).includes(token),false);
  const csrf=(await client.get('/api/session')).body.csrf,clientHeaders={Origin:origin,'x-csrf-token':csrf};await client.get(`/api/viewer/${link.id}/workspace`).expect(404);await client.post('/api/viewer/open').set(clientHeaders).send({token}).expect(200);const shared=(await client.get(`/api/viewer/${link.id}/workspace`).expect(200)).body;assert.deepEqual(shared.snapshot,seed);assert.equal(shared.role,'viewer');await client.get('/api/workspaces/'+id).expect(401);
  await client.put('/api/workspaces/'+id).set(clientHeaders).send({expectedRevision:0,snapshot:seed}).expect(401);await client.post(`/api/viewer/${link.id}/assets`).set(clientHeaders).send({}).expect(403);
  const asset=(await owner.post(`/api/workspaces/${id}/assets?name=visible.txt`).set(headers).set('Content-Type','application/octet-stream').send(Buffer.from('shared bytes')).expect(201)).body,orphan=(await owner.post(`/api/workspaces/${id}/assets?name=private.txt`).set(headers).set('Content-Type','application/octet-stream').send(Buffer.from('not shared')).expect(201)).body;
  const snapshot=structuredClone(seed);snapshot.boards[0].cards.push({id:'shared-file',kind:'file',assetId:asset.id,x:100,y:100,text:'visible.txt',color:'#fff'});await owner.put('/api/workspaces/'+id).set(headers).send({expectedRevision:0,snapshot}).expect(200);
  const assetPath=`/api/viewer/${link.id}/assets/${asset.id}/content`;await client.get(assetPath).set('Range','bytes=0-5').expect(206);await client.head(assetPath).expect(200);await client.get(`/api/viewer/${link.id}/assets/${orphan.id}/content`).expect(404);
  const other=(await owner.post('/api/workspaces').set(headers).send({name:'Other private workspace'})).body;workspaces.push(other.id);const otherAsset=(await owner.post(`/api/workspaces/${other.id}/assets?name=other.txt`).set(headers).set('Content-Type','application/octet-stream').send(Buffer.from('other bytes')).expect(201)).body;await client.get(`/api/viewer/${link.id}/assets/${otherAsset.id}/content`).expect(404);
  await request(app).get(`/api/viewer/${link.id}/workspace`).expect(404);await owner.delete(path+'/'+link.id).set(headers).expect(204);await client.get(`/api/viewer/${link.id}/workspace`).expect(404);await client.get(assetPath).expect(404);await client.post('/api/viewer/open').set(clientHeaders).send({token}).expect(404);
  const expired=(await owner.post(path).set(headers).send({days:1})).body;await pool.query("UPDATE workspace_viewer_links SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);await client.post('/api/viewer/open').set(clientHeaders).send({token:new URL(expired.url).hash.slice(8)}).expect(404);
  assert.deepEqual((await owner.get('/api/workspaces/'+id)).body.snapshot,snapshot);assert.equal((await owner.get(`/api/workspaces/${id}/members`)).body.length,3);
 }finally{await pool.query('DELETE FROM team_workspaces WHERE id=ANY($1::uuid[])',[workspaces]);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[]) OR (sess::jsonb->'viewerGrants') ?| $2::text[]",[accounts,linkIds]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[accounts]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();if(!root.startsWith(join(tmpdir(),'boardroom-viewer-')))throw Error('Unsafe temporary cleanup path');await rm(root,{recursive:true,force:true});}
});
