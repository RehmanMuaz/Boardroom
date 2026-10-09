import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {type AddressInfo} from 'node:net';
import {Pool} from 'pg';
import request from 'supertest';
import {WebSocket} from 'ws';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {attachRealtime} from '../server/realtime';
import {maintenance} from '../server/maintenance';
import {type Mail} from '../server/mail';
import {type LogEvent} from '../server/observability';
import {hashToken} from '../server/security';
import {config} from '../server/config';
import {seed} from '../src/model';

test('verification, recovery, invitation delivery, token races and session/socket revocation',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);
 const origin='http://localhost:5173',namespace='production-'+randomUUID(),mail:Mail[]=[],logs:LogEvent[]=[],suffix=randomUUID();
 const app=createApp(pool,{secret:'production-test-session-secret-long-enough',origin,requireVerification:true,rateNamespace:namespace,rateLimit:100,mailer:{async send(message){mail.push(message);}},log:event=>logs.push(event)});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const realtime=attachRealtime(server,app,pool,origin);
 const owner=request.agent(app),other=request.agent(app),ids:string[]=[],sockets:WebSocket[]=[];let workspaceId='';
 const post=(agent:typeof owner,path:string,csrf:string,body:object)=>agent.post('/api'+path).set('Origin',origin).set('x-csrf-token',csrf).send(body);
 const token=(message:Mail)=>message.text.match(/(?:verify|reset|invite)=([a-f0-9]{64})/)![1];
 async function register(agent:typeof owner,name:string){const csrf=(await agent.get('/api/session')).body.csrf;const result=await post(agent,'/auth/register',csrf,{email:`${name}-${suffix}@example.com`,password:'original-test-password'}).expect(201);ids.push(result.body.userId);return {id:result.body.userId,csrf:result.body.csrf,email:`${name}-${suffix}@example.com`,cookie:result.headers['set-cookie'][0].split(';')[0]};}
 try{
  const identity=await register(owner,'owner'),verify=token(mail[0]);
  workspaceId=randomUUID();await pool.query('INSERT INTO team_workspaces(id,name,snapshot) VALUES ($1,$2,$3)',[workspaceId,'Preverification fixture',JSON.stringify(seed)]);await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[workspaceId,identity.id,'owner']);
  await owner.get('/api/workspaces').expect(403);await post(owner,'/workspaces',identity.csrf,{name:'Blocked'}).expect(403);
  // A valid session still cannot subscribe to data before email verification.
  const denied=new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/live`,{headers:{Origin:origin,Cookie:identity.cookie}});sockets.push(denied);
  const deniedMessages:Record<string,unknown>[]=[];denied.on('message',raw=>deniedMessages.push(JSON.parse(raw.toString())));await new Promise<void>((resolve,reject)=>{denied.once('open',resolve);denied.once('error',reject);});
  const closed=new Promise(resolve=>denied.once('close',resolve));denied.send(JSON.stringify({type:'subscribe',workspaceId,csrf:identity.csrf}));await closed;assert.equal(deniedMessages.find(m=>m.type==='error')?.status,403);assert.ok(!deniedMessages.some(m=>m.type==='snapshot'));
  await post(owner,'/auth/reset',identity.csrf,{token:verify,password:'wrong-purpose-password'}).expect(400);
  await owner.post('/api/auth/verify').set('Origin','http://evil.example').set('x-csrf-token',identity.csrf).send({token:verify}).expect(403);
  const race=await Promise.all([post(owner,'/auth/verify',identity.csrf,{token:verify}),post(owner,'/auth/verify',identity.csrf,{token:verify})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);
  assert.equal((await owner.get('/api/session')).body.emailVerified,true);await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);workspaceId=(await post(owner,'/workspaces',identity.csrf,{name:'Verified team'}).expect(201)).body.id;
  const recipient=await register(other,'recipient');await post(other,'/auth/verify',recipient.csrf,{token:token(mail.at(-1)!)}).expect(200);
  await post(other,`/workspaces/${workspaceId}/invitations`,recipient.csrf,{email:'no@example.com',role:'editor'}).expect(404);const before=mail.length;
  const invite=await post(owner,`/workspaces/${workspaceId}/invitations`,identity.csrf,{email:recipient.email,role:'viewer'}).expect(201);assert.equal(invite.body.delivery,'sent');assert.equal(mail.length,before+1);assert.equal(token(mail.at(-1)!),invite.body.token);
  await post(other,'/invitations/accept',recipient.csrf,{token:invite.body.token}).expect(200);await other.get(`/api/workspaces/${workspaceId}`).expect(200);
  // An existing subscription is closed before a successful reset response.
  const active=new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/live`,{headers:{Origin:origin,Cookie:identity.cookie}});sockets.push(active);
  const snapshot=new Promise<void>(resolve=>active.on('message',raw=>{if(JSON.parse(raw.toString()).type==='snapshot')resolve();}));await new Promise<void>((resolve,reject)=>{active.once('open',resolve);active.once('error',reject);});active.send(JSON.stringify({type:'subscribe',workspaceId,csrf:identity.csrf}));await snapshot;
  const unknown=await post(other,'/auth/reset/request',recipient.csrf,{email:`absent-${suffix}@example.com`}).expect(202),known=await post(other,'/auth/reset/request',recipient.csrf,{email:identity.email}).expect(202);assert.deepEqual(unknown.body,known.body);
  const reset=token(mail.at(-1)!);await post(other,'/auth/verify',recipient.csrf,{token:reset}).expect(400);
  const revoked=new Promise<void>(resolve=>active.on('message',raw=>{if(JSON.parse(raw.toString()).type==='revoked')resolve();}));
  const resets=await Promise.all([post(other,'/auth/reset',recipient.csrf,{token:reset,password:'new-secure-test-password'}),post(other,'/auth/reset',recipient.csrf,{token:reset,password:'new-secure-test-password'})]);assert.deepEqual(resets.map(r=>r.status).sort(),[200,400]);await revoked;
  await owner.get(`/api/workspaces/${workspaceId}`).expect(401);assert.equal(Number((await pool.query("SELECT count(*) FROM session WHERE sess->>'userId'=$1",[identity.id])).rows[0].count),0);
  // A delayed middleware save cannot revive a pre-reset session.
  const oldSid=decodeURIComponent(identity.cookie.split('=')[1]).slice(2).split('.')[0];await pool.query("INSERT INTO session(sid,sess,expire) VALUES ($1,$2,now()+interval '1 day')",[oldSid,JSON.stringify({cookie:{originalMaxAge:86400000,expires:new Date(Date.now()+86400000).toISOString(),httpOnly:true,sameSite:'lax'},userId:identity.id,csrf:identity.csrf,authVersion:0})]);await owner.get(`/api/workspaces/${workspaceId}`).expect(401);assert.equal((await owner.get('/api/session')).body.userId,null);
  const session=(await owner.get('/api/session')).body;await post(owner,'/auth/login',session.csrf,{email:identity.email,password:'original-test-password'}).expect(401);
  const signed=await post(owner,'/auth/login',session.csrf,{email:identity.email,password:'new-secure-test-password'}).expect(200);await owner.get(`/api/workspaces/${workspaceId}`).expect(200);
  await post(owner,'/auth/reset/request',signed.body.csrf,{email:identity.email}).expect(202);const expired=token(mail.at(-1)!);await pool.query('UPDATE account_tokens SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1',[hashToken(expired)]);await post(owner,'/auth/reset',signed.body.csrf,{token:expired,password:'must-not-change-password'}).expect(400);
  const encoded=JSON.stringify(logs);for(const message of mail)assert.ok(!encoded.includes(token(message)));assert.ok(!encoded.includes(identity.email));assert.ok(!encoded.includes('password'));assert.ok(logs.every(log=>!log.path?.includes('?')));
  const hashes=(await pool.query('SELECT token_hash FROM account_tokens WHERE user_id=ANY($1::uuid[])',[ids])).rows;assert.ok(hashes.every(row=>mail.every(message=>row.token_hash!==token(message))));
 }finally{
  sockets.forEach(socket=>socket.terminate());await realtime.close();await new Promise<void>(resolve=>server.close(()=>resolve()));
  if(workspaceId)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[ids]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();
 }
});

