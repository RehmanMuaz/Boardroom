import {test} from 'node:test';
import assert from 'node:assert/strict';
import {type Card} from '../src/model';
import {connectorEndpoints,connectorPath} from '../src/features/canvas/connectors';

const card=(x:number,y:number,width=240,height=220):Card=>({id:`${x}-${y}`,kind:'note',text:'',color:'#fff',x,y,width,height});
test('arrows follow center direction but start/end outside item edges in every direction',()=>{
 const source=card(40,40),right=card(400,40);
 assert.deepEqual(connectorEndpoints(source,right),{start:{x:282,y:150},end:{x:398,y:150}});
 assert.equal(connectorPath(source,right),'M 282 150 L 395 150');
 assert.equal(connectorPath(right,source),'M 398 150 L 285 150');
 assert.equal(connectorPath(source,card(40,400)),'M 160 262 L 160 395');
 assert.equal(connectorPath(card(40,400),source),'M 160 398 L 160 265');
 for(const target of [card(500,500,160,300),card(500,0,400,100),card(0,500,160,100),card(500,200,350,180)]){
  const endpoints=connectorEndpoints(source,target)!;assert.ok(endpoints);
  const inside=(p:{x:number;y:number},c:Card)=>p.x>c.x&&p.x<c.x+c.width!&&p.y>c.y&&p.y<c.y+c.height!;
  for(const point of [endpoints.start,endpoints.end]){assert.equal(inside(point,source),false);assert.equal(inside(point,target),false);}
  const dx=target.x+target.width!/2-(source.x+source.width!/2),dy=target.y+target.height!/2-(source.y+source.height!/2);
  assert.ok(Math.abs((endpoints.end.x-endpoints.start.x)*dy-(endpoints.end.y-endpoints.start.y)*dx)<1e-8);
 }
});
test('movement/resizing recomputes edge attachments; overlapping/touching items produce no internal arrows',()=>{
 const source=card(40,40),destination=card(400,40);
 assert.equal(connectorPath({...source,x:100},destination),'M 342 150 L 395 150');
 assert.equal(connectorPath({...source,width:300},destination),'M 342 150 L 395 150');
 for(const target of [source,card(100,100),card(280,40),card(40,260),card(50,50,160,100)])assert.equal(connectorPath(source,target),null);
 assert.equal(connectorPath(card(0,0,4000,10000),card(10000,0,4000,10000)),'M 4002 5000 L 9995 5000');
});
