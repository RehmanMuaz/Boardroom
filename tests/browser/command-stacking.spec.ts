import {test,expect} from '@playwright/test';

test('command results stay above canvas and modifier sidebar and accept pointer selection at every header breakpoint',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('boardroom.v1',JSON.stringify({version:1,boards:[{id:'home',title:'Stacking',cards:[{id:'cover',kind:'note',x:0,y:0,width:4000,height:2000,layer:20000,text:'Canvas below search',color:'#fff'}]}]})));await page.getByRole('button',{name:'Continue as guest'}).click();await page.locator('[data-card-id=cover]').click({position:{x:200,y:8}});
 for(const size of [{width:1440,height:1000},{width:900,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);const search=page.getByRole('combobox',{name:'Search commands',exact:true});await search.fill('');await search.focus();const options=page.getByRole('listbox',{name:'Commands',exact:true}).getByRole('option');await expect(options.first()).toBeVisible();
  // CSS visibility alone misses content painted behind another stacking context.
  for(const option of await options.all()){
   await option.scrollIntoViewIfNeeded();expect(await option.evaluate(el=>{const box=el.getBoundingClientRect();return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));})).toBe(true);
  }
  await search.fill('PDF');const pdf=page.getByRole('option',{name:'Export current board to PDF',exact:true});await pdf.click();await expect(page.getByRole('dialog',{name:'Board actions',exact:true})).toBeVisible();await expect(page.getByLabel('Export format')).toHaveValue('pdf');await page.keyboard.press('Escape');await search.focus();await search.fill('');await page.screenshot({path:`test-results/search-stacking-${size.width}.png`});await search.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 }
});
