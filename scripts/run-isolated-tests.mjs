import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
const source=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1','[::1]'].includes(source.hostname))throw Error('Refusing nonlocal database');
const admin=new pg.Pool({connectionString:source.href,connectionTimeoutMillis:2000});
const name='boardroom_flow_test_'+randomUUID().replaceAll('-','');
const target=new URL(source);target.pathname='/'+name;
let created=false;
try{
 await admin.query(`CREATE DATABASE "${name}"`);created=true;
 console.log('Running checks against a new disposable local database.');
 const args=process.argv.slice(2);
 const childEnv={...process.env,DATABASE_URL:target.href,TEST_DATABASE_URL:target.href};
 const child=args.length?spawn(process.execPath,['--import','tsx','--test',...args],{stdio:'inherit',env:childEnv})
  :spawn(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm.cmd test']:['test'],{stdio:'inherit',env:childEnv});
 process.exitCode=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1));});
}finally{
 if(created){
  if(!/^boardroom_flow_test_[a-f0-9]{32}$/.test(name))throw Error('Invalid disposable database name');
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  console.log('Disposable test database removed.');
 }
 await admin.end();
}
