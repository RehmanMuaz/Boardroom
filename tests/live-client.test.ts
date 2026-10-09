import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveRepository,type LiveView} from '../src/liveRepository';
import {seed} from '../src/model';
import {type Operation} from '../src/operations';

// Transport double exercises client ordering/retention; server tests use real sockets/PG.
class TestSocket {
 static OPEN=1;static CONNECTING=0;static sockets:TestSocket[]=[];
 readyState=0;sent:{type:string;operation?:Operation}[]=[];
 onopen?:()=>void;onclose?:()=>void;onerror?:()=>void;onmessage?:(event:{data:string})=>void;
 constructor(_url:string){TestSocket.sockets.push(this);}
 send(raw:string){this.sent.push(JSON.parse(raw));}
 open(){this.readyState=1;this.onopen?.();}
 receive(message:unknown){this.onmessage?.({data:JSON.stringify(message)});}
 close(){this.readyState=3;this.onclose?.();}
}
test('client overlays pending edits, handles late acknowledgements, and retries the same ID on reconnect',async()=>{
 const descriptors=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({WebSocket:TestSocket,location:{protocol:'http:',host:'localhost:5173'},window:{addEventListener(){},removeEventListener(){}}})){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 TestSocket.sockets=[];let view:LiveView|undefined;
 const repo=new LiveRepository('workspace',()=> 'csrf');repo.initialize(seed,0,'editor');const stop=repo.start(next=>{view=next;});
 try{
  const first=TestSocket.sockets[0];first.open();first.receive({type:'snapshot',snapshot:seed,revision:0,role:'editor'});
  const mine=structuredClone(seed);mine.boards[0].cards[0].text='My pending text';repo.change(seed,mine);
  const operation=first.sent.find(message=>message.type==='operation')!.operation!;
  const later=structuredClone(mine);later.boards[0].cards[0].text='Later committed remote text';later.boards[0].cards[1].color='#e3efe9';
  first.receive({type:'snapshot',snapshot:later,revision:2,role:'editor',operationId:'another-op'});
  assert.equal(view!.snapshot.boards[0].cards[0].text,'My pending text');assert.equal(view!.snapshot.boards[0].cards[1].color,'#e3efe9');
  first.receive({type:'ack',operationId:operation.id,snapshot:mine,revision:1});
  assert.equal(view!.snapshot.boards[0].cards[0].text,'Later committed remote text');assert.equal(view!.dirty,false);assert.equal(repo.revision,2);
  const offline=structuredClone(later);offline.boards[0].cards[1].text='Queued local edit';first.close();repo.change(later,offline);assert.match(view!.status,/Offline/);assert.equal(view!.dirty,true);
  await new Promise(resolve=>setTimeout(resolve,550));const second=TestSocket.sockets[1];second.open();second.receive({type:'snapshot',snapshot:later,revision:2,role:'editor'});
  const pending=second.sent.find(message=>message.type==='operation')!.operation!;
  // Commit occurs, but the acknowledgement is dropped before transport closes.
  second.close();await new Promise(resolve=>setTimeout(resolve,550));const third=TestSocket.sockets[2];third.open();third.receive({type:'snapshot',snapshot:offline,revision:3,role:'editor'});
  const replay=third.sent.find(message=>message.type==='operation')!.operation!;assert.deepEqual(replay,pending);
  third.receive({type:'ack',operationId:pending.id,snapshot:offline,revision:3,duplicate:true});assert.equal(view!.dirty,false);assert.equal(view!.snapshot.boards[0].cards[1].text,'Queued local edit');
  third.receive({type:'revoked',error:'Workspace access changed'});assert.equal(view!.blocked,true);assert.equal(view!.role,'viewer');
 }finally{stop();for(const [key,descriptor] of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
});
