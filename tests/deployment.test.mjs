import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deploymentOptions,deploy} from '../scripts/deploy.mjs';
import {deploymentTarget} from '../scripts/compose-config.mjs';

test('Traefik deployments select the shared proxy stack and reject unknown configurations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'boardroom-traefik-')),envFile=join(root,'config');
 try{
  await writeFile(envFile,'DEPLOY_PROXY=traefik\n');
  const target=await deploymentTarget(envFile,root);assert.equal(target.file,join(root,'deploy','compose.traefik.yaml'));assert.deepEqual(target.services,['postgres','api']);
  const calls=[];await deploy({envFile,project:'boardroom-test',image},async(command,args)=>{calls.push(args);return '';},root);
  const update=calls.find(args=>args.includes('up'));assert.ok(update.includes(target.file));assert.ok(!update.includes('proxy'));
  await writeFile(envFile,'DEPLOY_PROXY=unknown\n');
  await assert.rejects(deploy({envFile,project:'boardroom-test',image},async()=>assert.fail('Must reject before invoking Docker'),root),/DEPLOY_PROXY/);
  await assert.rejects(readFile(join(root,'.deployment.lock')));
 }finally{await rm(root,{recursive:true,force:true});}
});

const image='ghcr.io/example/boardroom@sha256:'+'a'.repeat(64);
test('deployment rejects mutable images, duplicate flags and unsafe project names',()=>{
 const args=['--env-file','config','--project','boardroom-production','--image',image];assert.equal(deploymentOptions(args).image,image);
 for(const value of ['ghcr.io/example/boardroom:latest','bad;command',image+'\nEXTRA=1'])assert.throws(()=>deploymentOptions([...args.slice(0,-1),value]));
 assert.throws(()=>deploymentOptions([...args,'--image',image]));assert.throws(()=>deploymentOptions(['--env-file','config','--project','bad/project','--image',image]));
});

test('deployment backs up with the existing image, gates release state on readiness, and releases its lock',async()=>{
 const root=await mkdtemp(join(tmpdir(),'boardroom-deploy-')),envFile=join(root,'config');await writeFile(envFile,'test configuration');
 const options={envFile,project:'boardroom-test',image};
 try{
  const calls=[];const execute=async(command,args,env)=>{calls.push({command,args,env});if(args.includes('--quiet'))return 'container-id';if(args.includes('{{.Config.Image}}'))return 'old-image';if(args.includes('{{.State.Running}}'))return 'true';return '';};
  await deploy(options,execute,root);
  const backup=calls.find(c=>c.args.includes('backup'));assert.ok(backup);assert.equal(backup.env.BOARDROOM_IMAGE,'old-image');
  assert.ok(calls.findIndex(c=>c.args.includes('backup'))<calls.findIndex(c=>c.args.includes('up')));
  const update=calls.find(c=>c.args.includes('up'));assert.ok(update.args.includes('--no-build'));assert.ok(update.args.includes('--wait'));assert.equal(update.env.BOARDROOM_IMAGE,image);
  assert.equal(await readFile(join(root,'.release.env'),'utf8'),`BOARDROOM_IMAGE=${image}\n`);
  await assert.rejects(readFile(join(root,'.deployment.lock')));
  const failureCalls=[];await assert.rejects(deploy(options,async(command,args)=>{failureCalls.push(args);if(args.includes('--quiet'))return 'container-id';if(args.includes('{{.Config.Image}}'))return 'old-image';if(args.includes('{{.State.Running}}'))return 'true';if(args.includes('backup'))throw Error('Backup failed');return '';},root),/Backup failed/);
  assert.ok(!failureCalls.some(args=>args.includes('up')));
  await assert.rejects(deploy({...options,image:image.replace(/a/g,'b')},async(command,args)=>{if(args.includes('--quiet'))return '';if(args.includes('up'))throw Error('Not ready');return '';},root),/Not ready/);
  assert.equal(await readFile(join(root,'.release.env'),'utf8'),`BOARDROOM_IMAGE=${image}\n`);
  await writeFile(join(root,'.deployment.lock'),'locked');await assert.rejects(deploy(options,execute,root),/Another deployment/);
 }finally{await rm(root,{recursive:true,force:true});}
});
