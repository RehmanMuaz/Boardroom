import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Socket,type AddressInfo} from 'node:net';
import {emailHtml,smtpMailer} from '../server/mail';

test('email links preserve account fragments and escape HTML content',()=>{
 for(const purpose of ['reset','verify','invite']){
  const link=`https://boards.example.com/#${purpose}=abc123`;
  const html=emailHtml(`Open this link:\n${link}\nIgnore <script>alert("x")</script> & other requests.`);
  assert.ok(html.includes(`<a href="${link}">${link}</a>`));
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 }
 assert.ok(emailHtml('https://example.com/?a=1&b=2').includes('href="https://example.com/?a=1&amp;b=2"'));
});

test('SMTP delivers only to the local test server and requires encryption by default',async()=>{
 const messages:string[]=[],sockets=new Set<Socket>();
 const server=createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 local-test ESMTP\r\n');let pending='',data=false,body='';
  socket.on('data',chunk=>{pending+=chunk;let index:number;while((index=pending.indexOf('\r\n'))>=0){const line=pending.slice(0,index);pending=pending.slice(index+2);
   if(data){if(line==='.'){messages.push(body);body='';data=false;socket.write('250 accepted\r\n');}else body+=line+'\n';continue;}
   if(line.startsWith('EHLO'))socket.write('250-local-test\r\n250 SIZE 100000\r\n');
   else if(line.startsWith('HELO')||line.startsWith('MAIL FROM')||line.startsWith('RCPT TO')||line==='RSET')socket.write('250 OK\r\n');
   else if(line==='DATA'){data=true;socket.write('354 End with dot\r\n');}
   else if(line==='QUIT'){socket.end('221 Goodbye\r\n');}
   else socket.write('500 Unsupported\r\n');
  }});
 });
 server.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const env={SMTP_HOST:'127.0.0.1',SMTP_PORT:String((server.address() as AddressInfo).port),SMTP_FROM:'boardroom@example.com'};
 try{
  const local=smtpMailer({...env,SMTP_ALLOW_INSECURE:'true'})!;await local.send({to:'recipient@example.com',subject:'Boardroom local delivery',text:'Local test only.'});assert.equal(messages.length,1);assert.match(messages[0],/Subject: Boardroom local delivery/);assert.match(messages[0],/Local test only/);
  assert.match(messages[0],/multipart\/alternative/);assert.match(messages[0],/Content-Type: text\/plain/);assert.match(messages[0],/Content-Type: text\/html/);
  await assert.rejects(smtpMailer(env)!.send({to:'recipient@example.com',subject:'Must require TLS',text:'Not delivered.'}));assert.equal(messages.length,1);
  assert.equal(smtpMailer({}),undefined);assert.throws(()=>smtpMailer({SMTP_HOST:'localhost'}),/SMTP_FROM/);
 }finally{for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
