import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {persistOperation} from '../server/operations';
import {diffWorkspace} from '../src/operations';
import {seed} from '../src/model';
import {defaultTextStyle,type TextAnnotation} from '../src/annotations';

test('annotations persist with authorized operations, reject viewers and foreign users, and retain conflict/idempotency boundaries',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const suffix=randomUUID(),origin='http://localhost:5173',namespace='annotations-'+suffix;
 const app=createApp(pool,{origin,secret:'annotation-session-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}}),owner=request.agent(app);let id='';const accounts:string[]=[];
 try{
  const session=await owner.get('/api/session'),identity=(await owner.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:`annotation-${suffix}@example.com`,password:'annotation-test-password-long'}).expect(201)).body;accounts.push(identity.userId);
  id=(await owner.post('/api/workspaces').set('Origin',origin).set('x-csrf-token',identity.csrf).send({name:'Annotations'}).expect(201)).body.id;
  const viewer=randomUUID(),stranger=randomUUID();accounts.push(viewer,stranger);for(const user of [viewer,stranger])await pool.query('INSERT INTO accounts(id,email,password_hash) VALUES ($1,$2,$3)',[user,`${user}@example.com`,'unused']);await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[id,viewer,'viewer']);
  const state=structuredClone(seed),annotation:TextAnnotation={id:'text',kind:'text',x:20,y:30,width:320,height:100,text:'Team label',color:'auto',style:{...defaultTextStyle}};state.boards[0].annotations=[annotation];state.boards[0].background='#123456';state.boards[0].pattern='grid';
  const operation={id:randomUUID(),baseRevision:0,changes:diffWorkspace(seed,state)};
  await assert.rejects(persistOperation(pool,id,viewer,operation),(e:unknown)=>(e as {status:number}).status===403);await assert.rejects(persistOperation(pool,id,stranger,operation),(e:unknown)=>(e as {status:number}).status===404);
  const saved=await persistOperation(pool,id,identity.userId,operation);assert.equal(saved.revision,1);assert.equal((await persistOperation(pool,id,identity.userId,operation)).duplicate,true);
  const loaded=(await owner.get(`/api/workspaces/${id}`).expect(200)).body;assert.deepEqual(loaded.snapshot,state);
  const moved=structuredClone(state);moved.boards[0].annotations![0].x=100;await persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:1,changes:diffWorkspace(state,moved)});
  const styled=structuredClone(state);(styled.boards[0].annotations![0] as TextAnnotation).style.fontSize=40;const merged=await persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:1,changes:diffWorkspace(state,styled)});assert.equal(merged.snapshot.boards[0].annotations![0].x,100);
  const collision=structuredClone(state);collision.boards[0].annotations![0].x=150;await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:1,changes:diffWorkspace(state,collision)}),(e:unknown)=>(e as {status:number}).status===409);
  const invalid=structuredClone(merged.snapshot);(invalid.boards[0].annotations![0] as TextAnnotation).style.fontFamily='evil' as TextAnnotation['style']['fontFamily'];
  await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:merged.revision,changes:diffWorkspace(merged.snapshot,invalid)}),(e:unknown)=>(e as {status:number}).status===400);
  await owner.put(`/api/workspaces/${id}`).set('Origin',origin).set('x-csrf-token',identity.csrf).send({expectedRevision:merged.revision,snapshot:invalid}).expect(400);
  const unsafeBackground=structuredClone(merged.snapshot);unsafeBackground.boards[0].background='url(https://example.com)';
  await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:merged.revision,changes:diffWorkspace(merged.snapshot,unsafeBackground)}),(e:unknown)=>(e as {status:number}).status===400);
  await owner.put(`/api/workspaces/${id}`).set('Origin',origin).set('x-csrf-token',identity.csrf).send({expectedRevision:merged.revision,snapshot:unsafeBackground}).expect(400);
  assert.deepEqual((await pool.query('SELECT snapshot FROM team_workspaces WHERE id=$1',[id])).rows[0].snapshot,merged.snapshot);
 }finally{if(id)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[id]);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[accounts]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[accounts]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();}
});
