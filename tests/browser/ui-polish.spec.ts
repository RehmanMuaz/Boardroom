import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('UI audit: workspace chevron, responsive dialogs, controls and primary actions',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 for(const size of [{width:1440,height:1000},{width:1024,height:768},{width:768,height:600},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);
  const switcher=page.getByLabel('Switch workspace',{exact:true});await switcher.click();
  await page.screenshot({path:`test-results/ui-workspace-${size.width}.png`});await switcher.click();
  for(const name of ['Account','Board actions']){
   await page.getByRole('button',{name,exact:true}).click();const dialog=page.getByRole('dialog',{name,exact:true});
   if(name==='Board actions'){await dialog.getByLabel('Export format').selectOption('pdf');}
   await page.screenshot({path:`test-results/ui-${name.replace(' ','-')}-${size.width}.png`});
   const dimensions=await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.getBoundingClientRect().height}));
   expect.soft(dimensions.scroll,`${name} horizontal overflow at ${size.width}`).toBeLessThanOrEqual(dimensions.width+1);
   expect.soft(dimensions.height).toBeLessThanOrEqual(size.height-16);
   expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
   await page.keyboard.press('Escape');
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Board actions',exact:true}).click();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
});
