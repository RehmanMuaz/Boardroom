import nodemailer from 'nodemailer';
export type Mail={to:string;subject:string;text:string;html?:string};
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
// Keep a plain-text alternative and explicitly link URLs for clients without auto-linking.
export function emailHtml(text:string){
 const parts=text.split(/(https?:\/\/[^\s<>"']+)/g);
 return '<!doctype html><html><body>'+parts.map((part,index)=>index%2
  ?`<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>`
  :escapeHtml(part).replace(/\n/g,'<br>')).join('')+'</body></html>';
}
export interface Mailer {send(mail:Mail):Promise<void>}
export function smtpMailer(env:NodeJS.ProcessEnv):Mailer|undefined{
 if(!env.SMTP_HOST)return undefined;
 if(!env.SMTP_FROM)throw Error('SMTP_FROM is required with SMTP_HOST');
 const port=Number(env.SMTP_PORT??587);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid SMTP_PORT');
 if(Boolean(env.SMTP_USER)!==Boolean(env.SMTP_PASSWORD))throw Error('Set both SMTP_USER and SMTP_PASSWORD');
 const secure=env.SMTP_SECURE==='true';
 const transport=nodemailer.createTransport({host:env.SMTP_HOST,port,secure,requireTLS:!secure&&env.SMTP_ALLOW_INSECURE!=='true',
  ...(env.SMTP_USER?{auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD!}}:{}),
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 return {async send(mail){const result=await transport.sendMail({from:env.SMTP_FROM,...mail,html:mail.html??emailHtml(mail.text)});if(!result.accepted?.length)throw Error('Email not accepted');}};
}
