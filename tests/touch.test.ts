import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pinchTransform} from '../src/features/canvas/touch-geometry';
test('pinch keeps the canvas anchor beneath the moving finger midpoint',()=>{
 const start={distance:100,zoom:1,anchor:{x:500,y:400}};
 const next=pinchTransform(start,{x:100,y:150},{x:300,y:150});
 assert.equal(next.zoom,2);assert.equal((next.left+200)/next.zoom,500);assert.equal((next.top+150)/next.zoom,400);
 const pan=pinchTransform(start,{x:150,y:200},{x:250,y:200});assert.deepEqual(pan,{zoom:1,left:300,top:200});
});
test('pinch bounds zoom and scroll even for coincident fingers and canvas edges',()=>{
 const start={distance:100,zoom:1,anchor:{x:1,y:1}};
 assert.deepEqual(pinchTransform(start,{x:100,y:100},{x:100,y:100}),{zoom:.25,left:0,top:0});
 assert.equal(pinchTransform(start,{x:0,y:0},{x:10000,y:0}).zoom,2);
 assert.ok(Number.isFinite(pinchTransform({...start,distance:0},{x:0,y:0},{x:1,y:0}).left));
});
