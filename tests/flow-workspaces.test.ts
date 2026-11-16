import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {type Pool} from 'pg';
import {withFlow,flowSettings} from '../server/flow-integration';
import {hashToken} from '../server/security';
import {seed} from '../src/model';
import {defaultWorkspaceStyle} from '../src/style-schema';

const id=randomUUID(),other=randomUUID(),token='a'.repeat(64),email='flow@example.com';
function fixture(enabled=true){
 const row={id,name:'Production',revision:4,role:'owner',email_verified_at:new Date(),snapshot:structuredClone(seed)};
 let member=true;const queries:{sql:string;args:unknown[]}[]=[];
 const pool={query:async(sql:string,args:unknown[])=>{
  queries.push({sql,args});assert.match(sql,/^SELECT /);
  if(sql.includes('FROM team_assets')){assert.equal(args[0],id);return {rows:[]};}
  assert.ok(args.includes(email));
  assert.deepEqual(args[1],[id]);assert.match(sql,/JOIN memberships/);assert.match(sql,/JOIN accounts/);
  return {rows:member?[row]:[]};
 }} as unknown as Pool;
 const base=express();
 base.locals.sessionMiddleware=(_req:unknown,_res:unknown,next:()=>void)=>next();
 const app=withFlow(base,pool,{tokenHash:hashToken(token),email,origin:'https://example.invalid',requireVerification:true,workspaceIds:enabled?[id]:[]});
 const get=(path:string)=>request(app).get('/api/flow/workspaces'+path).set('Authorization','Bearer '+token);
 const change={boardId:'home',cardId:'welcome',field:'text',before:seed.boards[0].cards[0].text,after:'Proposed revised text'};
 const preview=(body:object={id:randomUUID(),baseRevision:4,changes:[change]})=>request(app).post('/api/flow/workspaces/'+id+'/preview').set('Authorization','Bearer '+token).send(body);
 return {row,queries,get,preview,app,change,revoke:()=>{member=false;}};
}

test('Flow read scope is separately opted in and strict',()=>{
 assert.deepEqual(flowSettings({FLOW_IMPORT_TOKEN_SHA256:'a'.repeat(64)},'https://example.invalid')?.workspaceIds,[]);
 assert.deepEqual(flowSettings({FLOW_IMPORT_TOKEN_SHA256:'a'.repeat(64),FLOW_WORKSPACE_IDS:id+','+id},'https://example.invalid')?.workspaceIds,[id]);
 assert.throws(()=>flowSettings({FLOW_IMPORT_TOKEN_SHA256:'a'.repeat(64),FLOW_WORKSPACE_IDS:'*'},'https://example.invalid'));
});

test('Flow reads reject credentials, disabled scope and foreign IDs before database reads',async()=>{
 const f=fixture(false);
 await request(f.app).get('/api/flow/workspaces').expect(401);
 await request(f.app).get('/api/flow/workspaces').set('Authorization','Bearer '+'b'.repeat(64)).expect(401);
 await f.get('').expect(403);assert.equal(f.queries.length,0);
 const scoped=fixture();await scoped.get('/'+other).expect(404);assert.equal(scoped.queries.length,0);
 await scoped.get('/invalid').expect(400);
});

test('Flow reads recheck current membership, verification and never mutate',async()=>{
 const f=fixture();
 const listed=(await f.get('').expect(200)).body;assert.equal(listed.records_changed,0);
 const result=(await f.get('/'+id).expect(200)).body;assert.equal(result.revision,4);assert.deepEqual(result.workspace,seed);
 f.row.email_verified_at=null as unknown as Date;await f.get('/'+id).expect(404);
 f.row.email_verified_at=new Date();f.revoke();await f.get('/'+id).expect(404);
});

test('Flow previews exact field changes without saving and rejects conflicts and invalid results',async()=>{
 const f=fixture(),original=structuredClone(f.row.snapshot);
 const result=(await f.preview().expect(200)).body;
 assert.equal(result.status,'preview_only');assert.equal(result.ready_to_apply,false);assert.equal(result.records_changed,0);
 assert.deepEqual(result.changes,[f.change]);assert.deepEqual(f.row.snapshot,original);
 await f.preview({id:randomUUID(),baseRevision:3,changes:[f.change]}).expect(409);
 await f.preview({id:randomUUID(),baseRevision:4,changes:[{...f.change,before:'Different manual edit'}]}).expect(409);
 await f.preview({id:randomUUID(),baseRevision:4,changes:[{...f.change,field:'color',before:'#fff',after:'javascript:bad'}]}).expect(400);
 await f.preview({id:randomUUID(),baseRevision:4,changes:[f.change],approve:true}).expect(400);
 await f.preview({id:randomUUID(),baseRevision:4,changes:Array(101).fill(f.change)}).expect(400);
 await f.preview({id:randomUUID(),baseRevision:4,changes:[{boardId:'home',cardId:'foreign-media',field:'$card',before:null,
  after:{id:'foreign-media',kind:'image',assetId:randomUUID(),x:0,y:0,text:'Foreign',color:'#fff'}}]}).expect(400);
 f.row.role='viewer';await f.preview().expect(403);
 f.revoke();await f.preview().expect(404);
});

test('Flow preview preserves owner-only workspace styles',async()=>{
 const f=fixture();f.row.role='editor';
 await f.preview({id:randomUUID(),baseRevision:4,changes:[{boardId:'*',field:'$workspaceStyle',before:null,after:defaultWorkspaceStyle}]}).expect(403);
});
