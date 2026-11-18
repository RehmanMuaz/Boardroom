import {test,expect,type CDPSession} from '@playwright/test';
async function touch(cdp:CDPSession,type:'touchStart'|'touchMove'|'touchEnd',points:{id:number;x:number;y:number}[]){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
test('phone touch navigation pans without edits, selects, moves explicitly, pinches and opens properties',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://localhost:5174',viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).tap();const cdp=await context.newCDPSession(page);
 const view=page.locator('.viewport');await expect(view).toBeVisible();const box=(await view.boundingBox())!;
 const card=page.locator('[data-card-id="welcome"]');const initial=await card.evaluate(el=>({x:(el as HTMLElement).style.left,y:(el as HTMLElement).style.top}));
 const x=box.x+150,y=box.y+120;
 await touch(cdp,'touchStart',[{id:1,x,y}]);await touch(cdp,'touchMove',[{id:1,x:x-70,y:y-40}]);await touch(cdp,'touchEnd',[]);
 await expect.poll(()=>view.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);expect(await card.evaluate(el=>({x:(el as HTMLElement).style.left,y:(el as HTMLElement).style.top}))).toEqual(initial);
 await view.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
 const rect=(await card.boundingBox())!;await page.touchscreen.tap(rect.x+30,rect.y+30);await expect(card).toHaveClass(/selected/);
 await expect(page.getByRole('button',{name:'Properties',exact:true})).toBeVisible();await page.getByRole('button',{name:'Properties',exact:true}).tap();await expect(page.getByRole('region',{name:'Object tools'})).toBeVisible();await page.getByRole('button',{name:'Hide properties'}).tap();
 await page.getByRole('button',{name:'Move items',exact:true}).tap();const before=await card.evaluate(el=>parseFloat((el as HTMLElement).style.left));
 await touch(cdp,'touchStart',[{id:1,x:rect.x+30,y:rect.y+30}]);await touch(cdp,'touchMove',[{id:1,x:rect.x+70,y:rect.y+50}]);await touch(cdp,'touchEnd',[]);await expect.poll(()=>card.evaluate(el=>parseFloat((el as HTMLElement).style.left))).toBeCloseTo(before+40,0);
 const moved=await card.evaluate(el=>(el as HTMLElement).style.left);
 await touch(cdp,'touchStart',[{id:1,x:130,y:box.y+180}]);await touch(cdp,'touchStart',[{id:1,x:130,y:box.y+180},{id:2,x:230,y:box.y+180}]);await touch(cdp,'touchMove',[{id:1,x:100,y:box.y+180},{id:2,x:260,y:box.y+180}]);await touch(cdp,'touchEnd',[]);
 await expect(page.locator('.zoom')).toContainText('160%');expect(await card.evaluate(el=>(el as HTMLElement).style.left)).toEqual(moved);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const nav=(await page.getByRole('toolbar',{name:'Touch navigation'}).boundingBox())!,dock=(await page.getByRole('toolbar',{name:'Annotation tools',exact:true}).boundingBox())!;expect(nav.y+nav.height).toBeLessThanOrEqual(dock.y);
 await page.screenshot({path:'.deploy-test/mobile-portrait.png'});
 await page.locator('.zoom button').nth(1).tap();await page.getByRole('button',{name:'Pan',exact:true}).tap();await view.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});const editBox=(await card.boundingBox())!;await page.touchscreen.tap(editBox.x+30,editBox.y+30);await page.touchscreen.tap(editBox.x+30,editBox.y+30);await expect(card.getByLabel('Note content')).toBeFocused();await expect(card).toHaveClass(/editing/);
 await page.setViewportSize({width:390,height:550});await expect(page.locator('.app')).toHaveCSS('height','550px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});

test('touch multi-selection groups items; pinch cancels movement and armed placement safely',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://localhost:5174',viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('boardroom.v1',JSON.stringify({version:1,boards:[{id:'home',title:'Touch test',cards:[{id:'a',kind:'note',x:25,y:25,width:160,height:100,text:'First',color:'#ffffff'},{id:'b',kind:'note',x:205,y:25,width:160,height:100,text:'Second',color:'#ffffff'}]}]})));
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).tap();const cdp=await context.newCDPSession(page),view=(await page.locator('.viewport').boundingBox())!;
 await page.touchscreen.tap(55,view.y+55);await page.getByRole('button',{name:'Multi-select',exact:true}).tap();await page.touchscreen.tap(235,view.y+55);await expect(page.locator('.card.selected')).toHaveCount(2);await page.getByRole('button',{name:'Group selection',exact:true}).tap();await expect(page.getByRole('button',{name:'Ungroup selection',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Multi-select',exact:true}).tap();await page.getByRole('button',{name:'Move items',exact:true}).tap();
 await touch(cdp,'touchStart',[{id:1,x:55,y:view.y+55}]);await touch(cdp,'touchMove',[{id:1,x:85,y:view.y+65}]);await expect(page.locator('[data-card-id=a]')).toHaveCSS('left','55px');
 await touch(cdp,'touchStart',[{id:1,x:85,y:view.y+65},{id:2,x:200,y:view.y+100}]);await touch(cdp,'touchEnd',[]);await expect(page.locator('[data-card-id=a]')).toHaveCSS('left','25px');await expect(page.locator('[data-card-id=b]')).toHaveCSS('left','205px');
 await page.getByRole('button',{name:'Tools',exact:true}).tap();await page.getByRole('button',{name:'Note',exact:true}).tap();
 await touch(cdp,'touchStart',[{id:1,x:100,y:view.y+200}]);await touch(cdp,'touchStart',[{id:1,x:100,y:view.y+200},{id:2,x:220,y:view.y+200}]);await touch(cdp,'touchEnd',[]);await expect(page.locator('.card')).toHaveCount(2);await expect(page.locator('.creation-placement')).toHaveCount(0);
 await page.getByRole('button',{name:'Note',exact:true}).tap();await page.touchscreen.tap(100,view.y+200);await expect(page.locator('.card')).toHaveCount(3);
 await context.close();
});
for(const edge of ['top','middle','bottom'] as const){
 test(`phone creation strip scrolls from button ${edge} without arming or placing a tool`,async({browser})=>{
  const context=await browser.newContext({baseURL:'http://localhost:5174',viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.goto('/');await page.getByRole('button',{name:'Continue as guest'}).tap();const strip=page.locator('aside>.tools'),box=(await strip.boundingBox())!,count=await page.locator('.card').count(),y=box.y+(edge==='top'?2:edge==='bottom'?box.height-2:box.height/2),x=box.x+225;
  expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('button'),{x,y})).toBe(true);
  const cdp=await context.newCDPSession(page);await touch(cdp,'touchStart',[{id:1,x,y}]);for(let step=1;step<=8;step++)await touch(cdp,'touchMove',[{id:1,x:x-step*20,y}]);await touch(cdp,'touchEnd',[]);
  await expect.poll(()=>strip.evaluate(el=>el.scrollLeft)).toBeGreaterThan(60);await expect(page.locator('.card')).toHaveCount(count);await expect(page.locator('.creation-preview,.creation-placement')).toHaveCount(0);
  await context.close();
 });
}
