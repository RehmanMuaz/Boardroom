import {test,expect,type Page,type WebSocketRoute} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';

test('local canvas edits, zoom-aware dragging, nested navigation and backup round-trip',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const note=page.getByLabel('Note content').first();await note.fill('Browser-tested idea');await note.press('Escape');
 await expect(page.locator('.save')).toContainText('Saved locally');
 const card=page.locator('.card.note').first();
 for(const zoom of [1,.5,1.5]){
  await page.locator('.zoom button').nth(1).click();
  for(let i=0;i<5&&zoom!==1;i++)await page.getByLabel(zoom<1?'Zoom out':'Zoom in').click();
  const before=await card.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}));
  const handle=await card.boundingBox();if(!handle)throw Error('Missing card surface');
  const sidebar=await page.locator('aside').boundingBox();const startX=Math.min(handle.x+handle.width-6,Math.max(handle.x+10,(sidebar?.x??0)+(sidebar?.width??0)+6));const startY=handle.y+6;await page.mouse.move(startX,startY);await page.mouse.down();await page.mouse.move(startX+40,startY+20,{steps:5});await page.mouse.up();
  const after=await card.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}));
  expect(after.x-before.x).toBeCloseTo(40/zoom);expect(after.y-before.y).toBeCloseTo(20/zoom);
 }
 await page.getByRole('button',{name:'Undo'}).click();await page.getByRole('button',{name:'Redo'}).click();
 await page.locator('.board-tile').dblclick();await expect(page.getByRole('heading',{name:'Brand film'})).toBeVisible();
 await page.getByRole('button',{name:'Creative studio',exact:true}).click();await expect(note).toHaveValue('Browser-tested idea');
 await expect(page.locator('.save')).toContainText('Saved locally');
 await page.getByLabel('Board actions',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();const backup=await download;const path=await backup.path();if(!path)throw Error('No backup file');
 await note.fill('Temporary change');await page.getByLabel('Board actions',{exact:true}).click();await page.locator('.import input[type=file]').setInputFiles(path);await expect(note).toHaveValue('Browser-tested idea');
 await expect(page.locator('.save')).toContainText('Saved locally');await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(note).toHaveValue('Browser-tested idea');
 expect(errors).toEqual([]);
});

async function register(page:Page,email:string){await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill('browser-test-password');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();}

