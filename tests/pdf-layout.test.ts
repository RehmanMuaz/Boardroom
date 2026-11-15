import test from 'node:test';
import assert from 'node:assert/strict';
import {boardBounds,planPdf,defaultPdfOptions} from '../src/features/export/pdf-layout';
import {type Board} from '../src/model';
import {defaultTextStyle} from '../src/annotations';
test('PDF layout includes far annotations, fits every edge, tiles in reading order and preserves the board',()=>{
 const board:Board={id:'b',title:'PDF',cards:[{id:'n',kind:'note',text:'Note',color:'#fff',x:200,y:100,width:240,height:220}],annotations:[{id:'a',kind:'text',x:2000,y:1500,width:400,height:100,color:'#000',text:'Far away',style:defaultTextStyle}]},before=structuredClone(board);
 const bounds=boardBounds(board);assert.equal(bounds.x,176);assert.equal(bounds.y,76);assert.equal(bounds.x+bounds.width,2424);assert.equal(bounds.y+bounds.height,1624);
 const fit=planPdf(board,defaultPdfOptions);assert.equal(fit.pages.length,1);assert.ok(fit.scale*bounds.width<=fit.contentWidth+.001);assert.ok(fit.scale*bounds.height<=fit.contentHeight+.001);
 const tiled=planPdf(board,{paper:'letter',orientation:'portrait',scale:'actual'});assert.equal(tiled.scale,.75);assert.ok(tiled.pages.length>1);assert.equal(tiled.pages[1].row,0);assert.equal(tiled.pages[1].column,1);assert.equal(tiled.pages[tiled.columns].row,1);assert.ok(tiled.pages.at(-1)!.x+tiled.pages.at(-1)!.width>=bounds.x+bounds.width);assert.deepEqual(board,before);
});
test('PDF layout bounds empty boards and excessive pages/objects and rejects unsupported settings',()=>{
 const empty:Board={id:'b',title:'Empty',cards:[]};assert.equal(planPdf(empty,defaultPdfOptions).pages.length,1);
 const enormous:Board={...empty,cards:[{id:'n',kind:'note',x:0,y:0,width:4000,height:10000,text:'Tall',color:'#fff'}]};assert.throws(()=>planPdf(enormous,{paper:'a4',orientation:'portrait',scale:'actual'}),/50 pages/);assert.equal(planPdf(enormous,defaultPdfOptions).pages.length,1);
 assert.throws(()=>planPdf({...empty,cards:Array.from({length:3001},(_,i)=>({id:String(i),kind:'note' as const,x:0,y:0,text:'',color:'#fff'}))},defaultPdfOptions),/3,000/);
 assert.throws(()=>planPdf(empty,{...defaultPdfOptions,paper:'bad' as 'a4'}),/Invalid/);
});
