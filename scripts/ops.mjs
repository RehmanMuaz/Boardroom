import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {deploymentTarget} from './compose-config.mjs';
const [mode,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--env-file','--project','--name'].includes(args[i])||!args[i+1])throw Error('Usage: npm run ops -- backup|check|restore --env-file FILE --project PROJECT --name NAME');options[args[i]]=args[i+1];}
if(!['backup','check','restore'].includes(mode)||!options['--env-file']||!options['--project']||!options['--name'])throw Error('Specify mode, --env-file, --project and --name explicitly.');
if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(options['--name'])||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(options['--project']))throw Error('Invalid project or backup name');
const target=await deploymentTarget(resolve(options['--env-file']));
const base=['compose','--env-file',resolve(options['--env-file']),'-f',target.file,'-p',options['--project']];
function docker(args,capture=false){return new Promise((resolve,reject)=>{
 const child=spawn('docker',[...base,...args],{stdio:capture?['ignore','pipe','inherit']:'inherit',windowsHide:true});let output='';
 if(capture)child.stdout.on('data',data=>output+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(Error('Docker command failed')));
});}
await mkdir('backups',{recursive:true});
const output=await docker(['ps','api','--format','json'],true);
const statuses=output.trim()?(output.trim().startsWith('[')?JSON.parse(output):output.trim().split('\n').map(line=>JSON.parse(line))):[];
const running=statuses.some(row=>row.State==='running');
if(mode==='restore'&&running)throw Error('Stop the target API before restoring into a fresh database and asset volume.');
if(mode==='backup'&&running)await docker(['stop','api']);
try{await docker(['run','--rm','ops',mode,options['--name']]);}
finally{if(mode==='backup'&&running)await docker(['up','-d','api']);}
