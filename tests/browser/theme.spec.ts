import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import AxeBuilder from '@axe-core/playwright';

test('device appearance follows System, survives reload, preserves cards and fits mobile',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByLabel('Appearance',{exact:true}).selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('light');
 await page.getByLabel('Appearance',{exact:true}).selectOption('system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Continue as guest'}).click();
 const card=page.locator('.card.note').first(),original=await card.evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.getByLabel('Account',{exact:true}).click();await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await page.getByLabel('Account',{exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await card.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(original);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.setViewportSize({width:390,height:844});await page.getByLabel('Account',{exact:true}).click();await expect(page.getByLabel('Appearance',{exact:true})).toBeVisible();
});

test('account appearance survives sign out and a second browser without leaking into device mode',async({page,browser})=>{
 const email=`theme-browser-${randomUUID()}@example.com`,password='browser-theme-password-long';
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});
 const second=await browser.newContext({baseURL:'http://localhost:5174'});
 try{
  await page.emulateMedia({colorScheme:'light'});await page.goto('/');await page.getByLabel('Appearance',{exact:true}).selectOption('light');
  await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill(password);await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();
  await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.getByLabel('Appearance',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Continue as guest'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByLabel('Switch workspace',{exact:true}).click();await page.getByRole('button',{name:'All workspaces',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  const other=await second.newPage();await other.goto('/');await other.getByLabel('Email',{exact:true}).fill(email);await other.getByLabel('Password (12+ characters)').fill(password);await other.getByRole('button',{name:'Continue',exact:true}).click();await expect(other.getByRole('heading',{name:'Your workspaces'})).toBeVisible();await expect(other.getByLabel('Appearance',{exact:true})).toHaveValue('dark');await expect(other.locator('html')).toHaveAttribute('data-theme','dark');
 }finally{await second.close();await pool.query("DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM accounts WHERE email=$1)",[email]);await pool.query('DELETE FROM accounts WHERE email=$1',[email]);await pool.end();}
});
