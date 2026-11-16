import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createVectorPdf} from '../src/features/export/vector-pdf';
import {loadPdfImages} from '../src/features/export/render-pdf';
import {planPdf,defaultPdfOptions} from '../src/features/export/pdf-layout';
import {type Board} from '../src/model';
const cache=new Map<string,Promise<Uint8Array>>();
const fonts=(name:string)=>{let bytes=cache.get(name);if(!bytes){bytes=readFile(new URL('../public/fonts/pdf/'+name,import.meta.url));cache.set(name,bytes);}return bytes;};
test('frame PDF contains selected pages in saved order, omits outside text and visually clips crossing geometry',async()=>{
 const board:Board={id:'b',title:'Frames',pattern:'plain',background:'#ffffff',frames:[{id:'beta',name:'Second region',x:600,y:0,width:400,height:300},{id:'alpha',name:'First region',x:0,y:0,width:400,height:300}],cards:[{id:'a',kind:'note',x:20,y:20,width:240,height:100,text:'Alpha text',color:'#fff'},{id:'b',kind:'note',x:620,y:20,width:240,height:100,text:'Beta text',color:'#fff'},{id:'o',kind:'note',x:2000,y:20,text:'Outside text',color:'#fff'}],annotations:[{id:'cross',kind:'shape',shape:'rectangle',x:350,y:140,width:200,height:80,points:[[0,0],[200,80]],thickness:2,color:'#ff0000',fill:'#ff0000'}]};
 const options={...defaultPdfOptions,scope:'frames' as const,frameIds:['alpha','beta']},original=structuredClone(board),bytes=await createVectorPdf(board,options,{},fonts,()=>{}),document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:false}).promise;
 try{assert.equal(document.numPages,2);for(let i=1;i<=2;i++){const page=await document.getPage(i),text=(await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join('');assert.match(text,i===1?/Beta text/:/Alpha text/);assert.doesNotMatch(text,i===1?/Alpha text|Outside text/:/Beta text|Outside text/);}
  const page=await document.getPage(2),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');await page.render({canvas:canvas as never,canvasContext:context as never,viewport,background:'white'}).promise;const plan=planPdf(board,options),s=plan.pages[1].scale!,y=Math.round(plan.margin+180*s);assert.deepEqual([...context.getImageData(Math.round(plan.margin+380*s),y,1,1).data].slice(0,3),[255,0,0]);assert.deepEqual([...context.getImageData(Math.round(plan.margin+420*s),y,1,1).data].slice(0,3),[255,255,255]);
 }finally{await document.loadingTask.destroy();}assert.deepEqual(board,original);
});
test('frame image loading fetches only intersecting images and still rejects expired selected-image access',async()=>{
 const original=globalThis.fetch,calls:string[]=[],board:Board={id:'b',title:'Images',frames:[{id:'f',name:'Crop',x:0,y:0,width:300,height:300}],cards:[{id:'inside',kind:'image',assetId:'inside',x:10,y:10,width:200,height:200,text:'',color:'#fff'},{id:'outside',kind:'image',assetId:'outside',x:900,y:10,width:200,height:200,text:'',color:'#fff'},{id:'touching',kind:'image',assetId:'touching',x:300,y:10,width:200,height:200,text:'',color:'#fff'}]},options={...defaultPdfOptions,scope:'frames' as const};
 try{globalThis.fetch=async input=>{calls.push(String(input));return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/jpeg'}});};const images=await loadPdfImages(board,{check:async()=>{},assetBase:'/private'},options);assert.deepEqual(Object.keys(images),['inside']);assert.deepEqual(calls,['/private/inside/content']);globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(loadPdfImages(board,{check:async()=>{},assetBase:'/private'},options),/expired/);
 }finally{globalThis.fetch=original;}
});
