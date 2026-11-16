import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument,PDFName,PDFDict,PDFNumber,PDFRawStream} from 'pdf-lib';
import {createVectorPdf} from '../src/features/export/vector-pdf';
import {defaultPdfOptions,planPdf} from '../src/features/export/pdf-layout';
import {originalImageEdit,type ImageEdit} from '../src/image-edit';
import {type Board} from '../src/model';
const fonts=(name:string)=>readFile(new URL('../public/fonts/pdf/'+name,import.meta.url));
test('vector PDF rotates/crops original JPEG resources correctly and retains attached vector annotations',async()=>{
 const raw=Buffer.alloc(200*100*3);for(let y=0;y<100;y++)for(let x=0;x<200;x++){const i=(y*200+x)*3;raw[i]=x<100?255:0;raw[i+2]=x<100?0:255;}const jpeg=await sharp(raw,{raw:{width:200,height:100,channels:3}}).jpeg({quality:100,chromaSubsampling:'4:4:4'}).toBuffer();
 for(const crop of [false,true]){
  const edit:ImageEdit={...structuredClone(originalImageEdit),rotation:90,crop:{x:0,y:0,width:1,height:crop ? .5 : 1},marks:crop?[]:[{id:'line',kind:'pen',points:[[.25,.2],[.25,.8]],color:'#00ff00',size:20},{id:'label',kind:'text',point:[.7,.5],color:'#ffffff',size:100,text:'Review'}]},board:Board={id:'b',title:'Image',pattern:'plain',cards:[{id:'photo',kind:'image',assetId:'asset',x:10,y:10,width:200,height:200,captionVisible:false,text:'',color:'#fff',imageEdit:edit}]};
  const bytes=await createVectorPdf(board,defaultPdfOptions,{asset:{mime:'image/jpeg',bytes:jpeg}},fonts,()=>{}),pdf=await PDFDocument.load(bytes),objects=pdf.getPages()[0].node.Resources()!.lookup(PDFName.of('XObject'),PDFDict),image=pdf.context.lookup(objects.values()[0]);assert.ok(image instanceof PDFRawStream);assert.equal(image.dict.lookup(PDFName.of('Width'),PDFNumber).asNumber(),200);assert.deepEqual(image.contents,new Uint8Array(jpeg));
  const document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:false}).promise;try{const page=await document.getPage(1),viewport=page.getViewport({scale:2}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');await page.render({canvas:canvas as never,canvasContext:ctx as never,viewport,background:'white'}).promise;const plan=planPdf(board,defaultPdfOptions),pixel=(x:number,y:number)=>[...ctx.getImageData(Math.round((plan.margin+(x-plan.pages[0].x)*plan.scale)*2),Math.round((plan.margin+(y-plan.pages[0].y)*plan.scale)*2),1,1).data];const top=pixel(100,40),bottom=pixel(100,170);assert.ok(top[0]>220&&top[2]<30);assert.ok(crop?bottom[0]>220&&bottom[2]<30:bottom[2]>220&&bottom[0]<30);if(!crop){const text=(await page.getTextContent()).items.map(i=>'str' in i?i.str:'').join('');assert.match(text,/Review/);const green=pixel(110,60);assert.ok(green[1]>180&&green[0]<80);}}
  finally{await document.loadingTask.destroy();}
 }
});
