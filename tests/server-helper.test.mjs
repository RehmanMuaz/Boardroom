import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('Linux helper preserves host paths and arguments, uses registry login, and stops after failed builds',{skip:process.platform==='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'boardroom helper '));
 try{
  await mkdir(join(root,'deploy/helper'),{recursive:true});await mkdir(join(root,'bin'));await mkdir(join(root,'login'));
  await copyFile(resolve('deploy/helper/Dockerfile'),join(root,'deploy/helper/Dockerfile'));
  const log=join(root,'calls');
  await writeFile(join(root,'bin/stat'),'#!/bin/sh\nprintf "0\\n"\n',{mode:0o755});
  await writeFile(join(root,'bin/docker'),'#!/bin/sh\nfor arg do printf "%s\\n" "$arg" >> "$CALL_LOG"; done\nprintf "END\\n" >> "$CALL_LOG"\nif [ "$1" = build ]; then exit "${BUILD_EXIT:-0}"; fi\n',{mode:0o755});
  const env={...process.env,PATH:join(root,'bin')+':'+process.env.PATH,DOCKER_CONFIG:join(root,'login'),CALL_LOG:log};
  const script=resolve('scripts/server-helper.sh');
  const result=spawnSync('sh',[script,'deploy','--env-file','private config','--image','immutable-image'],{cwd:root,env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const calls=(await readFile(log,'utf8')).trim().split('\n');
  assert.ok(calls.includes(`type=bind,src=${root},dst=${root}`));assert.ok(calls.includes(root));
  assert.ok(calls.includes(`type=bind,src=${join(root,'login')},dst=/docker-config,readonly`));assert.ok(calls.includes('--user'));assert.ok(calls.includes('--group-add'));
  assert.ok(calls.includes('scripts/deploy.mjs'));assert.ok(calls.includes('private config'));assert.ok(calls.includes('--env-file-if-exists=.release.env'));
  await writeFile(log,'');assert.equal(spawnSync('sh',[script,'ops','backup'],{cwd:root,env:{...env,BUILD_EXIT:'42'}}).status,42);
  assert.ok(!(await readFile(log,'utf8')).split('\n').includes('run'));
  assert.equal(spawnSync('sh',[script,'invalid'],{cwd:root,env}).status,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
