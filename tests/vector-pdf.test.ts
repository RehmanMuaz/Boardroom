import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFDict,PDFRawStream,PDFNumber} from 'pdf-lib';
import sharp from 'sharp';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createVectorPdf} from '../src/features/export/vector-pdf';
import {defaultPdfOptions} from '../src/features/export/pdf-layout';
import {defaultTextStyle} from '../src/annotations';
import {type Board} from '../src/model';
const cache=new Map<string,Promise<Uint8Array>>();
const fonts=(name:string)=>{let bytes=cache.get(name);if(!bytes){bytes=readFile(new URL('../public/fonts/pdf/'+name,import.meta.url));cache.set(name,bytes);}return bytes;};
test('vector PDF contains extractable Unicode/rich text, embedded fonts and paths rather than page screenshots',async()=>{
 const board:Board={id:'board',title:'Vector',pattern:'plain',cards:[{id:'note',kind:'note',x:30,y:40,width:280,height:240,text:'Résumé 日本語\nBold and italic',color:'#fff',richText:{blocks:[{type:'heading',runs:[{text:'Résumé 日本語'}]},{type:'paragraph',runs:[{text:'Bold',bold:true,underline:true},{text:' and '},{text:'italic',italic:true}]}]}}],annotations:[{id:'text',kind:'text',x:400,y:60,width:300,height:160,text:'Standalone text',color:'#123456',style:{...defaultTextStyle,fontFamily:'serif',italic:true,borderWidth:2}},{id:'shape',kind:'shape',shape:'rectangle',x:400,y:300,width:200,height:80,color:'#ff0000',fill:'#aaffaa',thickness:3,points:[[0,0],[200,80]]}]};
 const original=structuredClone(board),bytes=await createVectorPdf(board,defaultPdfOptions,{},fonts,()=>{}),pdf=await PDFDocument.load(bytes),resources=pdf.getPages()[0].node.Resources()!;
 assert.equal(resources.lookup(PDFName.of('XObject'),PDFDict).keys().length,0);assert.ok(resources.lookup(PDFName.of('Font'),PDFDict).keys().length>=3);assert.ok(bytes.length<500000);
 const parsed=await getDocument({data:new Uint8Array(bytes),useSystemFonts:false}).promise;try{const page=await parsed.getPage(1),content=await page.getTextContent(),text=content.items.map(item=>'str' in item?item.str:'').join('');assert.match(text,/Résumé/);assert.match(text,/日本語/);assert.match(text,/Bold/);assert.match(text,/italic/);assert.match(text,/Standalone text/);const ops=await page.getOperatorList();assert.ok(ops.fnArray.length>20);}finally{await parsed.loadingTask.destroy();}assert.deepEqual(board,original);
});
test('vector export fails clearly for unsupported glyphs instead of replacing or losing text',async()=>{
 const board:Board={id:'b',title:'Missing glyph',pattern:'plain',cards:[{id:'n',kind:'note',x:0,y:0,color:'#fff',text:'\u{10ffff}'}]};await assert.rejects(createVectorPdf(board,defaultPdfOptions,{},fonts,()=>{}),/unsupported/);
});

test('vector PDF keeps original JPEG bytes and dimensions instead of resampling a page',async()=>{
 const jpeg=await sharp({create:{width:1800,height:1200,channels:3,background:'#339955'}}).jpeg({quality:95}).toBuffer();
 const board:Board={id:'b',title:'Original image',pattern:'plain',cards:[{id:'image',kind:'image',assetId:'test',text:'',captionVisible:false,color:'#fff',x:10,y:10,width:240,height:160}]};
 const bytes=await createVectorPdf(board,defaultPdfOptions,{test:{bytes:jpeg,mime:'image/jpeg'}},fonts,()=>{}),pdf=await PDFDocument.load(bytes),objects=pdf.getPages()[0].node.Resources()!.lookup(PDFName.of('XObject'),PDFDict),image=pdf.context.lookup(objects.values()[0]);assert.ok(image instanceof PDFRawStream);assert.equal(image.dict.lookup(PDFName.of('Width'),PDFNumber).asNumber(),1800);assert.equal(image.dict.lookup(PDFName.of('Height'),PDFNumber).asNumber(),1200);assert.equal(image.dict.lookup(PDFName.of('Filter'),PDFName).asString(),'/DCTDecode');assert.deepEqual(image.contents,new Uint8Array(jpeg));
});

test('CJK glyphs are visibly painted, not merely present in the PDF Unicode map',async()=>{
 const board:Board={id:'b',title:'CJK visibility',background:'#ffffff',pattern:'plain',cards:[],annotations:[{id:'jp',kind:'text',x:20,y:20,width:240,height:120,color:'#000000',text:'日本語',style:{...defaultTextStyle,fontSize:48}}]};const bytes=await createVectorPdf(board,defaultPdfOptions,{},fonts,()=>{}),task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false});
 try{const pdf=await task.promise,page=await pdf.getPage(1),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');await page.render({canvas:canvas as never,canvasContext:context as never,viewport}).promise;const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100)ink++;assert.ok(ink>200,'CJK text must render visible ink');}finally{await task.destroy();}
});
