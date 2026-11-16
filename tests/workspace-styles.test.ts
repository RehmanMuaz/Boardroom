import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {seed,validWorkspace,type Workspace} from '../src/model';
import {defaultWorkspaceStyle} from '../src/style-schema';
import {resolveStyledBoard,linkStyle,patchStyledCard,patchStyledAnnotation,styleValues} from '../src/workspaceStyles';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {persistOperation} from '../server/operations';
import {defaultTextStyle} from '../src/annotations';

test('style adoption preserves legacy content, inheritance and overrides resolve without mutating snapshots, and operations support undo/conflicts',()=>{
 const legacy=structuredClone(seed),styled:Workspace={...structuredClone(legacy),workspaceStyle:structuredClone(defaultWorkspaceStyle)};assert.ok(validWorkspace(styled));assert.deepEqual(resolveStyledBoard(styled,styled.boards[0]),legacy.boards[0]);
 let linked=linkStyle(styled,'home',['welcome'],'body');linked.boards[0].boardStyle={roles:{body:{fontSize:30}}};let resolved=resolveStyledBoard(linked,linked.boards[0]);assert.equal(resolved.cards[0].styleBinding?.overrides?.fontSize,30);
 linked.boards[0].cards[0]=patchStyledCard(linked.boards[0].cards[0],{color:'#123456'});linked.workspaceStyle!.roles.body.fontSize=42;resolved=resolveStyledBoard(linked,linked.boards[0]);assert.equal(resolved.cards[0].color,'#123456');assert.equal(resolved.cards[0].styleBinding!.overrides!.fontSize,30);
 const workspaceOnly=linkStyle(linked,'home',['welcome'],'body','workspace');assert.equal(resolveStyledBoard(workspaceOnly,workspaceOnly.boards[0]).cards[0].styleBinding!.overrides!.fontSize,42);assert.equal(resolveStyledBoard(workspaceOnly,workspaceOnly.boards[0]).cards[0].color,'#ffffff');assert.equal(legacy.boards[0].cards[0].color,'#fff');
 const changes=diffWorkspace(legacy,linked);assert.deepEqual(applyChanges(legacy,changes),linked);assert.deepEqual(applyChanges(linked,diffWorkspace(linked,legacy)),legacy);const competing={...linked,workspaceStyle:{...linked.workspaceStyle!,name:'Remote'}};assert.throws(()=>applyChanges(competing,diffWorkspace(linked,legacy)),OperationConflict);
 const annotation={id:'a',kind:'text' as const,x:10,y:10,width:240,height:120,color:'auto',text:'Text',style:{...defaultTextStyle},styleBinding:{role:'body' as const}};const visible={...annotation,style:{...defaultTextStyle,fontSize:42}};const edited=patchStyledAnnotation(annotation,{style:{...visible.style,italic:true}},visible);assert.deepEqual(edited.kind==='text'&&edited.styleBinding?.overrides,{italic:true});assert.equal(styleValues(linked,linked.boards[0],{role:'body'}).fontSize,30);
 assert.equal(validWorkspace({...linked,workspaceStyle:{...linked.workspaceStyle,pattern:['dots']}}),false);assert.equal(validWorkspace({...linked,workspaceStyle:{...linked.workspaceStyle,roles:{...linked.workspaceStyle!.roles,body:{...linked.workspaceStyle!.roles.body,fontFamily:['sans']}}}}),false);
 const bad=structuredClone(linked);bad.workspaceStyle!.roles.body.fontSize=999;assert.equal(validWorkspace(bad),false);assert.equal(validWorkspace({...legacy,workspaceStyle:{...defaultWorkspaceStyle,extra:true}}),false);
});

test('workspace styles persist with owner-only root changes; editors retain local overrides and viewers/foreign users are denied',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const origin='http://localhost:5173',namespace='styles-'+randomUUID(),app=createApp(pool,{origin,secret:'styles-session-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}}),agents=[request.agent(app),request.agent(app),request.agent(app),request.agent(app)],users:{userId:string;csrf:string}[]=[];let id='';
 try{
  for(const agent of agents){const s=await agent.get('/api/session');users.push((await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',s.body.csrf).send({email:randomUUID()+'@example.com',password:'workspace-style-test-password'}).expect(201)).body);}
  id=(await agents[0].post('/api/workspaces').set('Origin',origin).set('x-csrf-token',users[0].csrf).send({name:'Styles'}).expect(201)).body.id;await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'editor'),($1,$3,'viewer')",[id,users[1].userId,users[2].userId]);
  const original=(await agents[0].get('/api/workspaces/'+id)).body.snapshot as Workspace,styled={...structuredClone(original),workspaceStyle:structuredClone(defaultWorkspaceStyle)},put=(index:number,snapshot:Workspace,revision:number)=>agents[index].put('/api/workspaces/'+id).set('Origin',origin).set('x-csrf-token',users[index].csrf).send({snapshot,expectedRevision:revision});
  await put(1,styled,0).expect(403);await put(2,styled,0).expect(403);await put(3,styled,0).expect(404);await put(0,styled,0).expect(200);const loaded=(await agents[2].get('/api/workspaces/'+id)).body;assert.deepEqual(loaded.snapshot.boards,original.boards);
  const altered={...structuredClone(styled),workspaceStyle:{...styled.workspaceStyle,name:'New default'}};const rootChanges=diffWorkspace(styled,altered);for(const index of [1,2,3])await assert.rejects(persistOperation(pool,id,users[index].userId,{id:randomUUID(),baseRevision:1,changes:rootChanges}),e=>(e as {status:number}).status===(index===3?404:403));
  const changed=await persistOperation(pool,id,users[0].userId,{id:randomUUID(),baseRevision:1,changes:rootChanges});const bound=linkStyle(changed.snapshot,'home',['welcome'],'body');bound.boards[0].boardStyle={roles:{body:{fontSize:28}}};const local=await persistOperation(pool,id,users[1].userId,{id:randomUUID(),baseRevision:changed.revision,changes:diffWorkspace(changed.snapshot,bound)});assert.equal(local.snapshot.boards[0].boardStyle?.roles?.body?.fontSize,28);
  await put(1,{...local.snapshot,workspaceStyle:undefined},local.revision).expect(403);await put(0,{...local.snapshot,workspaceStyle:{...local.snapshot.workspaceStyle!,name:'Updated'}},local.revision).expect(200);const stored=(await agents[2].get('/api/workspaces/'+id)).body.snapshot;assert.equal(stored.workspaceStyle.name,'Updated');assert.equal(stored.boards[0].cards[0].styleBinding.role,'body');const revision=(await agents[0].get('/api/workspaces/'+id)).body.revision;
  const scoped=await agents[1].patch(`/api/workspaces/${id}/boards/home/cards/welcome`).set('Origin',origin).set('x-csrf-token',users[1].csrf).send({expectedRevision:revision,patch:{styleBinding:{role:'caption',overrides:{fontSize:27}}}}).expect(200);await agents[1].patch(`/api/workspaces/${id}/boards/home/cards/welcome`).set('Origin',origin).set('x-csrf-token',users[1].csrf).send({expectedRevision:scoped.body.revision,patch:{styleBinding:{role:'caption',overrides:{fontFamily:['sans']}}}}).expect(400);

 }finally{if(id)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[id]);const ids=users.map(u=>u.userId);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[ids]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();}
});
