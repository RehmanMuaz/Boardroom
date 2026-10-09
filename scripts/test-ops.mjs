// Local acceptance drill. Uses isolated Compose projects, loopback ports and fresh volumes.
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile,mkdir,cp,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {request,chromium} from '@playwright/test';
import sharp from 'sharp';
const id=randomUUID().slice(0,8),source='boardroom-drill-'+id,target='boardroom-restore-'+id,name='drill-'+id;
const directory=resolve('.deploy-test',id);await mkdir(directory,{recursive:true});
const password=randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex'),envFile=resolve(directory,'.env');
await writeFile(envFile,`POSTGRES_PASSWORD=${password}\nCONTAINER_DATABASE_URL=postgresql://boardroom:${password}@postgres:5432/boardroom\nSESSION_SECRET=${secret}\nSITE_ADDRESS=localhost\nAPP_ORIGIN=https://localhost:8443\nBIND_ADDRESS=127.0.0.1\nHTTP_PORT=8080\nHTTPS_PORT=8443\nREQUIRE_EMAIL_VERIFICATION=false\n`,{mode:0o600});
const compose=['compose','--env-file',envFile,'-f',resolve('deploy/compose.yaml')];
function run(command,args,capture=false){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:capture?['ignore','pipe','inherit']:'inherit',windowsHide:true});let output='';if(capture)child.stdout.on('data',data=>output+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(Error(`${command} exited with ${code}`)));});}
const docker=(project,args,capture=false)=>run('docker',[...compose,'-p',project,...args],capture);
const ops=(project,mode,backup=name)=>run(process.execPath,['scripts/ops.mjs',mode,'--env-file',envFile,'--project',project,'--name',backup]);
let first,restored,browser;
const email=`drill-${id}@example.com`,accountPassword='drill-local-password-12345';
async function session(client){const result=await client.get('/api/session');assert.equal(result.status(),200);return await result.json();}
async function post(client,path,csrf,body){const result=await client.post(path,{headers:{Origin:'https://localhost:8443','x-csrf-token':csrf},data:body});return result;}
try{
 await docker(source,['up','-d','--build','--wait','postgres','api','proxy']);
 first=await request.newContext({baseURL:'https://localhost:8443',ignoreHTTPSErrors:true});let csrf=(await session(first)).csrf;
 const registration=await post(first,'/api/auth/register',csrf,{email,password:accountPassword});assert.equal(registration.status(),201);csrf=(await registration.json()).csrf;assert.ok(registration.headers()['set-cookie'].includes('Secure'));
 const workspace=await post(first,'/api/workspaces',csrf,{name:'Restored team'});assert.equal(workspace.status(),201);const workspaceId=(await workspace.json()).id;
 const png=await sharp({create:{width:24,height:16,channels:3,background:'#496d54'}}).png().toBuffer();
 const upload=await first.post(`/api/workspaces/${workspaceId}/assets?name=restore.png`,{headers:{Origin:'https://localhost:8443','x-csrf-token':csrf,'Content-Type':'application/octet-stream'},data:png});assert.equal(upload.status(),201);const asset=(await upload.json()).id;
 const snapshot=(await (await first.get(`/api/workspaces/${workspaceId}`)).json()).snapshot;snapshot.boards[0].cards.push({id:'restore-image',kind:'image',x:900,y:100,text:'Restored private media',color:'#fff',assetId:asset});
 assert.equal((await first.put(`/api/workspaces/${workspaceId}`,{headers:{Origin:'https://localhost:8443','x-csrf-token':csrf},data:{expectedRevision:0,snapshot}})).status(),200);
 // Real browser through TLS proxy proves secure session cookies, static frontend and WS upgrade.
 browser=await chromium.launch();const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto('https://localhost:8443');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill(accountPassword);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Restored team · owner',exact:true}).click();await page.locator('.save').filter({hasText:'Live'}).waitFor();
 await page.getByLabel('Note content').first().fill('Durable TLS live edit');await page.waitForFunction(()=>document.querySelector('.save')?.textContent?.includes('Saved to team database'));await context.close();await browser.close();browser=undefined;
 const denied=await first.get('/api/unknown');assert.equal(denied.status(),404);assert.equal((await first.get('/health/ready')).status(),200);
 await ops(source,'backup');await ops(source,'check');
 await cp(resolve('backups',name),resolve('backups',name+'-corrupt'),{recursive:true});await appendFile(resolve('backups',name+'-corrupt','database.dump'),'corrupt');await assert.rejects(ops(source,'check',name+'-corrupt'));
 // Existing target data is never overwritten; the running API also prevents restore.
 await assert.rejects(ops(source,'restore'));
 await docker(source,['down']);
 // Same network/ports can now be used by a distinct project with brand-new volumes.
 await docker(target,['up','-d','--wait','postgres']);await ops(target,'restore');
 await assert.rejects(ops(target,'restore')); // Empty-target guard remains enforced after first restore.
 await docker(target,['up','-d','--wait','api','proxy']);restored=await request.newContext({baseURL:'https://localhost:8443',ignoreHTTPSErrors:true});
 assert.equal((await first.get(`/api/workspaces/${workspaceId}`)).status(),401); // Restored backups omit active sessions.
 const old=(await session(restored)).csrf,login=await post(restored,'/api/auth/login',old,{email,password:accountPassword});assert.equal(login.status(),200);
 const restoredCsrf=(await login.json()).csrf;
 const data=await (await restored.get(`/api/workspaces/${workspaceId}`)).json();assert.equal(data.snapshot.boards[0].cards[0].text,'Durable TLS live edit');assert.equal(data.snapshot.boards[0].cards.at(-1).assetId,asset);
 const content=await restored.get(`/api/workspaces/${workspaceId}/assets/${asset}/content`);assert.equal(content.status(),200);assert.deepEqual(await content.body(),png);
 const newUpload=await restored.post(`/api/workspaces/${workspaceId}/assets?name=after-restore.png`,{headers:{Origin:'https://localhost:8443','x-csrf-token':restoredCsrf,'Content-Type':'application/octet-stream'},data:png});assert.equal(newUpload.status(),201);
 const stranger=await request.newContext({baseURL:'https://localhost:8443',ignoreHTTPSErrors:true});assert.equal((await stranger.get(`/api/workspaces/${workspaceId}/assets/${asset}/content`)).status(),401);await stranger.dispose();
 console.log('LOCAL DRILL PASSED: fresh containers, TLS, secure cookies, live WebSockets, full database/media restore, session invalidation and overwrite refusal.');
}finally{
 await browser?.close();await first?.dispose();await restored?.dispose();
 // Names are generated by this script; never operate on the developer or production project.
 await docker(source,['down']);await docker(target,['down']);
 console.log(`Stopped isolated projects ${source} and ${target}. Their test volumes and ignored backups are retained for inspection.`);
}
