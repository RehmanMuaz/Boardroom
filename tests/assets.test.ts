import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {Pool} from 'pg';
import request from 'supertest';
import sharp from 'sharp';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {persistOperation} from '../server/operations';
import {seed} from '../src/model';
import {diffWorkspace} from '../src/operations';

test('private assets validate bytes, enforce roles/scopes, serve ranges and reject foreign references',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);
 const base=resolve('.test-assets');await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'permission-'));
 const origin='http://localhost:5173',app=createApp(pool,{rateNamespace:'test-'+randomUUID(),log:()=>{},secret:'asset-test-secret-at-least-32-characters',origin,assetRoot:root,maxAssetBytes:2048});
 const suffix=randomUUID(),accounts:string[]=[],workspaces:string[]=[];
 async function account(name:string){const agent=request.agent(app);const session=await agent.get('/api/session');const result=await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:`asset-${name}-${suffix}@example.com`,password:'asset-test-password'}).expect(201);accounts.push(result.body.userId);return {agent,csrf:result.body.csrf as string,userId:result.body.userId as string};}
 try{
  const owner=await account('owner'),viewer=await account('viewer'),stranger=await account('stranger');
  for(const name of ['Assets','Other scope']){const result=await owner.agent.post('/api/workspaces').set('Origin',origin).set('x-csrf-token',owner.csrf).send({name}).expect(201);workspaces.push(result.body.id);}
  const [id,other]=workspaces;await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[id,viewer.userId,'viewer']);
  const image=await sharp({create:{width:4,height:4,channels:4,background:{r:30,g:100,b:70,alpha:1}}}).png().toBuffer();
  const upload=(identity:typeof owner,workspaceId:string,name:string,data:Buffer)=>identity.agent.post(`/api/workspaces/${workspaceId}/assets`).query({name}).set('Origin',origin).set('x-csrf-token',identity.csrf).set('Content-Type','application/octet-stream').send(data);
  await upload(viewer,id,'view.png',image).expect(403);await upload(stranger,id,'stolen.png',image).expect(404);
  await owner.agent.post(`/api/workspaces/${id}/assets`).query({name:'csrf.png'}).set('Content-Type','application/octet-stream').send(image).expect(403);
  await upload(owner,id,'fake.png',Buffer.from('<svg onload="alert(1)"></svg>')).expect(415);
  await upload(owner,id,'bad.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(50)])).expect(415);
  await upload(owner,id,'large.txt',Buffer.alloc(2050,65)).expect(413);
  await upload(owner,id,'../escape.png',image).expect(400);
  const uploaded=await upload(owner,id,'actual-bytes.jpg',image).expect(201);assert.equal(uploaded.body.mime,'image/png');const assetId=uploaded.body.id as string;
  const foreign=await upload(owner,other,'foreign.png',image).expect(201);
  const content=`/api/workspaces/${id}/assets/${assetId}/content`;
  await request(app).get(content).expect(401);await stranger.agent.get(content).expect(404);await viewer.agent.get(`/api/workspaces/${other}/assets/${foreign.body.id}/content`).expect(404);
  await owner.agent.get(`/api/workspaces/${other}/assets/${assetId}/content`).expect(404);
  const bytes=await viewer.agent.get(content).expect(200);assert.equal(bytes.headers['content-type'],'image/png');assert.equal(bytes.headers['x-content-type-options'],'nosniff');assert.deepEqual(bytes.body,image);assert.equal(bytes.headers['cache-control'],'no-store');
  const range=await viewer.agent.get(content).set('Range','bytes=0-7').expect(206);assert.equal(range.headers['content-range'],`bytes 0-7/${image.length}`);assert.deepEqual(range.body,image.subarray(0,8));
  const suffixRange=await viewer.agent.get(content).set('Range','bytes=-5').expect(206);assert.deepEqual(suffixRange.body,image.subarray(-5));
  await viewer.agent.get(content).set('Range','bytes=9000-').expect(416);await viewer.agent.get(content).set('Range','bytes=0-1,4-5').expect(416);
  await viewer.agent.head(content).expect(200);await viewer.agent.get(`/api/workspaces/${id}/assets/${assetId}`).expect(200);
  const file=await upload(owner,id,'notes.txt',Buffer.from('A private attachment')).expect(201);const attachment=await viewer.agent.get(`/api/workspaces/${id}/assets/${file.body.id}/content`).expect(200);assert.match(attachment.headers['content-disposition'],/^attachment/);
  const snapshot=structuredClone(seed);snapshot.boards[0].cards.push({id:'media',kind:'image',assetId,text:'Image',color:'#fff',x:100,y:300,width:320,height:260});
  const bad=structuredClone(snapshot);bad.boards[0].cards.at(-1)!.assetId=foreign.body.id;
  const put=(value:unknown,expectedRevision=0)=>owner.agent.put(`/api/workspaces/${id}`).set('Origin',origin).set('x-csrf-token',owner.csrf).send({snapshot:value,expectedRevision});
  await put(bad).expect(400);
  await assert.rejects(persistOperation(pool,id,owner.userId,{id:randomUUID(),baseRevision:0,changes:diffWorkspace(seed,bad)}),/existing asset/);
  const mismatch=structuredClone(snapshot);mismatch.boards[0].cards.at(-1)!.kind='video';await put(mismatch).expect(400);
  const unsafe=structuredClone(seed);unsafe.boards[0].cards[0].text='Bad';unsafe.boards[0].cards[0].richText={blocks:[{type:'paragraph',runs:[{text:'Bad',href:'javascript:alert(1)'}]}]};await put(unsafe).expect(400);
  await put(snapshot).expect(200);
  const remove=(identity:typeof owner,asset:string)=>identity.agent.delete(`/api/workspaces/${id}/assets/${asset}`).set('Origin',origin).set('x-csrf-token',identity.csrf);
  await remove(viewer,assetId).expect(403);await remove(stranger,assetId).expect(404);await remove(owner,assetId).expect(409);
  await put(seed,1).expect(200);await remove(owner,assetId).expect(204);await viewer.agent.get(content).expect(404);
  await owner.agent.delete(`/api/workspaces/${id}/members/${viewer.userId}`).set('Origin',origin).set('x-csrf-token',owner.csrf).expect(204);await viewer.agent.get(`/api/workspaces/${id}/assets/${file.body.id}/content`).expect(404);
  assert.equal((await readdir(root)).length,2); // foreign image + retained attachment, no rejected-upload files
 }finally{
  for(const id of workspaces)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[id]);
  for(const id of accounts){await pool.query("DELETE FROM session WHERE sess->>'userId'=$1",[id]);await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
  await pool.end();const path=relative(base,root);assert.ok(path&&!path.startsWith('..')&&!resolve(root).endsWith('.test-assets'));await rm(root,{recursive:true,force:true});
 }
});
