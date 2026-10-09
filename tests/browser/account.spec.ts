import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {type AddressInfo} from 'node:net';
import {Pool} from 'pg';
import {createApp} from '../../server/app';
import {migrate} from '../../server/migrate';
import {type Mail} from '../../server/mail';
import AxeBuilder from '@axe-core/playwright';

test('email links confirm verification and complete password recovery through the existing entry UI',async({page})=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??process.env.DATABASE_URL});await migrate(pool);const mail:Mail[]=[],email=`browser-account-${randomUUID()}@example.com`,namespace='account-ui-'+randomUUID();
 const app=createApp(pool,{secret:'account-browser-test-secret-long-enough',origin:'http://localhost:5174',requireVerification:true,rateNamespace:namespace,log:()=>{},mailer:{async send(message){mail.push(message);}}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const target=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 // Redirect HTTP to an isolated real API with a captured-mail transport; no external email.
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:target+url.pathname+url.search});await route.fulfill({response});});
 try{
  await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill('browser-original-password');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();await expect.poll(()=>mail.length).toBe(1);
  const verification=mail[0].text.match(/#verify=[a-f0-9]{64}/)![0];await page.goto('/'+verification);await expect(page.getByRole('heading',{name:'Verify your email',exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('');await page.getByRole('button',{name:'Confirm email verification'}).click();await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send reset email'}).click();await expect(page.getByRole('status')).toContainText('If an account exists');await expect.poll(()=>mail.length).toBe(2);
  const reset=mail[1].text.match(/#reset=[a-f0-9]{64}/)![0];await page.goto('/'+reset);await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();expect(new URL(page.url()).hash).toBe('');
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByLabel('New password (12+ characters)').fill('browser-recovered-password');await page.getByRole('button',{name:'Change password',exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('Password changed');
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password (12+ characters)').fill('browser-recovered-password');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Your workspaces'})).toBeVisible();
 }finally{
  await page.unrouteAll({behavior:'wait'});await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.query("DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM accounts WHERE email=$1)",[email]);await pool.query('DELETE FROM accounts WHERE email=$1',[email]);await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1',[namespace+':%']);await pool.end();
 }
});
