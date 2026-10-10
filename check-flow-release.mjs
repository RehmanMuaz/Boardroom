// Run backend acceptance in a new database, never the configured development DB.
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
const source=process.env.DATABASE_URL;
if(!source)throw Error('Load the local DATABASE_URL privately before running');
const url=new URL(source);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Acceptance runner requires a local PostgreSQL host');
const name='flow_acceptance_'+randomUUID().replaceAll('-','');
const admin=new Pool({connectionString:source,connectionTimeoutMillis:5000});
let created=false;
try{
 await admin.query('CREATE DATABASE "'+name+'"');created=true;
 url.pathname='/'+name;
 const files=(await readdir('tests')).filter(f=>/\.test\.(ts|mjs)$/.test(f)).map(f=>'tests/'+f);
 const args=process.argv.includes('--browser')?['node_modules/@playwright/test/cli.js','test','--config','flow-browser.config.ts']:['--import','tsx','--test',...files];
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env:{...process.env,DATABASE_URL:url.href,TEST_DATABASE_URL:url.href},stdio:'inherit',windowsHide:true});
  child.once('error',reject);child.once('exit',resolve);
 });
 process.exitCode=code??1;
}finally{
 if(created){await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');}
 await admin.end();
}
