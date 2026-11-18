import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';

test('UI audit: workspace chevron, responsive dialogs, controls and primary actions',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();await expect.poll(()=>page.locator('.brand .app-mark').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
 for(const size of [{width:1440,height:1000},{width:1024,height:768},{width:768,height:600},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);
  if(size.height<=600&&size.width>600){const file=page.getByRole('button',{name:'Upload file',exact:true});await file.scrollIntoViewIfNeeded();const bottom=await page.locator('.aside-bottom').boundingBox(),box=await file.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(bottom!.y+1);await page.getByRole('button',{name:'Note',exact:true}).scrollIntoViewIfNeeded();}
  if(size.width<=600){const file=page.getByRole('button',{name:'Upload file',exact:true});await file.scrollIntoViewIfNeeded();const bottom=(await page.locator('.aside-bottom').boundingBox())!,box=(await file.boundingBox())!;expect(box.x+box.width).toBeLessThanOrEqual(bottom.x+1);await page.getByRole('button',{name:'Note',exact:true}).scrollIntoViewIfNeeded();}
  const switcher=page.getByLabel('Switch workspace',{exact:true});await switcher.click();
  const chevron=await switcher.locator('.workspace-chevron').boundingBox(),summary=await switcher.boundingBox();expect(chevron).not.toBeNull();expect(summary).not.toBeNull();expect(Math.abs(chevron!.y+chevron!.height/2-summary!.y-summary!.height/2)).toBeLessThan(1);
  await page.screenshot({path:`test-results/ui-workspace-${size.width}.png`});await switcher.click();
  for(const name of ['Account','Board actions']){
   await page.getByRole('button',{name,exact:true}).click();const dialog=page.getByRole('dialog',{name,exact:true});
   if(name==='Board actions'){await dialog.getByLabel('Export format').selectOption('pdf');}
   await page.screenshot({path:`test-results/ui-${name.replace(' ','-')}-${size.width}.png`});
   const dimensions=await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.getBoundingClientRect().height}));
   expect.soft(dimensions.scroll,`${name} horizontal overflow at ${size.width}`).toBeLessThanOrEqual(dimensions.width+1);
   expect.soft(dimensions.height).toBeLessThanOrEqual(size.height-16);
   const body=await dialog.locator('.settings-dialog-body').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));expect.soft(body.scroll,`Dialog body clipping at ${size.width}`).toBeLessThanOrEqual(body.width+1);
   expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
   await page.keyboard.press('Escape');
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Board actions',exact:true}).click();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
});

test('team UI audit: long names, member rows, style/frame fields and semantic accents fit light/dark phone dialogs',async({page,browser},info)=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL}),other=await browser.newContext({baseURL:'http://localhost:5174'}),viewer=await other.newPage(),ids:string[]=[];let workspace='';
 try{
  async function register(p:typeof page,email:string){await p.goto('/');await expect(p.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();const session=(await (await p.request.get('/api/session')).json()).csrf,response=await p.request.post('/api/auth/register',{headers:{Origin:'http://localhost:5174','x-csrf-token':session},data:{email,password:'ui-audit-local-test-password'}});expect(response.status()).toBe(201);const user=await response.json();ids.push(user.userId);return user;}
  const owner=await register(page,randomUUID()+'@example.com'),reader=await register(viewer,'producer.'+randomUUID()+'@department.production.example.com'),headers={Origin:'http://localhost:5174','x-csrf-token':owner.csrf},name='UI audit workspace '+('long project name ').repeat(5);
  workspace=(await (await page.request.post('/api/workspaces',{headers,data:{name}})).json()).id;await pool.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,'viewer')",[workspace,reader.userId]);await page.reload();await page.getByRole('button',{name:/UI audit workspace/}).click();
  for(const theme of ['light','dark']){
   await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByLabel('Appearance',{exact:true}).selectOption(theme);await page.getByRole('button',{name:'Close Account',exact:true}).click();
   for(const size of [{width:1440,height:1000},{width:1280,height:800},{width:1024,height:768},{width:768,height:600},{width:390,height:844},{width:320,height:568}]){
    await page.setViewportSize(size);
    const overlaps=await page.locator('.app>header').evaluate(el=>{const boxes=[...el.querySelectorAll(':scope>.brand,.workspace-switcher summary,.header-command-search,:scope>.team-trigger,:scope>.actions-trigger,:scope>.account-trigger')].filter(e=>e.getClientRects().length).map(e=>({name:e.className||e.getAttribute('aria-label'),r:e.getBoundingClientRect()}));return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1).map(b=>[a.name,b.name]));});expect(overlaps,`Header overlap at ${size.width}`).toEqual([]);
    for(const name of ['Manage team','Board actions']){
     await page.getByRole('button',{name,exact:true}).click();const d=page.getByRole('dialog',{name,exact:true});
     if(name==='Manage team'){await expect(d.locator('.member-row')).toHaveCount(2);await d.getByText('Client viewing links',{exact:true}).click();}
     else{if(await d.getByText('Export frames (0)',{exact:true}).evaluate(el=>!el.parentElement?.hasAttribute('open')))await d.getByText('Export frames (0)',{exact:true}).click();await expect(d.getByLabel('Show frame outlines on canvas')).toBeVisible();}
     const overflow=await d.locator('.settings-dialog-body').evaluate(el=>el.scrollWidth-el.clientWidth);expect(overflow,`${name}: ${size.width}/${theme}`).toBeLessThanOrEqual(1);
     const escaped=await d.evaluate(el=>{const bounds=el.getBoundingClientRect();return [...el.querySelectorAll('input,select,button')].filter(c=>c.getClientRects().length&&!c.closest('[inert]')).filter(c=>{const r=c.getBoundingClientRect();return r.left<bounds.left||r.right>bounds.right;}).map(c=>c.getAttribute('aria-label')||c.textContent);});expect(escaped).toEqual([]);
     if(name==='Manage team'){await expect(d.getByRole('button',{name:'Invite',exact:true})).toHaveClass(/button-primary/);await expect(d.getByRole('button',{name:'Remove',exact:true})).toHaveClass(/button-danger/);}
     expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
     await page.screenshot({path:`test-results/ui-team-${name.replace(' ','-')}-${size.width}-${theme}.png`});await page.keyboard.press('Escape');
    }
   }
  }
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Board actions',exact:true}).click();const d=page.getByRole('dialog',{name:'Board actions',exact:true});await d.getByText('Workspace styles',{exact:true}).click();await d.getByRole('button',{name:'Enable workspace styles',exact:true}).click();await d.getByRole('button',{name:'Apply workspace style',exact:true}).click();await d.getByText('Current board defaults',{exact:true}).click();const check=d.getByLabel('Inherit workspace board appearance');await check.scrollIntoViewIfNeeded();expect((await check.boundingBox())!.width).toBe(16);expect((await check.boundingBox())!.height).toBe(16);
  for(const file of ['boardroom.svg','hub.svg','flow.svg','canvas.svg','studio.svg','boardroom-32.png','boardroom-180.png'])expect((await page.request.get('/brand/'+file)).status()).toBe(200);
 }finally{await other.close();if(workspace)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspace]);await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[ids]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);const ns=info.config.metadata.rateNamespace;expect(ns).toMatch(/^browser-[a-f0-9-]{36}$/);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[ns+':%']);await pool.end();}
});
