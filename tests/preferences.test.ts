import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import request from 'supertest';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';

test('account themes persist across sessions, isolate users, validate input and reject revoked sessions',async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);
 const origin='http://localhost:5173',suffix=randomUUID(),namespace='themes-'+suffix;
 const options={origin,secret:'theme-test-session-secret-at-least-32-characters',rateNamespace:namespace,log:()=>{}};
 const app=createApp(pool,options),one=request.agent(app),two=request.agent(app);
 const emails=[`theme-one-${suffix}@example.com`,`theme-two-${suffix}@example.com`];
 async function register(agent:typeof one,email:string){const session=await agent.get('/api/session');return (await agent.post('/api/auth/register').set('Origin',origin).set('x-csrf-token',session.body.csrf).send({email,password:'theme-test-password-long'}).expect(201)).body;}
 try{
  const a=await register(one,emails[0]);await register(two,emails[1]);
  const patch=(body:object)=>one.patch('/api/account/preferences').set('Origin',origin).set('x-csrf-token',a.csrf).send(body);
  const anon=request.agent(app),csrf=(await anon.get('/api/session')).body.csrf;
  await anon.patch('/api/account/preferences').set('Origin',origin).set('x-csrf-token',csrf).send({theme:'dark'}).expect(401);
  await one.patch('/api/account/preferences').send({theme:'dark'}).expect(403);
  await one.patch('/api/account/preferences').set('Origin','https://evil.example').set('x-csrf-token',a.csrf).send({theme:'dark'}).expect(403);
  assert.equal((await one.get('/api/session')).body.theme,'system');
  for(const body of [{theme:'invalid'},{theme:'dark',userId:a.userId},{theme:null},{}])await patch(body).expect(400);
  await patch({theme:'dark'}).expect(200);assert.equal((await two.get('/api/session')).body.theme,'system');
  const otherDevice=request.agent(createApp(pool,options)),s=(await otherDevice.get('/api/session')).body;
  await otherDevice.post('/api/auth/login').set('Origin',origin).set('x-csrf-token',s.csrf).send({email:emails[0],password:'theme-test-password-long'}).expect(200);
  assert.equal((await otherDevice.get('/api/session')).body.theme,'dark');
  const stored=await pool.query('SELECT theme FROM accounts WHERE id=$1',[a.userId]);assert.equal(stored.rows[0].theme,'dark');
  await pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[a.userId]);
  await patch({theme:'light'}).expect(401);assert.equal((await one.get('/api/session')).body.theme,null);
  assert.equal((await pool.query('SELECT theme FROM accounts WHERE id=$1',[a.userId])).rows[0].theme,'dark');
  // Personal appearance is available before email verification, while team access stays blocked.
  const verifiedApp=createApp(pool,{...options,requireVerification:true}),unverified=request.agent(verifiedApp);
  const us=(await unverified.get('/api/session')).body;const login=(await unverified.post('/api/auth/login').set('Origin',origin).set('x-csrf-token',us.csrf).send({email:emails[1],password:'theme-test-password-long'}).expect(200)).body;
  await unverified.patch('/api/account/preferences').set('Origin',origin).set('x-csrf-token',login.csrf).send({theme:'light'}).expect(200);
  await unverified.get('/api/workspaces').expect(403);
 }finally{
  await pool.query("DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM accounts WHERE email=ANY($1::text[]))",[emails]);
  await pool.query('DELETE FROM accounts WHERE email=ANY($1::text[])',[emails]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();
 }
});
