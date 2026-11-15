import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {type Board} from '../../model';
import {ExportScene} from './ExportScene';
import {planPdf,type PdfOptions} from './pdf-layout';
export type PdfAccess={check:()=>Promise<void>;assetBase?:string};
export async function loadPdfImages(board:Board,access:PdfAccess):Promise<Record<string,string>>{
 const images:Record<string,string>={};let total=0;
 for(const id of new Set(board.cards.filter(c=>c.kind==='image').map(c=>c.assetId!))){
  if(!access.assetBase)throw Error('This board references private images. Open its original team workspace to export them.');
  const response=await fetch(`${access.assetBase}/${encodeURIComponent(id)}/content`,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('An image is unavailable or access has expired. No PDF was downloaded.');
  if(!/^image\/(png|jpeg|webp|gif)(;|$)/i.test(response.headers.get('Content-Type')??''))throw Error('Unexpected image format in PDF export.');
  const blob=await response.blob();total+=blob.size;if(blob.size>10*1024*1024||total>100*1024*1024)throw Error('The images exceed the supported PDF export size.');
  images[id]=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read an export image.'));reader.readAsDataURL(blob);});
 }
 return images;
}
export async function renderPdf(board:Board,options:PdfOptions,access:PdfAccess,progress:(message:string)=>void){
 const snapshot=structuredClone(board),plan=planPdf(snapshot,options);await access.check();progress('Loading images...');const images=await loadPdfImages(snapshot,access);
 const [{PDFDocument},{toCanvas}]=await Promise.all([import('pdf-lib'),import('html-to-image')]);const pdf=await PDFDocument.create();pdf.setTitle(snapshot.title);pdf.setCreator('Boardroom');
 const host=document.createElement('div');host.className='pdf-render-host';host.inert=true;host.setAttribute('aria-hidden','true');Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',pointerEvents:'none'});document.body.append(host);const root=createRoot(host);
 try{
  await document.fonts.ready;
  for(const [index,page] of plan.pages.entries()){
   progress(`Rendering page ${index+1} of ${plan.pages.length}...`);
   // Render in CSS pixels, at 2 raster pixels per PDF point. Each page has a bounded canvas.
   flushSync(()=>root.render(<ExportScene board={snapshot} region={page} scale={plan.scale*4/3} width={plan.contentWidth*4/3} height={plan.contentHeight*4/3} images={images}/>));
   await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode()));
   const scene=host.firstElementChild as HTMLElement;
   const canvas=await toCanvas(scene,{pixelRatio:1.5,skipFonts:true,cacheBust:false});
   const image=await pdf.embedPng(canvas.toDataURL('image/png'));pdf.addPage([plan.width,plan.height]).drawImage(image,{x:plan.margin,y:plan.margin,width:plan.contentWidth,height:plan.contentHeight});canvas.width=0;canvas.height=0;
  }
  // Recheck after rendering so revocation during an export prevents the download.
  await access.check();progress('Preparing download...');return await pdf.save();
 }finally{root.unmount();host.remove();}
}
