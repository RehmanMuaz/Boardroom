import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';

test('property search reveals advanced controls and remembers per-type arrangement without altering content',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const note=page.locator('[data-card-id=welcome]');await note.click({position:{x:200,y:8}});
 const panel=page.getByRole('region',{name:'Object tools'});
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);const row=panel.getByRole('group',{name:'Quick actions',exact:true}),buttons=row.getByRole('button');await expect(buttons).toHaveCount(4);await expect(row.locator('svg')).toHaveCount(4);expect(await buttons.allTextContents()).toEqual(['','','','']);
  const rail=await page.locator('aside').boundingBox(),bounds=await buttons.evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,height:b.height};}));if(!rail)throw Error('Missing sidebar');
  for(const [index,b] of bounds.entries()){expect(b.x).toBeGreaterThanOrEqual(rail.x);expect(b.right).toBeLessThanOrEqual(rail.x+rail.width);expect(b.bottom).toBeLessThanOrEqual(size.height);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.y).toBe(bounds[0].y);if(index)expect(b.x).toBeGreaterThanOrEqual(bounds[index-1].right);}
  await page.screenshot({path:`test-results/quick-actions-${size.width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});
 await expect(panel.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Delete card',exact:true})).toBeVisible();await expect(panel.getByLabel('Item width')).not.toBeVisible();
 await panel.getByLabel('Find a property').fill('width');await expect(panel.getByLabel('Item width')).toBeVisible();
 await panel.getByLabel('Find a property').press('Escape');await expect(panel.getByLabel('Item width')).not.toBeVisible();
 await panel.getByRole('tab',{name:'Arrange',exact:true}).click();await expect(panel.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Delete card',exact:true})).toBeVisible();await expect(panel.getByLabel('Item width')).toBeVisible();
 await page.getByRole('button',{name:'Back to tools'}).click();await note.click({position:{x:200,y:8}});
 await expect(panel.getByRole('tab',{name:'Arrange',exact:true})).toHaveAttribute('aria-selected','true');
 await panel.getByRole('button',{name:'Duplicate',exact:true}).click();await expect(page.locator('.card.note')).toHaveCount(3);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.card.note')).toHaveCount(2);
 await page.keyboard.press('Control+k');await expect(page.getByRole('combobox',{name:'Search commands',exact:true})).toBeFocused();
 await page.getByRole('combobox',{name:'Search commands',exact:true}).fill('snapping');await page.keyboard.press('Enter');
 await expect(page.getByRole('combobox',{name:'Search commands',exact:true})).toHaveAttribute('aria-expanded','false');
 await page.getByText('Board appearance',{exact:true}).click();await expect(page.getByLabel('Snap to grid',{exact:true})).toBeChecked();
});

test('team dialogs preserve invitation and client-link drafts until explicitly discarded',async({page})=>{
 const suffix=randomUUID(),pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});let userId='',workspaceId='';
 try{
  await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(`dialog-${suffix}@example.com`);await page.getByLabel('Password (12+ characters)').fill('dialog-test-password-long');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();userId=(await (await page.request.get('/api/session')).json()).userId;
  await page.getByLabel('New workspace').fill(suffix);await page.getByRole('button',{name:'Create workspace',exact:true}).click();await expect(page.getByRole('button',{name:new RegExp(suffix)})).toBeVisible();workspaceId=(await (await page.request.get('/api/workspaces')).json()).find((w:{name:string})=>w.name===suffix).id;
  await page.getByRole('button',{name:new RegExp(suffix)}).click();await page.getByRole('button',{name:'Manage team',exact:true}).click();
  await page.getByLabel('Invite email').fill('draft@example.com');await page.keyboard.press('Escape');await expect(page.getByText('Discard unsaved changes?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Invite email')).toHaveValue('draft@example.com');await page.getByLabel('Invite email').clear();
  await page.getByText('Client viewing links',{exact:true}).click();await page.getByLabel('Client viewer email').fill('client@example.com');await page.getByRole('button',{name:'Close Manage team',exact:true}).click();await expect(page.getByText('Discard unsaved changes?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Client viewer email')).toHaveValue('client@example.com');
  await page.getByRole('button',{name:'Close Manage team',exact:true}).click();await page.getByRole('button',{name:'Discard and close',exact:true}).click();await page.getByRole('button',{name:'Manage team',exact:true}).click();await page.getByText('Client viewing links',{exact:true}).click();await expect(page.getByLabel('Client viewer email')).toHaveValue('');
 }finally{if(workspaceId)await pool.query('DELETE FROM team_workspaces WHERE id=$1',[workspaceId]);if(userId){await pool.query("DELETE FROM session WHERE sess->>'userId'=$1",[userId]);await pool.query('DELETE FROM accounts WHERE id=$1',[userId]);}await pool.end();}
});

test('settings dialogs contain focus, isolate canvas shortcuts, return focus and fit a phone',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();await page.locator('[data-card-id=welcome]').click({position:{x:200,y:8}});
 const trigger=page.getByRole('button',{name:'Account',exact:true});await trigger.click();const modal=page.getByRole('dialog',{name:'Account',exact:true});await expect(modal).toBeVisible();
 await page.keyboard.press('Delete');await expect(page.locator('[data-card-id=welcome]')).toHaveCount(1);
 for(let n=0;n<8;n++){await page.keyboard.press('Tab');expect(await modal.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 await page.keyboard.press('Escape');await expect(modal).not.toBeVisible();await expect(trigger).toBeFocused();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Board actions',exact:true}).click();await expect(page.getByRole('button',{name:'Export',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.keyboard.press('Escape');await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search commands',exact:true}).fill('duplicate');await page.getByRole('combobox',{name:'Search commands',exact:true}).press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('.card.note')).toHaveCount(3);
});
