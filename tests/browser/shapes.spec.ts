import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('shapes draw with zoom, preserve direction, move, resize, fill, undo and reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const viewport=await page.locator('.viewport').boundingBox();if(!viewport)throw Error('Missing canvas');
 for(const [index,shape] of ['arrow','line','rectangle','circle'].entries()){
  if(await page.getByRole('button',{name:'Back to tools'}).count())await page.getByRole('button',{name:'Back to tools'}).click();await page.getByRole('button',{name:'Shape annotation tool'}).click();await page.getByLabel('Annotation shape',{exact:true}).selectOption(shape);
  const zoom=index===0?.5:1;await page.locator('.zoom button').nth(1).click();if(zoom===.5)for(let i=0;i<5;i++)await page.getByLabel('Zoom out').click();
  const x=viewport.x+900,y=viewport.y+80+index*90;await page.mouse.move(x+100,y+60);await page.mouse.down();await page.mouse.move(x,y,{steps:5});await page.mouse.up();
  const annotation=page.getByRole('button',{name:shape+' annotation',exact:true});await expect(annotation).toHaveCount(1);
  const svg=annotation.locator('..');expect(await svg.evaluate(el=>Number(el.getAttribute('width')))).toBeCloseTo(100/zoom);
 }
 if(await page.getByRole('button',{name:'Back to tools'}).count())await page.getByRole('button',{name:'Back to tools'}).click();await page.getByRole('button',{name:'Select annotations'}).click();const rect=page.getByRole('button',{name:'rectangle annotation',exact:true});await rect.focus();await rect.press('Enter');
 await page.getByLabel('Shape fill enabled').check();await page.getByLabel('Shape fill color',{exact:true}).fill('#fff4c9');
 const svg=rect.locator('..');await expect(svg.locator('path').first()).toHaveAttribute('fill','#fff4c9');
 const box=await svg.boundingBox();if(!box)throw Error('Missing shape');const before=await svg.evaluate(el=>parseFloat((el as HTMLElement).style.left));
 await page.mouse.move(box.x+25,box.y+25);await page.mouse.down();await page.mouse.move(box.x+55,box.y+45,{steps:4});await page.mouse.up();expect(await svg.evaluate(el=>parseFloat((el as HTMLElement).style.left))).toBeCloseTo(before+30);
 const resize=page.getByRole('slider',{name:'Resize shape annotation'});await resize.focus();await resize.press('ArrowRight');await expect(svg).toHaveAttribute('width','110');
 await resize.press('Shift+ArrowUp');await expect(svg).toHaveAttribute('height','70');
 await page.getByRole('button',{name:'Delete annotation'}).click();await expect(rect).toHaveCount(0);await page.keyboard.press('Control+z');await expect(rect).toHaveCount(1);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 await expect(page.locator('.save')).toContainText('Saved locally');await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(rect).toHaveCount(1);await expect(rect.locator('..').locator('path').first()).toHaveAttribute('fill','#fff4c9');
 await page.screenshot({path:'test-results/shapes-desktop.png'});await page.setViewportSize({width:390,height:844});if(await page.getByRole('button',{name:'Back to tools'}).count())await page.getByRole('button',{name:'Back to tools'}).click();await page.getByRole('button',{name:'Shape annotation tool'}).click();await expect(page.getByLabel('Annotation shape',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/shapes-mobile.png'});expect(errors).toEqual([]);
});
