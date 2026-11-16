import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {Pool} from 'pg';
import {createApp} from '../server/app';
import {migrate} from '../server/migrate';
import {hashToken} from '../server/security';
import {withFlow,type FlowSettings} from '../server/flow-integration';
import {persistOperation} from '../server/operations';

test('Chromium native review submits same-origin approval once and blocks stale/unsigned reviews',async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL??'');
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.pathname.startsWith('/boardroom_flow_test_'))throw Error('Requires the disposable local database runner');
 const pool=new Pool({connectionString:url.href});
 const server=createServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('No local listener');
 const origin='http://127.0.0.1:'+address.port,email='browser-flow-'+randomUUID()+'@example.com',token='a'.repeat(64);
 const settings:FlowSettings={tokenHash:hashToken(token),email,origin,workspaceIds:[]};
 const app=withFlow(createApp(pool,{secret:'flow-browser-local-session-at-least-32',origin,rateNamespace:randomUUID(),log:()=>{}}),pool,settings);
 server.on('request',app);
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await migrate(pool);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const api=context.request,session=await (await api.get(origin+'/api/session')).json();
  const accountResponse=await api.post(origin+'/api/auth/register',{headers:{Origin:origin,'x-csrf-token':session.csrf},data:{email,password:'correct-horse-browser-password'}});
  assert.equal(accountResponse.status(),201);const account=await accountResponse.json();
  const created=await api.post(origin+'/api/workspaces',{headers:{Origin:origin,'x-csrf-token':account.csrf},data:{name:'Synthetic production pitch'}});
  assert.equal(created.status(),201);const workspaceId=(await created.json()).id;settings.workspaceIds=[workspaceId];
  const read=async()=>await (await api.get(origin+'/api/workspaces/'+workspaceId)).json();
  const before=await read();
  const operation={id:randomUUID(),baseRevision:before.revision,changes:[{boardId:before.snapshot.boards[0].id,field:'title',before:before.snapshot.boards[0].title,after:'Approved documentary direction'}]};
  const stage=async(value:object)=>{
   const response=await fetch(origin+'/api/flow/workspaces/'+workspaceId+'/reviews',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(value)});
   assert.equal(response.status,201);return (await response.json()).reviewUrl as string;
  };
  const reviewUrl=await stage(operation),page=await context.newPage();
  await page.goto(reviewUrl);
  await expect(page.getByRole('heading',{name:'Review edits to Synthetic production pitch'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Before',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'After',exact:true})).toBeVisible();
  assert.equal((await read()).revision,before.revision);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/flow-edit-review.png',fullPage:true});
  await page.getByRole('button',{name:'Apply reviewed changes'}).click();
  await expect(page.getByText('Changes already applied.',{exact:false})).toBeVisible();
  const after=await read();assert.equal(after.revision,before.revision+1);assert.equal(after.snapshot.boards[0].title,operation.changes[0].after);
  await page.reload();assert.equal((await read()).revision,after.revision);
  await expect(page.getByRole('button',{name:'Apply reviewed changes'})).toHaveCount(0);
  const next={...operation,id:randomUUID(),baseRevision:after.revision,changes:[{...operation.changes[0],before:after.snapshot.boards[0].title,after:'Stale proposal'}]};
  const staleUrl=await stage(next);
  await persistOperation(pool,workspaceId,account.userId,{...next,id:randomUUID(),changes:[{...next.changes[0],after:'Later manual direction'}]});
  assert.equal((await page.goto(staleUrl))?.status(),409);
  await expect(page.getByRole('button',{name:'Apply reviewed changes'})).toHaveCount(0);
  const guest=await browser.newContext(),guestPage=await guest.newPage();
  assert.equal((await guestPage.goto(reviewUrl))?.status(),401);
  await guest.close();await context.close();
 }finally{
  await browser?.close();server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
 }
});