test('rate limits persist across API instances, ignore untrusted proxy headers and expire safely',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const namespace='limits-'+randomUUID(),origin='http://localhost:5173';
 const options={secret:'rate-test-secret-at-least-32-characters',origin,rateNamespace:namespace,rateLimit:2,log:()=>{}},a=request.agent(createApp(pool,options)),b=request.agent(createApp(pool,options));
 const call=async(agent:typeof a,forwarded:string)=>{const csrf=(await agent.get('/api/session')).body.csrf;return agent.post('/api/auth/login').set('Origin',origin).set('x-csrf-token',csrf).set('X-Forwarded-For',forwarded).send({email:'missing@example.com',password:'missing-test-password'});};
 try{
  assert.equal((await call(a,'1.2.3.4')).status,401);assert.equal((await call(b,'9.8.7.6')).status,401);const limited=await call(a,'6.7.8.9');assert.equal(limited.status,429);assert.ok(Number(limited.headers['retry-after'])>0);
  await pool.query('UPDATE auth_rate_limits SET expires_at=now()-interval \'1 second\' WHERE key LIKE $1',[namespace+':%']);assert.equal((await call(b,'1.1.1.1')).status,401);
  await a.get('/health/live').expect(200);await b.get('/health/ready').expect(200);
 }finally{await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();await b.get('/health/ready').expect(503);await b.get('/health/live').expect(200);}
});

