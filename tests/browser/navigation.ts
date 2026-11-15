import {type Page} from '@playwright/test';
export async function toggleTeam(page:Page){
 if(await page.getByRole('dialog',{name:'Manage team',exact:true}).isVisible())await page.getByRole('button',{name:'Close Manage team',exact:true}).click();
 else await page.getByRole('button',{name:'Manage team',exact:true}).click();
}
