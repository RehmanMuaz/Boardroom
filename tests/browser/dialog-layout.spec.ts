import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('header search is centered, Account is on the right, and export/help stay inside responsive dialogs',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).click();
 const search=page.getByRole('combobox',{name:'Search commands',exact:true}),account=page.getByRole('button',{name:'Account',exact:true}),actions=page.getByRole('button',{name:'Board actions',exact:true});
 const searchBox=await page.locator('.header-command-search').boundingBox(),accountBox=await account.boundingBox(),actionsBox=await actions.boundingBox();if(!searchBox||!accountBox||!actionsBox)throw Error('Missing header controls');
 expect(Math.abs(searchBox.x+searchBox.width/2-720)).toBeLessThan(2);expect(accountBox.x).toBeGreaterThan(actionsBox.x);
 await search.fill('zoom');await expect(page.getByRole('listbox',{name:'Commands',exact:true})).toBeVisible();await search.press('ArrowDown');await expect(search).toHaveAttribute('aria-activedescendant',/.+/);await search.press('Enter');await expect(search).toHaveAttribute('aria-expanded','false');
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);await actions.click();const dialog=page.getByRole('dialog',{name:'Board actions',exact:true});await expect(dialog.getByLabel('Export format')).toHaveValue('json');await expect(dialog.getByRole('option',{name:'PDF document',exact:true})).not.toHaveAttribute('disabled');
  const help=dialog.getByText('Keyboard shortcuts',{exact:true});if(await dialog.locator('.dialog-help').getAttribute('open')===null)await help.click();const content=dialog.locator('.dialog-help>div');await expect(content).toHaveCSS('position','static');await content.locator('p').scrollIntoViewIfNeeded();
  const box=await dialog.boundingBox(),helpBox=await content.boundingBox();if(!box||!helpBox)throw Error('Missing dialog/help');expect(helpBox.x).toBeGreaterThanOrEqual(box.x);expect(helpBox.x+helpBox.width).toBeLessThanOrEqual(box.x+box.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
  await page.screenshot({path:`test-results/dialog-layout-${size.width}.png`});await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 }
});