test('live sharing, viewer permissions, reconnect retries, conflicts and revocation',async({browser})=>{
 const ownerContext=await browser.newContext(),viewerContext=await browser.newContext();const owner=await ownerContext.newPage(),viewer=await viewerContext.newPage();
 let viewerRoute:WebSocketRoute|undefined,viewerServer:WebSocketRoute|undefined,networkDown=false,dropAck=false,dropped=false;
 await viewer.routeWebSocket('**/api/live',route=>{viewerRoute=route;if(networkDown){void route.close();return;}const remote=route.connectToServer();viewerServer=remote;remote.onMessage(message=>{const event=JSON.parse(message.toString());if(dropAck&&event.type==='ack'&&!dropped){dropped=true;void route.close();void remote.close();return;}route.send(message);});});
 const suffix=randomUUID(),ownerEmail=`browser-owner-${suffix}@example.com`,viewerEmail=`browser-viewer-${suffix}@example.com`;
 try{
  await register(owner,ownerEmail);await register(viewer,viewerEmail);
  await owner.getByLabel('New workspace').fill('Browser team '+suffix);await owner.getByRole('button',{name:'Create workspace',exact:true}).click();await owner.getByRole('button',{name:'Browser team '+suffix+' · owner',exact:true}).click();
  await expect(owner.getByLabel('Switch workspace',{exact:true})).toHaveText('Browser team '+suffix+'⌄');
  await owner.getByLabel('Switch workspace',{exact:true}).click();await owner.getByRole('button',{name:'All workspaces',exact:true}).click();
  await owner.getByLabel('New workspace').fill('Second team '+suffix);await owner.getByRole('button',{name:'Create workspace',exact:true}).click();await owner.getByRole('button',{name:'Second team '+suffix+' · owner',exact:true}).click();
  await owner.getByLabel('Board title').fill('Second team board');await expect(owner.locator('.save')).toContainText('Saved to team database');
  await owner.getByLabel('Switch workspace',{exact:true}).click();await owner.locator('.workspace-switcher').getByRole('button',{name:new RegExp('Browser team '+suffix)}).click();await expect(owner.getByLabel('Board title')).toHaveValue('Creative studio');
  await owner.getByText('Manage team',{exact:true}).click();await owner.getByLabel('Invite email').fill(viewerEmail);await owner.getByLabel('Invite role').selectOption('viewer');await owner.getByRole('button',{name:'Invite',exact:true}).click();
  const invitation=owner.locator('.team-members [role=status]');await expect(invitation).toContainText('Share this one-use token');const token=(await invitation.innerText()).match(/[a-f0-9]{64}/)?.[0];if(!token)throw Error('Missing invite');await owner.getByText('Manage team',{exact:true}).click();
  await viewer.getByLabel('Invitation token').fill(token);await viewer.getByRole('button',{name:'Accept invitation'}).click();await viewer.getByRole('button',{name:'Browser team '+suffix+' · viewer',exact:true}).click();
  await expect(viewer.getByLabel('Note content').first()).toHaveAttribute('readonly','');await expect(viewer.getByRole('button',{name:'Note',exact:true})).toBeDisabled();
  await owner.getByLabel('Note content').first().fill('Shared durable browser edit');await expect(owner.locator('.save')).toContainText('Saved to team database');
  await expect(viewer.getByLabel('Note content').first()).toHaveValue('Shared durable browser edit');
  await expect(owner.locator('.presence')).toContainText('2 online');
  await owner.getByLabel('Switch workspace',{exact:true}).click();await owner.getByRole('button',{name:'Rename workspace',exact:true}).click();await expect(owner.getByLabel('Workspace name',{exact:true})).toBeFocused();await owner.getByLabel('Workspace name',{exact:true}).fill('Renamed browser team');await owner.getByRole('button',{name:'Save name',exact:true}).click();
  await expect(owner.getByLabel('Switch workspace',{exact:true})).toContainText('Renamed browser team');await expect(viewer.getByLabel('Switch workspace',{exact:true})).toContainText('Renamed browser team');
  await viewer.getByLabel('Switch workspace',{exact:true}).click();await expect(viewer.getByRole('button',{name:'Rename workspace',exact:true})).toHaveCount(0);await viewer.getByLabel('Switch workspace',{exact:true}).click();
  await owner.getByRole('button',{name:'Rename workspace',exact:true}).click();await owner.getByLabel('Workspace name',{exact:true}).fill('Browser team '+suffix);await owner.getByRole('button',{name:'Save name',exact:true}).click();await owner.getByLabel('Switch workspace',{exact:true}).click();await expect(viewer.getByLabel('Switch workspace',{exact:true})).toContainText('Browser team '+suffix);
  await owner.getByText('Board appearance',{exact:true}).click();await owner.getByLabel('Board background color').fill('#19302a');await owner.getByLabel('Board canvas pattern').selectOption('grid');await owner.getByText('Board appearance',{exact:true}).click();
  await expect(viewer.locator('.viewport')).toHaveCSS('background-color','rgb(25, 48, 42)');await expect(viewer.locator('.viewport')).toHaveCSS('background-image',/linear-gradient/);
  await viewer.getByText('Board appearance',{exact:true}).click();await expect(viewer.getByLabel('Board background color')).toBeDisabled();await expect(viewer.getByLabel('Board canvas pattern')).toBeDisabled();await viewer.getByText('Board appearance',{exact:true}).click();
  await expect(viewer.getByRole('button',{name:'Text annotation tool'})).toBeDisabled();
  await expect(viewer.getByRole('button',{name:'Shape annotation tool'})).toBeDisabled();
  if(await owner.getByRole('button',{name:'Back to tools'}).count())await owner.getByRole('button',{name:'Back to tools'}).click();await owner.getByRole('button',{name:'Shape annotation tool'}).click();const shapeCanvas=await owner.locator('.viewport').boundingBox();if(!shapeCanvas)throw Error('Missing canvas');
  await owner.mouse.move(shapeCanvas.x+800,shapeCanvas.y+100);await owner.mouse.down();await owner.mouse.move(shapeCanvas.x+900,shapeCanvas.y+150,{steps:5});await owner.mouse.up();
  await expect(viewer.getByRole('button',{name:'arrow annotation',exact:true})).toHaveCount(1);
  if(await owner.getByRole('button',{name:'Back to tools'}).count())await owner.getByRole('button',{name:'Back to tools'}).click();await owner.getByRole('button',{name:'Text annotation tool'}).click();
  const canvasBounds=await owner.locator('.viewport').boundingBox();if(!canvasBounds)throw Error('Missing canvas');
  await owner.mouse.click(canvasBounds.x+400,canvasBounds.y+300);
  await owner.getByLabel('Annotation text',{exact:true}).fill('Shared annotation');await owner.getByLabel('Annotation text',{exact:true}).press('Escape');
  await expect(viewer.locator('.text-annotation')).toContainText('Shared annotation');
  await viewer.locator('.text-annotation').dblclick();await expect(viewer.getByLabel('Annotation text',{exact:true})).toHaveCount(0);
  await expect(viewer.getByRole('button',{name:'Delete annotation'})).toHaveCount(0);
  const moving=owner.locator('.card.note').first();const handle=await moving.boundingBox();if(!handle)throw Error('No card surface');
  await owner.mouse.move(handle.x+handle.width/2,handle.y+10);await owner.mouse.down();await owner.mouse.move(handle.x+handle.width/2+60,handle.y+40,{steps:5});await owner.mouse.up();
  await expect(viewer.locator('.card.note').first()).toHaveCSS('left','130px');await expect(viewer.locator('.card.note').first()).toHaveCSS('top','100px');
  // Role changes close the old subscription immediately; reopening loads the new role.
  await owner.getByText('Manage team',{exact:true}).click();await owner.getByLabel('Role for '+viewerEmail).selectOption('editor');
  await expect(viewer.locator('.save')).toContainText('access changed');await owner.getByText('Manage team',{exact:true}).click();
  await viewer.reload();await viewer.getByRole('button',{name:'Browser team '+suffix+' \u00b7 editor',exact:true}).click();await expect(viewer.locator('.save')).toContainText('Live');
  // An edit remains queued across a disconnect while a different field changes online.
  networkDown=true;await viewerRoute!.close();await viewerServer!.close();await expect(viewer.locator('.save')).toContainText('Offline');
  await viewer.getByLabel('Note content').nth(1).fill('Queued offline brief');await owner.getByLabel('Note content').first().fill('Online concurrent edit');await expect(owner.locator('.save')).toContainText('Saved to team database');
  networkDown=false;await expect(viewer.locator('.save')).toContainText('Live',{timeout:15000});
  await expect(viewer.getByLabel('Note content').first()).toHaveValue('Online concurrent edit');await expect(owner.getByLabel('Note content').nth(1)).toHaveValue('Queued offline brief');
  // Drop a committed acknowledgement: the same operation retries without another write.
  dropAck=true;await viewer.getByLabel('Note content').nth(1).fill('Lost acknowledgement recovered');
  await expect.poll(()=>dropped).toBe(true);await expect(viewer.locator('.save')).toContainText('Live',{timeout:15000});await expect(owner.getByLabel('Note content').nth(1)).toHaveValue('Lost acknowledgement recovered');
  // A conflicting offline edit is retained for export and cannot overwrite the winner.
  networkDown=true;await viewerRoute!.close();await viewerServer!.close();await expect(viewer.locator('.save')).toContainText('Offline');
  await viewer.getByLabel('Note content').first().fill('Conflicting offline edit');await owner.getByLabel('Note content').first().fill('Winning online edit');await expect(owner.locator('.save')).toContainText('Saved to team database');
  networkDown=false;await expect(viewer.locator('.save')).toContainText('Conflict on',{timeout:15000});await expect(viewer.getByLabel('Note content').first()).toHaveValue('Conflicting offline edit');await expect(owner.getByLabel('Note content').first()).toHaveValue('Winning online edit');
  await viewer.reload();await viewer.getByRole('button',{name:'Browser team '+suffix+' \u00b7 editor',exact:true}).click();await expect(viewer.getByLabel('Note content').first()).toHaveValue('Winning online edit');
  await owner.getByText('Manage team',{exact:true}).click();await owner.locator('.team-members div').filter({hasText:viewerEmail}).getByRole('button',{name:'Remove'}).click();
  await expect(viewer.locator('.save')).toContainText('access changed');await expect(viewer.getByRole('button',{name:'Note',exact:true})).toBeDisabled();

 }finally{
  await ownerContext.close();await viewerContext.close();const pool=new Pool({connectionString:process.env.DATABASE_URL});try{await pool.query('DELETE FROM team_workspaces WHERE id IN (SELECT workspace_id FROM memberships WHERE user_id IN (SELECT id FROM accounts WHERE email=$1))',[ownerEmail]);await pool.query("DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM accounts WHERE email=$1 OR email=$2)",[ownerEmail,viewerEmail]);await pool.query('DELETE FROM accounts WHERE email=$1 OR email=$2',[ownerEmail,viewerEmail]);}finally{await pool.end();}
 }
});

test('board breadcrumbs, title editing and compact navigation remain usable',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 await expect(page.getByLabel('Switch workspace',{exact:true})).toContainText('Browser-local canvas');await expect(page.locator('.workspace-mode')).toContainText('No team sync');
 await page.locator('.board-tile').dblclick();await page.getByLabel('Board title').fill('Renamed project');
 await page.getByRole('button',{name:'Board',exact:true}).click();await page.locator('.creation-placement').click({position:{x:900,y:300}});await page.locator('.board-tile').dblclick();
 const crumbs=page.getByRole('navigation',{name:'Board breadcrumbs'});await expect(crumbs.getByRole('button',{name:'Renamed project',exact:true})).toBeVisible();
 await crumbs.getByRole('button',{name:'Creative studio',exact:true}).click();await expect(page.locator('.board-tile')).toContainText('Renamed project');
 await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('Board actions',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/mobile-before-menu.png'});await page.getByLabel('Board actions',{exact:true}).click();await expect(page.getByRole('button',{name:'Export',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.board-actions')).not.toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/navigation-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/navigation-desktop.png'});
});
