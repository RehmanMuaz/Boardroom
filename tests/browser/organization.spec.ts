import {test,expect,type Page,type Locator} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {seed,type Workspace} from '../../src/model';
import {defaultTextStyle} from '../../src/annotations';

async function guest(page:Page,state?:Workspace){await page.goto('/');if(state)await page.evaluate(value=>localStorage.setItem('boardroom.v1',JSON.stringify(value)),state);await page.getByRole('button',{name:'Continue as guest'}).click();}
async function saved(page:Page){await expect(page.locator('.save')).toContainText('Saved locally');}
async function dragTo(page:Page,card:Locator,x:number,y:number){const handle=await card.locator('.handle').boundingBox();if(!handle)throw Error('Missing handle');await page.mouse.move(handle.x+handle.width/2,handle.y+10);await page.mouse.down();await page.mouse.move(x,y,{steps:8});await page.mouse.up();}

test('checklists edit titles/items directly and colorful note labels add/edit/remove, duplicate and persist',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await guest(page);
 const list=page.locator('.card.checklist');await expect(list.locator('textarea')).toHaveCount(0);await expect(list.getByText('TO DO',{exact:true})).toHaveCount(0);
 await list.getByLabel('List title').fill('Deliverables');await list.getByLabel('Task 1',{exact:true}).fill('Draft the story');await list.getByLabel('Complete task 1',{exact:true}).check();await list.getByLabel('Task 1',{exact:true}).fill('Approve the story');await expect(list.getByLabel('Complete task 1',{exact:true})).toBeChecked();
 await list.getByLabel('Task 2',{exact:true}).press('Enter');await expect(list.getByLabel('Task 3',{exact:true})).toBeFocused();await list.getByLabel('Task 3',{exact:true}).fill('New inline task');await list.getByLabel('Remove task 4',{exact:true}).click();
 const note=page.locator('[data-card-id=welcome]');await note.getByRole('button',{name:'Add label',exact:true}).click();await note.getByLabel('Label name').fill('Client review');await note.getByLabel('Label color').fill('#123456');await note.getByRole('button',{name:'Save label',exact:true}).click();await expect(note.locator('.note-label')).toHaveText('Client review');await expect(note.locator('.note-label')).toHaveCSS('color','rgb(255, 255, 255)');
 await note.locator('.note-label').click();await note.getByLabel('Label name').fill('Approved');await note.getByRole('button',{name:'Save label',exact:true}).click();
 await note.getByRole('button',{name:'Add label',exact:true}).click();await note.getByLabel('Label name').fill('Temporary');await note.getByRole('button',{name:'Save label',exact:true}).click();await note.getByRole('button',{name:'Temporary',exact:true}).click();await note.getByRole('button',{name:'Remove label',exact:true}).click();await expect(note.locator('.note-label')).toHaveText('Approved');
 await note.locator('.handle').click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();await expect(page.locator('.note-label')).toHaveCount(2);
 await saved(page);await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(page.getByLabel('List title')).toHaveValue('Deliverables');await expect(page.getByLabel('Task 1',{exact:true})).toHaveValue('Approve the story');await expect(page.getByLabel('Complete task 1',{exact:true})).toBeChecked();await expect(page.locator('.note-label')).toHaveCount(2);
 await page.getByLabel('Search cards').fill('Approved');await expect(page.locator('.card.note')).toHaveCount(2);await page.getByLabel('Search cards').fill('');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);expect(errors).toEqual([]);
});

