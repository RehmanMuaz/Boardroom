import {cjkBlocks} from './cjk-fonts';
import {type PDFDocument,type PDFFont} from 'pdf-lib';
export type FontStyle={family?:'sans'|'serif'|'mono'|'rounded';bold?:boolean;italic?:boolean};
export type FontLoader=(name:string)=>Promise<Uint8Array>;
export class PdfFonts{
 private fonts=new Map<string,Promise<PDFFont>>();private sets=new Map<PDFFont,Set<number>>();
 constructor(private pdf:PDFDocument,private load:FontLoader){}
 private font(name:string){let font=this.fonts.get(name);if(!font){font=this.load(name).then(bytes=>this.pdf.embedFont(bytes,{subset:!name.startsWith('NotoSansJP-')}));this.fonts.set(name,font);}return font;}
 async get(text:string,style:FontStyle={}){
  const family=style.family==='serif'?'NotoSerif':style.family==='mono'?'NotoSansMono':'NotoSans',variant=(style.bold?'Bold':'')+(style.italic&&family!=='NotoSansMono'?'Italic':'')||'Regular';
  let font=await this.font(`${family}-${variant}.ttf`);
  const supports=(f:PDFFont)=>{let set=this.sets.get(f);if(!set){set=new Set(f.getCharacterSet());this.sets.set(f,set);}return [...text].every(c=>set!.has(c.codePointAt(0)!));};
  if(!supports(font)){
   const block=(Math.floor(text.codePointAt(0)!/1024)*1024).toString(16).padStart(5,'0');
   if(!cjkBlocks.has(block))throw Error('Some text uses characters unsupported by the embedded PDF fonts. No PDF was downloaded.');
   font=await this.font(`NotoSansJP-${block}.ttf`);
   if(!supports(font))throw Error('Some text uses characters unsupported by the embedded PDF fonts. No PDF was downloaded.');
  }
  return font;
 }
 async measure(text:string,size:number,style:FontStyle={}){let width=0;for(const char of text)width+=(await this.get(char,style)).widthOfTextAtSize(char,size);return width;}
}
const cached=new Map<string,Promise<Uint8Array>>();
export function browserFont(name:string){let result=cached.get(name);if(!result){result=fetch('/fonts/pdf/'+name,{credentials:'same-origin',signal:AbortSignal.timeout(30000)}).then(async response=>{if(!response.ok)throw Error('A PDF font could not be loaded. Please retry.');return new Uint8Array(await response.arrayBuffer());}).catch(error=>{cached.delete(name);throw error;});cached.set(name,result);}return result;}
