import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('content surfaces drag, double-click edits, and the contextual rail centralizes tools with a back arrow',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const card=page.locator('.card.note').first(),field=card.getByLabel('Note content');
 await expect(page.locator('.card .handle,.card .rich-tools,.card .format-note,.card .add-label,.card .media-actions,.card .remove-task,.card .add-task')).toHaveCount(0);
 const box=await field.boundingBox();if(!box)throw Error('Missing note surface');
 const before=await card.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}));
 await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+100,box.y+70,{steps:5});await page.mouse.up();
 await expect(card).toHaveCSS('left',`${before.x+60}px`);await expect(card).toHaveCSS('top',`${before.y+30}px`);
 const tools=page.getByRole('region',{name:'Object tools'});await expect(tools).toBeVisible();await expect(page.getByRole('button',{name:'Note',exact:true})).toHaveCount(0);
 await expect(tools.getByRole('button',{name:'Format note'})).toBeVisible();await expect(tools.getByRole('button',{name:'Add label',exact:true})).toBeVisible();
 await field.dblclick();await expect(field).toBeFocused();await field.fill('Editable content only');
 const editingLeft=await card.evaluate(el=>(el as HTMLElement).style.left);await field.selectText();await expect(card).toHaveCSS('left',editingLeft);
 await tools.getByRole('button',{name:'Format note'}).click();await expect(tools.getByRole('button',{name:'bold',exact:true})).toBeVisible();await expect(card.locator('button')).toHaveCount(0);
 const rich=card.getByRole('textbox',{name:'Rich note content'});await rich.focus();await page.keyboard.press('Control+a');await tools.getByRole('button',{name:'bold',exact:true}).click();await expect(rich.locator('strong,b')).toHaveText('Editable content only');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 await tools.getByRole('button',{name:'Back to tools'}).click();await expect(tools).toHaveCount(0);await expect(page.getByRole('button',{name:'Note',exact:true})).toBeVisible();await expect(card).not.toHaveClass(/selected/);
 await page.screenshot({path:'test-results/object-sidebar-main.png'});await card.click({position:{x:8,y:8}});await page.screenshot({path:'test-results/object-sidebar-note.png'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await expect(page.getByRole('button',{name:'Back to tools'})).toBeVisible();
});
