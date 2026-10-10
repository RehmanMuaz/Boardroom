import {test,expect} from '@playwright/test';

test('guest annotations draw at zoom, focus text, format, move, undo and survive reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 await page.getByText('Board appearance',{exact:true}).click();await page.getByLabel('Board background color').fill('#19302a');await page.getByLabel('Board canvas pattern').selectOption('plain');await page.getByText('Board appearance',{exact:true}).click();
 await expect(page.locator('.viewport')).toHaveCSS('background-image','none');
 for(const zoom of [1,.5,1.5]){
  await page.locator('.zoom button').nth(1).click();
  for(let i=0;i<5&&zoom!==1;i++)await page.getByLabel(zoom<1?'Zoom out':'Zoom in').click();
  await page.getByRole('button',{name:'Pen',exact:true}).click();
  if(zoom===1){await page.getByLabel('Stroke thickness slider',{exact:true}).press('End');await expect(page.getByLabel('Stroke thickness',{exact:true})).toHaveValue('60');await page.getByLabel('Stroke thickness',{exact:true}).fill('6');await expect(page.getByLabel('Stroke thickness slider',{exact:true})).toHaveValue('6');}
  const viewport=await page.locator('.viewport').boundingBox();if(!viewport)throw Error('Missing canvas');
  const x=viewport.x+350,y=viewport.y+210;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+30,{steps:6});await page.mouse.up();
  const stroke=page.locator('.stroke-annotation').last();
  expect(await stroke.evaluate(el=>Number(el.getAttribute('width')))).toBeCloseTo(60/zoom);
 }
 await page.locator('.zoom button').nth(1).click();
 await page.getByRole('button',{name:'Text annotation tool'}).click();
 const viewport=await page.locator('.viewport').boundingBox();if(!viewport)throw Error('Missing canvas');
 await page.mouse.click(viewport.x+400,viewport.y+320);
 const input=page.getByLabel('Annotation text',{exact:true});await expect(input).toBeFocused();await input.fill('Styled canvas title');await input.press('Escape');
 await page.getByText('Text style',{exact:true}).click();
 await page.getByLabel('Annotation text preset').selectOption('heading');await expect(page.locator('.text-annotation')).toHaveCSS('font-size','40px');
 await page.getByLabel('Annotation font size slider',{exact:true}).press('End');await expect(page.getByLabel('Annotation font size',{exact:true})).toHaveValue('120');await expect(page.locator('.text-annotation')).toHaveCSS('font-size','120px');
 await page.getByLabel('Annotation font size',{exact:true}).fill('40');await expect(page.getByLabel('Annotation font size slider',{exact:true})).toHaveValue('40');
 await page.getByLabel('Annotation font',{exact:true}).selectOption('serif');
 await page.getByLabel('Annotation font weight').selectOption('700');
 await page.getByLabel('Annotation border width').selectOption('2');
 await page.getByText('Text style',{exact:true}).click();
 const text=page.locator('.text-annotation');await expect(text).toHaveCSS('font-weight','700');await expect(text).toHaveCSS('border-top-width','2px');
 const before=await text.evaluate(el=>parseFloat((el as HTMLElement).style.left));const box=await text.boundingBox();if(!box)throw Error('Missing text');
 await page.mouse.move(box.x+50,box.y+30);await page.mouse.down();await page.mouse.move(box.x+90,box.y+50,{steps:5});await page.mouse.up();
 expect(await text.evaluate(el=>parseFloat((el as HTMLElement).style.left))).toBeCloseTo(before+40);
 await page.getByRole('button',{name:'Delete annotation',exact:true}).click();await expect(text).toHaveCount(0);await page.keyboard.press('Control+z');await expect(text).toContainText('Styled canvas title');
 await expect(page.locator('.save')).toContainText('Saved locally');await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();
 await expect(page.locator('.stroke-annotation')).toHaveCount(3);await expect(text).toContainText('Styled canvas title');await expect(text).toHaveCSS('font-weight','700');
 await expect(page.locator('.viewport')).toHaveCSS('background-color','rgb(25, 48, 42)');await expect(page.locator('.viewport')).toHaveCSS('background-image','none');
 await page.screenshot({path:'test-results/annotations-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Highlighter',exact:true}).click();
 await expect(page.getByLabel('Stroke thickness',{exact:true})).toBeVisible();await expect(page.getByLabel('Stroke thickness slider',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'test-results/annotations-mobile.png'});
 expect(errors).toEqual([]);
});
