import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import sharp from 'sharp';
import {rm} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {type Workspace} from '../../src/model';

async function register(page:Page,email:string){
 const session=await page.request.get('/api/session');const identity=await page.request.post('/api/auth/register',{headers:{Origin:'http://localhost:5174','x-csrf-token':(await session.json()).csrf},data:{email,password:'organization-live-test-password'}});expect(identity.status()).toBe(201);return await identity.json() as {userId:string;csrf:string};
}
test('new editor fields, connectors, column media fitting/counts and undo sync live, persist, and remain read-only for viewers',async({browser})=>{
 const ownerContext=await browser.newContext(),viewerContext=await browser.newContext(),owner=await ownerContext.newPage(),viewer=await viewerContext.newPage();
 const suffix=randomUUID(),pool=new Pool({connectionString:process.env.DATABASE_URL}),accounts:string[]=[],assets:string[]=[];let workspaceId='';
 try{
  const identity=await register(owner,`organization-owner-${suffix}@example.com`),reader=await register(viewer,`organization-viewer-${suffix}@example.com`);accounts.push(identity.userId,reader.userId);
  const headers={Origin:'http://localhost:5174','x-csrf-token':identity.csrf};const created=await owner.request.post('/api/workspaces',{headers,data:{name:'Organization '+suffix}});expect(created.status()).toBe(201);workspaceId=(await created.json()).id;
  await pool.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES ($1,$2,$3)',[workspaceId,reader.userId,'viewer']);
  const imageBytes=await sharp({create:{width:80,height:60,channels:3,background:'#558866'}}).png().toBuffer();
  const imageUpload=await owner.request.post(`/api/workspaces/${workspaceId}/assets?name=reference.png`,{headers:{...headers,'Content-Type':'application/octet-stream'},data:imageBytes});expect(imageUpload.status()).toBe(201);const image=(await imageUpload.json()).id;assets.push(image);
  const fileUpload=await owner.request.post(`/api/workspaces/${workspaceId}/assets?name=brief.txt`,{headers:{...headers,'Content-Type':'application/octet-stream'},data:Buffer.from('Private test brief')});expect(fileUpload.status()).toBe(201);const file=(await fileUpload.json()).id;assets.push(file);
  const snapshot:Workspace={version:1,boards:[{id:'home',title:'Team organization',cards:[
   {id:'note',kind:'note',x:40,y:40,text:'Review this note',color:'#fff'},
   {id:'list',kind:'checklist',x:340,y:40,text:'Draft\nApprove',color:'#fff'},
   {id:'column',kind:'column',x:650,y:40,width:320,height:600,text:'Production',color:'#ebeee8'},
   {id:'image',kind:'image',assetId:image,x:40,y:300,width:400,height:300,captionVisible:false,text:'',color:'#fff'},
   {id:'file',kind:'file',assetId:file,x:380,y:500,width:240,height:150,text:'Brief',color:'#fff'},
   {id:'board',kind:'board',target:'child',x:380,y:300,text:'Child board',color:'#fff'}
  ]},{id:'child',parent:'home',title:'Child board',cards:[]}]};
  expect((await owner.request.put(`/api/workspaces/${workspaceId}`,{headers,data:{expectedRevision:0,snapshot}})).status()).toBe(200);
  for(const [page,role] of [[owner,'owner'],[viewer,'viewer']] as const){await page.goto('/');await page.getByRole('button',{name:`Organization ${suffix} · ${role}`,exact:true}).click();await expect(page.locator('.save')).toContainText('Live');}
  await expect(viewer.getByRole('button',{name:'Note',exact:true})).toBeDisabled();
  const canvasBounds=await owner.locator('.viewport').boundingBox(),toolBounds=await owner.getByRole('button',{name:'Note',exact:true}).boundingBox();if(!canvasBounds||!toolBounds)throw Error('Missing creation controls');
  await owner.mouse.move(toolBounds.x+15,toolBounds.y+15);await owner.mouse.down();await owner.mouse.move(canvasBounds.x+700,canvasBounds.y+130,{steps:6});await owner.mouse.up();await expect(viewer.locator('.card.note')).toHaveCount(2);await expect(viewer.locator('.column-summary')).toHaveText('1 card');await owner.keyboard.press('Control+z');await expect(viewer.locator('.card.note')).toHaveCount(1);
  await owner.getByRole('button',{name:'Upload image'}).click();const chooser=owner.waitForEvent('filechooser');await owner.locator('.creation-placement').click({position:{x:1000,y:170}});await (await chooser).setFiles({name:'placed-image.png',mimeType:'image/png',buffer:imageBytes});await expect(viewer.locator('.card.image')).toHaveCount(2);await expect(owner.locator('.card.image').last()).toHaveCSS('left','1000px');await expect(owner.locator('.card.image').last()).toHaveCSS('top','170px');
  for(const row of (await pool.query('SELECT id FROM team_assets WHERE workspace_id=$1',[workspaceId])).rows)if(!assets.includes(row.id))assets.push(row.id);
  await owner.keyboard.press('Control+z');await expect(viewer.locator('.card.image')).toHaveCount(1);
  await owner.getByLabel('List title').fill('Deliverables');await owner.getByLabel('Task 1',{exact:true}).fill('Draft the film');await owner.getByLabel('Complete task 1',{exact:true}).check();await expect(viewer.getByLabel('List title')).toHaveValue('Deliverables');await expect(viewer.getByLabel('List title')).toHaveAttribute('readonly','');await expect(viewer.getByLabel('Task 1',{exact:true})).toHaveValue('Draft the film');await expect(viewer.getByLabel('Complete task 1',{exact:true})).toBeDisabled();
  const note=owner.locator('[data-card-id=note]');await note.click({position:{x:200,y:8}});await owner.getByLabel('Item background color hex',{exact:true}).fill('#123456');await owner.getByLabel('Item background color hex',{exact:true}).press('Enter');await expect(viewer.locator('[data-card-id=note]')).toHaveCSS('background-color','rgb(18, 52, 86)');await viewer.locator('[data-card-id=note]').click({position:{x:200,y:8}});await expect(viewer.getByLabel('Item background color hex',{exact:true})).toHaveCount(0);await viewer.getByRole('button',{name:'Back to tools'}).click();await owner.getByRole('button',{name:'Add label',exact:true}).click();await owner.getByLabel('Label name').fill('Approved');await owner.getByLabel('Label color',{exact:true}).fill('#123456');await owner.getByRole('button',{name:'Save label',exact:true}).click();await expect(viewer.locator('.note-label')).toHaveText('Approved');await expect(viewer.getByRole('button',{name:'Add label',exact:true})).toHaveCount(0);
  await owner.getByRole('button',{name:'Back to tools'}).click();await owner.getByRole('button',{name:'Connect items',exact:true}).click();await note.click({position:{x:20,y:60}});await owner.locator('[data-card-id=list]').click({position:{x:20,y:60}});await expect(viewer.locator('.connection')).toHaveCount(1);await expect(viewer.getByRole('button',{name:'Connect items',exact:true})).toBeDisabled();
  await note.click({position:{x:200,y:8}});await owner.getByRole('button',{name:'Send to back',exact:true}).click();await expect(viewer.locator('[data-card-id=note]')).toHaveCSS('z-index','1');await expect(viewer.locator('.layer-controls')).toHaveCount(0);
  await owner.getByLabel('Move selection to column').selectOption({label:'Production'});await expect(viewer.locator('.column-summary')).toHaveText('1 card');
  const imageCard=owner.locator('[data-card-id=image]');await expect.poll(()=>imageCard.locator('img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(80);await imageCard.locator('img').click();await owner.getByLabel('Move selection to column').selectOption({label:'Production'});await expect(viewer.locator('[data-card-id=image]')).toHaveCSS('width','288px');await expect(viewer.locator('[data-card-id=image]')).toHaveCSS('height','216px');
  for(const id of ['file','board']){await owner.locator(`[data-card-id=${id}]`).click();await owner.getByLabel('Move selection to column').selectOption({label:'Production'});}
  await expect(viewer.locator('.column-summary')).toHaveText('2 cards, 1 file, 1 board');await owner.keyboard.press('Control+z');await expect(viewer.locator('.column-summary')).toHaveText('2 cards, 1 file');await owner.keyboard.press('Control+Shift+z');await expect(viewer.locator('.column-summary')).toHaveText('2 cards, 1 file, 1 board');
  await expect(owner.locator('.save')).toContainText('Saved to team database');await owner.reload();await owner.getByRole('button',{name:`Organization ${suffix} · owner`,exact:true}).click();await expect(owner.getByLabel('List title')).toHaveValue('Deliverables');await expect(owner.locator('.note-label')).toHaveText('Approved');await expect(owner.locator('.column-summary')).toHaveText('2 cards, 1 file, 1 board');await expect(owner.locator('.connection')).toHaveCount(1);
 }finally{
  await ownerContext.close();await viewerContext.close();if(workspaceId)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);
  await pool.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])",[accounts]);await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[accounts]);await pool.end();
  const root=resolve(process.env.ASSET_DIR??'data/assets');for(const id of assets){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid generated asset ID');const path=join(root,id);if(relative(root,path).startsWith('..'))throw Error('Unsafe asset cleanup path');await rm(path,{force:true});}
 }
});
