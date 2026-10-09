import {spawn} from 'node:child_process';
import {open,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deploymentTarget} from './compose-config.mjs';

export function deploymentOptions(args){
 const options={};
 for(let i=0;i<args.length;i+=2){if(!['--env-file','--project','--image'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Use --env-file FILE --project PROJECT --image IMAGE@sha256:DIGEST');options[args[i]]=args[i+1];}
 if(!options['--env-file']||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(options['--project']??'')||!/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(options['--image']??''))throw Error('Specify an environment file, valid project and immutable GHCR image digest');
 return {envFile:resolve(options['--env-file']),project:options['--project'],image:options['--image']};
}
async function run(command,args,env,capture=false){
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{env,stdio:capture?['ignore','pipe','inherit']:'inherit',windowsHide:true});let output='';if(capture)child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(output.trim()):reject(Error(`${command} failed (${code})`)));});
}
export async function deploy(options,execute=run,root=process.cwd()){
 const statePath=resolve(root,'.release.env'),lockPath=resolve(root,'.deployment.lock');
 let lock;try{lock=await open(lockPath,'wx',0o600);}catch{throw Error('Another deployment holds .deployment.lock; investigate before removing a stale lock');}
 const env={...process.env,BOARDROOM_IMAGE:options.image};
 try{
  const target=await deploymentTarget(options.envFile,root);
  const base=['compose','--env-file',options.envFile,'-f',target.file,'-p',options.project];
  // Download before pausing the API for a backup; a registry outage need not interrupt editing.
  await execute('docker',[...base,'pull','api'],env);
  const containers=await execute('docker',[...base,'ps','--all','--quiet','api'],env,true);
  const ids=containers.split(/\s+/).filter(Boolean);if(ids.length>1)throw Error('Deployment supports one API container only');
  if(ids.length){
   const previous=await execute('docker',['inspect','--format','{{.Config.Image}}',ids[0]],env,true);
   const running=await execute('docker',['inspect','--format','{{.State.Running}}',ids[0]],env,true);
   if(running!=='true')throw Error('Existing API is stopped; investigate and back up the existing installation before updating');
   const backup=`predeploy-${new Date().toISOString().replace(/[^0-9]/g,'')}`;
   await execute(process.execPath,[resolve(root,'scripts/ops.mjs'),'backup','--env-file',options.envFile,'--project',options.project,'--name',backup],{...env,BOARDROOM_IMAGE:previous});
  }
  await execute('docker',[...base,'up','-d','--no-build','--wait','--wait-timeout','180',...target.services],env);
  await writeFile(statePath+'.tmp',`BOARDROOM_IMAGE=${options.image}\n`,{mode:0o600});await rename(statePath+'.tmp',statePath);
  console.log('Deployment ready. Release recorded in .release.env.');
 }catch(error){console.error('Deployment failed. No database or media rollback was attempted. Inspect readiness and the pre-deployment backup before recovery.');throw error;}
 finally{await lock.close();await rm(lockPath,{force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await deploy(deploymentOptions(process.argv.slice(2)));}catch(error){console.error(error.message);process.exitCode=1;}
}
