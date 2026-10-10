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
import {makeShape} from '../src/annotations';
import {dropIntoColumn,reorderLayers,columnSummary} from '../src/features/canvas/organization';

test('checklist titles, labels, layers and column membership persist through authorized operations and HTTP; invalid or competing edits fail',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);
 const suffix=randomUUID(),origin='http://localhost:5173',namespace='organization-'+suffix;
 const app=createApp(pool,{origin,secret:'organization-test-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}}),owner=request.agent(app);let id='';const accounts:string[]=[];
 try{
  const session=await owner.get('/api/session'),identity=(await owner.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email:`organization-${suffix}@example.com`,password:'organization-test-password-long'}).expect(201)).body;accounts.push(identity.userId);
  id=(await owner.post('/api/workspaces').set('Origin',origin).set('x-csrf-token',identity.csrf).send({name:'Organization'}).expect(201)).body.id;
  const viewer=randomUUID(),stranger=randomUUID();accounts.push(viewer,stranger);
  for(const user of [viewer,stranger])await pool.query('INSERT INTO accounts(id,email,password_hash) VALUES ($1,$2,$3)',[user,`${user}@example.com`,'unused']);
  await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[id,viewer,'viewer']);
  const state=structuredClone(seed);state.boards[0].cards[2].title='Deliverables';state.boards[0].cards[0].labels=[{id:'review',text:'Review',color:'#e3efe9'}];
  state.boards[0].cards.push({id:'column',kind:'column',text:'Production',color:'#fff',x:1000,y:20});state.boards[0].annotations=[makeShape('shape','rectangle',[40,40],[200,200],'#abc',2)];
  state.boards[0].connectors=[{id:'line',from:'welcome',to:'todo',color:'#789180'}];
  const grouped=reorderLayers(dropIntoColumn(state,'home',['welcome','todo','project'],'column'),'home',['todo'],'front');
  const operation={id:randomUUID(),baseRevision:0,changes:diffWorkspace(seed,grouped)};
  await assert.rejects(persistOperation(pool,id,viewer,operation),(e:unknown)=>(e as {status:number}).status===403);
  await assert.rejects(persistOperation(pool,id,stranger,operation),(e:unknown)=>(e as {status:number}).status===404);
  const saved=await persistOperation(pool,id,identity.userId,operation);assert.deepEqual((await owner.get(`/api/workspaces/${id}`).expect(200)).body.snapshot,grouped);assert.equal(columnSummary(saved.snapshot.boards[0],'column'),'2 cards, 1 board');
  const labels=structuredClone(grouped);labels.boards[0].cards[0].labels![0].text='Approved';const labelOp={id:randomUUID(),baseRevision:saved.revision,changes:diffWorkspace(grouped,labels)};
  const edited=await persistOperation(pool,id,identity.userId,labelOp);assert.equal((await persistOperation(pool,id,identity.userId,labelOp)).duplicate,true);
  const text=structuredClone(grouped);text.boards[0].cards[0].text='Independent text edit';const merged=await persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:saved.revision,changes:diffWorkspace(grouped,text)});assert.equal(merged.snapshot.boards[0].cards[0].labels![0].text,'Approved');
  const conflict=structuredClone(grouped);conflict.boards[0].cards[0].labels![0].text='Conflicting';await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:saved.revision,changes:diffWorkspace(grouped,conflict)}),(e:unknown)=>(e as {status:number}).status===409);
  const invalid=structuredClone(merged.snapshot);invalid.boards[0].cards[0].labels![0].color='url(evil)';await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:merged.revision,changes:diffWorkspace(merged.snapshot,invalid)}),(e:unknown)=>(e as {status:number}).status===400);
  const badLayer=structuredClone(merged.snapshot);badLayer.boards[0].annotations![0].layer=30001;await assert.rejects(persistOperation(pool,id,identity.userId,{id:randomUUID(),baseRevision:merged.revision,changes:diffWorkspace(merged.snapshot,badLayer)}),(e:unknown)=>(e as {status:number}).status===400);
  const patch=await owner.patch(`/api/workspaces/${id}/boards/home/cards/todo`).set('Origin',origin).set('x-csrf-token',identity.csrf).send({expectedRevision:merged.revision,patch:{title:'Shot list',layer:100}}).expect(200);
  await owner.patch(`/api/workspaces/${id}/boards/home/cards/welcome`).set('Origin',origin).set('x-csrf-token',identity.csrf).send({expectedRevision:patch.body.revision,patch:{labels:[{id:'http-label',text:'Final',color:'#123456'}]}}).expect(200);
  const loaded=(await owner.get(`/api/workspaces/${id}`).expect(200)).body.snapshot;assert.equal(loaded.boards[0].cards[2].title,'Shot list');assert.equal(loaded.boards[0].cards[0].labels[0].text,'Final');assert.ok(edited.revision>saved.revision);
 }finally{
  if(id)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[id]);
  await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[accounts]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[accounts]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();
 }
});