test('production configuration requires HTTPS, secure cookies and verification email configuration',()=>{
 const base={DATABASE_URL:'postgresql://localhost/test',SESSION_SECRET:'config-test-secret-at-least-32-characters'};
 assert.throws(()=>config({...base,NODE_ENV:'production'}),/HTTPS/);
 assert.throws(()=>config({...base,REQUIRE_EMAIL_VERIFICATION:'true'}),/SMTP/);
 assert.throws(()=>config({...base,TRUST_PROXY:'1'}),/trusted proxy/);
 assert.throws(()=>config({...base,APP_ORIGIN:'https://example.com/path'}),/exact/);
 assert.equal(config({...base,NODE_ENV:'production',APP_ORIGIN:'https://example.com',COOKIE_SECURE:'true'}).production,true);
});

test('maintenance removes expired sessions/tokens/limits while retaining active data and invitation grace',async()=>{
 const url=process.env.TEST_DATABASE_URL??process.env.DATABASE_URL,pool=new Pool({connectionString:url}),schema='maintenance_'+randomUUID().replaceAll('-','');
 await pool.query(`CREATE SCHEMA ${schema}`);const isolated=new Pool({connectionString:url,options:'-c search_path='+schema});
 try{
  await isolated.query(`CREATE TABLE session(sid text,sess json,expire timestamp);
   CREATE TABLE auth_rate_limits(key text,expires_at timestamptz);
   CREATE TABLE account_tokens(id uuid,expires_at timestamptz);
   CREATE TABLE team_invitations(id uuid,expires_at timestamptz);`);
  await isolated.query("INSERT INTO session VALUES ('expired','{}',now()-interval '1 day'),('active','{}',now()+interval '1 day')");
  await isolated.query("INSERT INTO auth_rate_limits VALUES ('expired',now()-interval '1 day'),('active',now()+interval '1 day')");
  await isolated.query("INSERT INTO account_tokens VALUES ($1,now()-interval '1 day'),($2,now()+interval '1 day')",[randomUUID(),randomUUID()]);
  await isolated.query("INSERT INTO team_invitations VALUES ($1,now()-interval '8 days'),($2,now()-interval '3 days')",[randomUUID(),randomUUID()]);
  assert.deepEqual(await maintenance(isolated),{sessions:1,limits:1,tokens:1,invites:1});assert.equal((await isolated.query('SELECT sid FROM session')).rows[0].sid,'active');assert.equal((await isolated.query('SELECT key FROM auth_rate_limits')).rows[0].key,'active');assert.equal((await isolated.query('SELECT id FROM team_invitations')).rowCount,1);
 }finally{await isolated.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();}
});