test('dedicated line tool attaches at item centers above cards/annotations and follows move/resize; layers undo and reload',async({page})=>{
 const state:Workspace={version:1,boards:[{id:'home',title:'Connections',cards:[{id:'a',kind:'note',x:40,y:40,width:240,height:220,text:'Source',color:'#fff'},{id:'b',kind:'note',x:400,y:40,width:240,height:220,text:'Destination',color:'#fff'},{id:'overlap',kind:'note',x:40,y:350,width:240,height:220,text:'Overlap',color:'#fff'}],annotations:[{id:'text',kind:'text',x:40,y:350,width:240,height:100,text:'Annotation',color:'#123456',style:{...defaultTextStyle,background:'#e3efe9'}}]}]};
 await guest(page,state);const a=page.locator('[data-card-id=a]'),b=page.locator('[data-card-id=b]');
 await page.getByRole('button',{name:'Connect items',exact:true}).click();await a.click({position:{x:20,y:60}});await expect(page.locator('.connector-hint')).toContainText('destination');await b.click({position:{x:20,y:60}});const line=page.locator('.connection');await expect(line).toHaveAttribute('d','M 160 150 L 520 150');
 expect(await page.locator('.connectors').evaluate(el=>Number(getComputedStyle(el).zIndex))).toBeGreaterThan(20000);
 const view=await page.locator('.viewport').boundingBox();if(!view)throw Error('Missing canvas');await dragTo(page,a,view.x+220,view.y+60);await expect(line).toHaveAttribute('d',/L 520 150$/);
 const center=await a.evaluate(el=>{const h=el as HTMLElement;return [parseFloat(h.style.left)+parseFloat(h.style.width)/2,parseFloat(h.style.top)+parseFloat(h.style.height)/2];});await expect(line).toHaveAttribute('d',`M ${center[0]} ${center[1]} L 520 150`);
 await a.getByLabel('Resize note card').focus();await page.keyboard.press('ArrowRight');await expect(line).toHaveAttribute('d',`M ${center[0]+5} ${center[1]} L 520 150`);
 await page.locator('.text-annotation').click();await page.locator('.annotation-arrange summary').click();await page.getByRole('button',{name:'Send to back',exact:true}).click();const annotationLayer=await page.locator('.text-annotation').evaluate(el=>Number(getComputedStyle(el).zIndex));const noteLayer=await page.locator('[data-card-id=overlap]').evaluate(el=>Number(getComputedStyle(el).zIndex));expect(annotationLayer).toBeLessThan(noteLayer);
 await page.keyboard.press('Control+z');await expect(page.locator('.text-annotation')).toHaveCSS('z-index','6');await page.keyboard.press('Control+Shift+z');await expect(page.locator('.text-annotation')).toHaveCSS('z-index',String(annotationLayer));
 await a.locator('.handle').click();await page.locator('.selection .layer-controls summary').click();await page.getByRole('button',{name:'Bring to front',exact:true}).click();
 await saved(page);await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(line).toHaveCount(1);await expect(page.locator('.text-annotation')).toHaveCSS('z-index','1');
 await page.getByRole('button',{name:'Connect items',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Connect items',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.screenshot({path:'test-results/organization-connections.png'});
});

test('column drag/drop fits items, resizes within bounds, reorders vertically, moves groups and tracks membership with undo',async({page})=>{
 const state:Workspace={version:1,boards:[{id:'home',title:'Columns',cards:[{id:'a',kind:'note',x:30,y:30,width:500,height:180,text:'First card',color:'#fff'},{id:'b',kind:'checklist',x:30,y:250,title:'Tasks',text:'Deliver',color:'#fff',height:150},{id:'column',kind:'column',x:600,y:30,width:320,height:600,text:'Production',color:'#ebeee8'}]}]};
 await guest(page,state);const a=page.locator('[data-card-id=a]'),b=page.locator('[data-card-id=b]'),column=page.locator('[data-card-id=column]');const view=await page.locator('.viewport').boundingBox();if(!view)throw Error('Missing canvas');
 await dragTo(page,a,view.x+740,view.y+160);await expect(column.locator('.column-summary')).toHaveText('1 card');await expect(a).toHaveCSS('width','288px');await expect(a).toHaveCSS('left','616px');
 await dragTo(page,b,view.x+740,view.y+420);await expect(column.locator('.column-summary')).toHaveText('2 cards');expect(await b.evaluate(el=>parseFloat((el as HTMLElement).style.top))).toBeGreaterThan(await a.evaluate(el=>parseFloat((el as HTMLElement).style.top)));
 await dragTo(page,b,view.x+740,view.y+130);await expect(b).toHaveCSS('top','130px');await expect(a).toHaveCSS('top','300px');
 await page.keyboard.press('Control+z');await expect(a).toHaveCSS('top','130px');await expect(b).toHaveCSS('top','330px');await page.keyboard.press('Control+Shift+z');await expect(b).toHaveCSS('top','130px');
 await a.locator('.handle').click();await a.getByLabel('Resize note card').focus();await page.keyboard.press('ArrowRight');await expect(a).toHaveCSS('width','288px');await page.keyboard.press('ArrowLeft');await expect(a).toHaveCSS('width','278px');
 await dragTo(page,column,view.x+820,view.y+50);await expect(a).toHaveCSS('left','676px');await expect(b).toHaveCSS('left','676px');
 await dragTo(page,b,view.x+200,view.y+300);await expect(column.locator('.column-summary')).toHaveText('1 card');await page.keyboard.press('Control+z');await expect(column.locator('.column-summary')).toHaveText('2 cards');
 await saved(page);await page.reload();await page.getByRole('button',{name:'Continue as guest'}).click();await expect(column.locator('.column-summary')).toHaveText('2 cards');await expect(a).toHaveCSS('width','278px');await expect(b).toHaveCSS('left','676px');
 await page.screenshot({path:'test-results/organization-columns.png'});
});
