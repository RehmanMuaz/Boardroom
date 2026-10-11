import {test,expect} from '@playwright/test';
test('creation rail layout stays fixed while drag/click placement follows zoom and scroll, cancels, and supports keyboard undo',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();const note=page.getByRole('button',{name:'Note',exact:true});const rail=await page.locator('aside').boundingBox();
 for(const zoom of [1,.5,1.5]){
  await page.locator('.zoom button').nth(1).click();for(let i=0;i<5&&zoom!==1;i++)await page.getByLabel(zoom<1?'Zoom out':'Zoom in').click();
  const scroll=await page.locator('.viewport').evaluate(el=>{el.scrollLeft=120;el.scrollTop=80;return {x:el.scrollLeft,y:el.scrollTop};});const view=await page.locator('.viewport').boundingBox(),button=await note.boundingBox();if(!view||!button)throw Error('Missing canvas/tools');
  const initial=await page.locator('.card.note').count(),x=view.x+650,y=view.y+180;
  await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:8});await expect(page.locator('.creation-preview')).toBeVisible();await expect(page.locator('.card.note')).toHaveCount(initial);await page.mouse.up();
  const added=page.locator('.card.note').last();await expect(page.locator('.card.note')).toHaveCount(initial+1);const position=await added.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}));expect(position.x).toBeCloseTo((650+scroll.x)/zoom,2);expect(position.y).toBeCloseTo((180+scroll.y)/zoom,2);
  await page.getByRole('button',{name:'Back to tools'}).click();expect(await page.locator('aside').boundingBox()).toEqual(rail);
 }
 await page.locator('.zoom button').nth(1).click();await page.locator('.viewport').evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
 const count=await page.locator('.card.note').count();await note.click();await expect(page.locator('.card.note')).toHaveCount(count);await page.keyboard.press('Escape');await expect(page.locator('.creation-placement')).toHaveCount(0);
 const button=await note.boundingBox();if(!button)throw Error('Missing tool');await page.mouse.move(button.x+10,button.y+10);await page.mouse.down();await page.mouse.move(500,120,{steps:5});await page.mouse.up();await expect(page.locator('.card.note')).toHaveCount(count);
 await page.mouse.move(button.x+10,button.y+10);await page.mouse.down();await page.mouse.move(500,420,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.card.note')).toHaveCount(count);await expect(page.locator('.creation-placement,.creation-preview')).toHaveCount(0);
 await note.focus();await note.press('Enter');await expect(page.locator('.creation-placement')).toBeVisible();await page.keyboard.press('Enter');await expect(page.locator('.card.note')).toHaveCount(count+1);await page.keyboard.press('Control+z');await expect(page.locator('.card.note')).toHaveCount(count);await page.keyboard.press('Control+Shift+z');await expect(page.locator('.card.note')).toHaveCount(count+1);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'To-do',exact:true}).click();const view=await page.locator('.viewport').boundingBox();if(!view)throw Error('Missing viewport');await page.mouse.click(view.x+900,view.y+230);await expect(page.locator('.card.checklist').last()).toHaveCSS('left','900px');
 await page.getByRole('button',{name:'Back to tools'}).click();await page.setViewportSize({width:390,height:844});await note.click();await page.locator('.creation-placement').click({position:{x:40,y:40}});await expect(page.locator('.card.note').last()).toHaveCSS('left','40px');
 await expect(page.locator('.save')).toContainText('Saved locally');await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(page.locator('.card.note')).toHaveCount(count+2);
});
