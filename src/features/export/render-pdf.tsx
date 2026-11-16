import {hasExifMetadata} from '../../image-edit';
import {cardWidth,cardHeight} from '../canvas/domain';
﻿import {type Board} from '../../model';
import {planPdf,selectedPdfFrames,intersectsRect,type PdfOptions} from './pdf-layout';
import {type PdfImageSource} from './vector-pdf';
export type PdfAccess={check:()=>Promise<void>;assetBase?:string};
export async function loadPdfImages(board:Board,access:PdfAccess,options?:PdfOptions):Promise<Record<string,PdfImageSource>>{
 const images:Record<string,PdfImageSource>={};let total=0;
 const frames=options?.scope==='frames'?selectedPdfFrames(board,options):undefined;
 for(const id of new Set(board.cards.filter(c=>c.kind==='image'&&(!frames||frames.some(f=>intersectsRect({x:c.x,y:c.y,width:cardWidth(c),height:cardHeight(c)},f)))).map(c=>c.assetId!))){
  if(!access.assetBase)throw Error('This board references private images. Open its original team workspace to export them.');
  const response=await fetch(`${access.assetBase}/${encodeURIComponent(id)}/content`,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('An image is unavailable or access has expired. No PDF was downloaded.');
  let mime=(response.headers.get('Content-Type')??'').split(';')[0].trim().toLowerCase();if(!/^image\/(png|jpeg|webp|gif)$/.test(mime))throw Error('Unexpected image format in PDF export.');
  let blob=await response.blob();total+=blob.size;if(blob.size>10*1024*1024||total>100*1024*1024)throw Error('The images exceed the supported PDF export size.');
  if(mime!=='image/png'&&mime!=='image/jpeg'||mime==='image/jpeg'&&hasExifMetadata(new Uint8Array(await blob.arrayBuffer()))){
   // Normalize unsupported encodings and Exif orientation without reducing pixel dimensions.
   const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'}),canvas=document.createElement('canvas');
   try{canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');if(!context)throw Error('Image conversion is unavailable.');context.drawImage(bitmap,0,0);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('Image conversion failed.')),'image/png'));mime='image/png';}
   finally{bitmap.close();canvas.width=0;canvas.height=0;}
  }
  images[id]={mime,bytes:new Uint8Array(await blob.arrayBuffer())};
 }
 return images;
}
export async function renderPdf(board:Board,options:PdfOptions,access:PdfAccess,progress:(message:string)=>void){
 const snapshot=structuredClone(board);planPdf(snapshot,options);await access.check();progress('Loading images...');const images=await loadPdfImages(snapshot,access,options);
 const [{createVectorPdf},{browserFont}]=await Promise.all([import('./vector-pdf'),import('./pdf-fonts')]);progress('Loading embedded fonts...');
 const style=getComputedStyle(document.documentElement),theme={background:style.getPropertyValue('--canvas').trim()||'#f3f3ef',ink:style.getPropertyValue('--ink').trim()||'#393c3b',grid:style.getPropertyValue('--grid').trim()||'#d7d9d2'};
 const bytes=await createVectorPdf(snapshot,options,images,browserFont,progress,theme);
 await access.check();progress('Preparing download...');return bytes;
}
