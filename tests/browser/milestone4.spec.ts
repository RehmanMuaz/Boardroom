import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {rm} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';

async function register(page:Page,email:string){await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill('milestone-four-test-password');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();}
test('multi-selection, resize, connectors, columns, clipboard, rich notes and canvas expansion',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const first=page.locator('.card.note').first(),second=page.locator('.card.note').nth(1);
 await first.click({position:{x:8,y:8}});await second.click({modifiers:['Shift'],position:{x:10,y:60}});await expect(page.locator('.card.selected')).toHaveCount(2);
 await page.getByRole('button',{name:'Connect cards'}).click();await expect(page.locator('.connection')).toHaveCount(1);
 const before=await first.evaluate(el=>parseFloat((el as HTMLElement).style.left));const handle=await first.boundingBox();if(!handle)throw Error('Missing card surface');await page.mouse.move(handle.x+100,handle.y+10);await page.mouse.down();await page.mouse.move(handle.x+150,handle.y+30,{steps:3});await page.mouse.up();await expect(first).toHaveCSS('left',`${before+50}px`);await expect(second).toHaveCSS('left','405px');
 await page.locator('.viewport').focus();await page.keyboard.press('Control+c');const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('BOARDROOM-CARDS:');await page.keyboard.press('Control+v');await expect(page.locator('.card.note')).toHaveCount(4);await expect(page.locator('.connection')).toHaveCount(2);
 await page.getByRole('button',{name:'Back to tools'}).click();await page.getByRole('button',{name:'Column',exact:true}).click();await page.getByLabel('Column title').fill('Production');
 await first.click({position:{x:8,y:8}});await page.getByLabel('Move selection to column').selectOption({label:'Production'});const left=await first.evaluate(el=>parseFloat((el as HTMLElement).style.left));const column=page.locator('.card.column');
 const colHandle=await column.boundingBox();if(!colHandle)throw Error('Missing column surface');await page.mouse.move(colHandle.x+100,colHandle.y+10);await page.mouse.down();await page.mouse.move(colHandle.x+140,colHandle.y+10);await page.mouse.up();await expect(first).toHaveCSS('left',`${left+40}px`);
 await first.click({position:{x:8,y:8}});const resize=first.getByRole('slider',{name:'Resize note card'});const width=await first.evaluate(el=>parseFloat((el as HTMLElement).style.width));await resize.focus();await page.keyboard.press('ArrowRight');await expect(first).toHaveCSS('width',`${width+10}px`);
 await page.getByRole('button',{name:'Format note'}).click();const rich=first.getByRole('textbox',{name:'Rich note content'});await rich.fill('Formatted idea');await rich.focus();await page.keyboard.press('Control+a');await page.getByRole('button',{name:'bold',exact:true}).click();await expect(rich.locator('b,strong')).toHaveText('Formatted idea');
 await expect(page.locator('.save')).toContainText('Saved locally');await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(page.locator('.rich-note strong')).toHaveText('Formatted idea');await expect(page.locator('.connection')).toHaveCount(2);await expect(page.getByLabel('Column title')).toHaveValue('Production');
 // Nudge a card beyond the former finite canvas, then pan using space-drag.
 await page.locator('.card.note').nth(1).click({position:{x:8,y:8}});await page.locator('.viewport').focus();
 for(let i=0;i<205;i++)await page.keyboard.press('Shift+ArrowRight');expect(await page.locator('.plane').evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBeGreaterThan(2400);
 await page.keyboard.down('Space');const view=await page.locator('.viewport').boundingBox();if(!view)throw Error('Missing viewport');await page.mouse.move(view.x+500,view.y+200);await page.mouse.down();await page.mouse.move(view.x+350,view.y+200);await page.mouse.up();await page.keyboard.up('Space');expect(await page.locator('.viewport').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/milestone4-canvas.png'});
 const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
 expect(errors).toEqual([]);
});

test('private image/video/file cards render live, stream playable video and stay permission scoped',async({browser})=>{
 const ownerContext=await browser.newContext(),viewerContext=await browser.newContext(),strangerContext=await browser.newContext();const owner=await ownerContext.newPage(),viewer=await viewerContext.newPage(),stranger=await strangerContext.newPage();
 const suffix=randomUUID(),emails=[`media-owner-${suffix}@example.com`,`media-viewer-${suffix}@example.com`,`media-stranger-${suffix}@example.com`];
 const pool=new Pool({connectionString:process.env.DATABASE_URL});let workspaceId='';const assetIds:string[]=[];
 try{
  await register(owner,emails[0]);await register(viewer,emails[1]);await register(stranger,emails[2]);await owner.getByLabel('New workspace').fill('Media '+suffix);await owner.getByRole('button',{name:'Create workspace',exact:true}).click();await owner.getByRole('button',{name:'Media '+suffix+' · owner',exact:true}).click();
  workspaceId=(await pool.query('SELECT w.id FROM team_workspaces w JOIN memberships m ON m.workspace_id=w.id JOIN accounts a ON a.id=m.user_id WHERE a.email=$1',[emails[0]])).rows[0].id;
  await owner.getByText('Manage team',{exact:true}).click();await owner.getByLabel('Invite email').fill(emails[1]);await owner.getByLabel('Invite role').selectOption('viewer');await owner.getByRole('button',{name:'Invite',exact:true}).click();const invite=owner.locator('.team-members [role=status]');await expect(invite).toContainText('Share this one-use token');const token=(await invite.innerText()).match(/[a-f0-9]{64}/)![0];await owner.getByText('Manage team',{exact:true}).click();await viewer.getByLabel('Invitation token').fill(token);await viewer.getByRole('button',{name:'Accept invitation'}).click();await viewer.getByRole('button',{name:'Media '+suffix+' · viewer',exact:true}).click();
  const image=await sharp({create:{width:80,height:60,channels:3,background:{r:75,g:125,b:95}}}).png().toBuffer();
  await owner.getByLabel('Upload media files').setInputFiles({name:'moodboard.png',mimeType:'image/png',buffer:image});await expect(owner.locator('.card.image')).toHaveCount(1);await expect(viewer.locator('.card.image img')).toHaveCount(1);await expect.poll(()=>viewer.locator('.card.image img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(80);
  await expect(viewer.getByRole('button',{name:'Upload image'})).toBeDisabled();
  const imageCard=owner.locator('.card.image');
  await expect(imageCard.getByLabel('Media caption')).toHaveCount(0);await expect(viewer.locator('.card.image').getByRole('button',{name:'Add subtitle'})).toHaveCount(0);
  await expect(imageCard.locator('.media-actions')).toHaveCount(0);await expect(owner.locator('.object-sidebar .media-actions')).toBeVisible();
  await owner.getByRole('button',{name:'Add subtitle'}).click();await expect(imageCard.getByLabel('Media caption')).toBeFocused();await expect(imageCard.getByLabel('Media caption')).toHaveAttribute('placeholder','Write a subtitle...');await owner.keyboard.type('Forest reference');
  await expect(viewer.locator('.card.image').getByLabel('Media caption')).toHaveValue('Forest reference');
  await owner.getByRole('button',{name:'Hide subtitle'}).click();await expect(viewer.locator('.card.image').getByLabel('Media caption')).toHaveCount(0);
  await owner.getByRole('button',{name:'Add subtitle'}).click();await expect(imageCard.getByLabel('Media caption')).toBeFocused();await expect(imageCard.getByLabel('Media caption')).toHaveValue('Forest reference');
  await expect(imageCard).toHaveCSS('border-top-width','0px');await expect(imageCard).toHaveCSS('box-shadow','none');await expect(imageCard).toHaveCSS('padding-top','0px');
  const download=owner.getByRole('link',{name:'Download image',exact:true});await expect(download).toHaveAttribute('title','Download image');await expect(download).toHaveText('');
  await expect(download).toHaveAttribute('href',/\/api\/workspaces\/.+\/assets\/.+\/content\?download=1$/);
  await expect.poll(()=>imageCard.locator('img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(80);
  await imageCard.getByRole('slider',{name:'Resize image card'}).focus();await owner.keyboard.press('ArrowRight');
  await expect(imageCard).toHaveCSS('width','330px');await expect(imageCard).toHaveCSS('height','275.5px');
  await expect(viewer.locator('.card.image')).toHaveCSS('width','330px');await expect(viewer.locator('.card.image')).toHaveCSS('height','275.5px');
  await owner.keyboard.press('Control+z');await expect(imageCard).toHaveCSS('width','320px');await owner.keyboard.press('Control+Shift+z');await expect(imageCard).toHaveCSS('width','330px');
  const surface=await imageCard.locator('img').boundingBox();if(!surface)throw Error('Missing media surface');const startLeft=await imageCard.evaluate(el=>parseFloat((el as HTMLElement).style.left));await owner.mouse.move(surface.x+100,surface.y+80);await owner.mouse.down();await owner.mouse.move(surface.x+140,surface.y+100);await owner.mouse.up();await expect(imageCard).toHaveCSS('left',`${startLeft+40}px`);await owner.keyboard.press('Control+z');await expect(imageCard).toHaveCSS('left',`${startLeft}px`);
  await imageCard.locator('img').click();const mediaResize=await imageCard.getByRole('slider',{name:'Resize image card'}).boundingBox();if(!mediaResize)throw Error('Missing media resize handle');
  await owner.mouse.move(mediaResize.x+8,mediaResize.y+8);await owner.mouse.down();await owner.mouse.move(mediaResize.x+48,mediaResize.y+68);await owner.mouse.up();
  await expect(imageCard).toHaveCSS('width','370px');await expect(imageCard).toHaveCSS('height','305.5px');await owner.keyboard.press('Control+z');await expect(imageCard).toHaveCSS('width','330px');
  const videoBytes=await owner.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const ctx=canvas.getContext('2d')!,stream=canvas.captureStream(10),chunks:Blob[]=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise<void>(resolve=>{recorder.onstop=()=>resolve();});recorder.start();for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#558866':'#eee';ctx.fillRect(0,0,64,48);await new Promise(resolve=>setTimeout(resolve,100));}recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());return [...new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())];});
  await owner.getByLabel('Upload media files').setInputFiles({name:'clip.webm',mimeType:'video/webm',buffer:Buffer.from(videoBytes)});await expect(viewer.locator('.card.video video')).toHaveCount(1);await expect.poll(()=>viewer.locator('video').evaluate(el=>(el as HTMLVideoElement).readyState)).toBeGreaterThan(0);await viewer.locator('video').evaluate(async el=>{await (el as HTMLVideoElement).play();});await expect.poll(()=>viewer.locator('video').evaluate(el=>(el as HTMLVideoElement).currentTime)).toBeGreaterThan(0);await viewer.locator('video').evaluate(el=>(el as HTMLVideoElement).pause());
  await owner.getByLabel('Upload media files').setInputFiles({name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('Private team brief')});await expect(viewer.locator('.card.file')).toHaveCount(1);
  await owner.screenshot({path:'test-results/milestone4-media.png'});
  const accessibility=await new AxeBuilder({page:owner}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  const assets=await pool.query('SELECT id,mime FROM team_assets WHERE workspace_id=$1',[workspaceId]);assetIds.push(...assets.rows.map(row=>row.id));const imageId=assets.rows.find(row=>row.mime==='image/png').id;const path=`/api/workspaces/${workspaceId}/assets/${imageId}/content`;
  expect((await stranger.request.get(path)).status()).toBe(404);expect((await viewer.request.get(path,{headers:{Range:'bytes=0-7'}})).status()).toBe(206);
  await expect(owner.locator('.save')).toContainText('Saved to team database');await owner.reload();await owner.getByRole('button',{name:'Media '+suffix+' · owner',exact:true}).click();await expect(owner.locator('.card.image img')).toHaveCount(1);await expect(owner.locator('.card.video video')).toHaveCount(1);
  await owner.getByText('Manage team',{exact:true}).click();await owner.locator('.team-members div').filter({hasText:emails[1]}).getByRole('button',{name:'Remove'}).click();await expect(viewer.locator('.save')).toContainText('access changed');expect((await viewer.request.get(path)).status()).toBe(404);
 }finally{
  await ownerContext.close();await viewerContext.close();await strangerContext.close();
  if(workspaceId){const all=await pool.query('SELECT id FROM team_assets WHERE workspace_id=$1',[workspaceId]);assetIds.push(...all.rows.map(row=>row.id));await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);}
  for(const email of emails){await pool.query("DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM accounts WHERE email=$1)",[email]);await pool.query('DELETE FROM accounts WHERE email=$1',[email]);}
  await pool.end();const root=resolve(process.env.ASSET_DIR??'data/assets');for(const id of new Set(assetIds)){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid generated asset key');const path=join(root,id);if(relative(root,path).startsWith('..'))throw Error('Unsafe cleanup path');await rm(path,{force:true});}
 }
});
