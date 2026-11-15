import {PDFDocument,rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath,LineCapStyle,degrees,type PDFFont,type PDFImage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {type Board,type Card,type RichRun} from '../../model';
import {automaticTextColor,shapePath,strokePath,type Annotation} from '../../annotations';
import {cardWidth,cardHeight,mediaFooterHeight} from '../canvas/domain';
import {cardLayer,objectLayer,columnSummary} from '../canvas/organization';
import {connectorEndpoints} from '../canvas/connectors';
import {planPdf,type PdfOptions,type Rect} from './pdf-layout';
import {PdfFonts,type FontLoader,type FontStyle} from './pdf-fonts';
export type PdfImageSource={bytes:Uint8Array;mime:string};
type StyledRun=RichRun&FontStyle&{strike?:boolean};
type Piece={text:string;font:PDFFont;width:number;underline?:boolean;strike?:boolean;skew?:boolean};
export const pdfColor=(hex:string)=>{let value=hex.replace('#','');if(value.length===3)value=[...value].map(c=>c+c).join('');return rgb(parseInt(value.slice(0,2),16)/255,parseInt(value.slice(2,4),16)/255,parseInt(value.slice(4,6),16)/255);};
const intersects=(a:Rect,b:Rect)=>a.x+a.width>=b.x&&a.x<=b.x+b.width&&a.y+a.height>=b.y&&a.y<=b.y+b.height;

export async function createVectorPdf(board:Board,options:PdfOptions,images:Record<string,PdfImageSource>,loadFont:FontLoader,progress:(message:string)=>void,theme={background:'#f3f3ef',ink:'#393c3b',grid:'#d7d9d2'}){
 const plan=planPdf(board,options),pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);pdf.setTitle(board.title);pdf.setCreator('Boardroom vector export');const fonts=new PdfFonts(pdf,loadFont),embedded=new Map<string,PDFImage>();
 for(const [id,source] of Object.entries(images))embedded.set(id,source.mime==='image/jpeg'?await pdf.embedJpg(source.bytes):await pdf.embedPng(source.bytes));
 for(const [index,region] of plan.pages.entries()){
  progress(`Drawing page ${index+1} of ${plan.pages.length}...`);await new Promise<void>(resolve=>setTimeout(resolve,0));const page=pdf.addPage([plan.width,plan.height]),s=plan.scale;
  const X=(x:number)=>plan.margin+(x-region.x)*s,Y=(y:number)=>plan.height-plan.margin-(y-region.y)*s;
  const rect=(x:number,y:number,w:number,h:number,fill?:string,border?:string,borderWidth=0,dash?:number[])=>{if(!fill&&!(border&&borderWidth))return;page.drawRectangle({x:X(x),y:Y(y+h),width:w*s,height:h*s,color:fill?pdfColor(fill):undefined,borderColor:border?pdfColor(border):undefined,borderWidth:borderWidth*s,borderDashArray:dash?.map(v=>v*s)});};
  const line=(x:number,y:number,x2:number,y2:number,color:string,width=1)=>page.drawLine({start:{x:X(x),y:Y(y)},end:{x:X(x2),y:Y(y2)},color:pdfColor(color),thickness:width*s,lineCap:LineCapStyle.Round});
  function clipped(box:Rect,draw:()=>void){page.pushOperators(pushGraphicsState(),rectangle(X(box.x),Y(box.y+box.height),box.width*s,box.height*s),clip(),endPath());try{draw();}finally{page.pushOperators(popGraphicsState());}}
  async function text(runs:StyledRun[],box:Rect,size=14,color=theme.ink,align:'left'|'center'|'right'='left',lineHeight=size*1.65){
   if(box.width<=0||box.height<=0)return 0;
   const lines:Piece[][]=[[]];let used=0;
   for(const run of runs){
    // Resolve fonts per code point, then join adjacent glyphs for shaping/searchable text.
    let group='',font:PDFFont|undefined;
    const groups:{text:string;font:PDFFont}[]=[];
    for(const char of run.text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ')){
     if(char==='\n'){if(group&&font)groups.push({text:group,font});groups.push({text:'\n',font:font??await fonts.get(' ',run)});group='';continue;}
     const next=await fonts.get(char,run);if(font&&font!==next&&group){groups.push({text:group,font});group='';}font=next;group+=char;
    }if(group&&font)groups.push({text:group,font});
    for(const group of groups){if(group.text==='\n'){lines.push([]);used=0;continue;}
     for(const token of group.text.match(/\s+|[^\s]+/gu)??[]){
      const width=group.font.widthOfTextAtSize(token,size);
      if(used+width>box.width&&used>0&&!/^\s+$/.test(token)){lines.push([]);used=0;}
      if(width<=box.width){lines.at(-1)!.push({text:token,font:group.font,width,underline:run.underline,strike:run.strike,skew:run.family==='mono'&&run.italic});used+=width;}
      else for(const char of token){const w=group.font.widthOfTextAtSize(char,size);if(used+w>box.width&&used>0){lines.push([]);used=0;}lines.at(-1)!.push({text:char,font:group.font,width:w,underline:run.underline,strike:run.strike,skew:run.family==='mono'&&run.italic});used+=w;}
     }
    }
   }
   clipped(box,()=>{for(const [row,pieces] of lines.entries()){
    const lineWidth=pieces.reduce((sum,p)=>sum+p.width,0);let x=box.x+(align==='center'?(box.width-lineWidth)/2:align==='right'?box.width-lineWidth:0);const y=box.y+size*1.15+row*lineHeight;if(y<region.y||y-size>region.y+region.height||y-size>box.y+box.height)continue;
    // Coalesce runs so selectable text retains sensible word spacing and Unicode maps.
    const joined:Piece[]=[];for(const piece of pieces){const last=joined.at(-1);if(last&&last.font===piece.font&&last.underline===piece.underline&&last.strike===piece.strike&&last.skew===piece.skew){last.text+=piece.text;last.width+=piece.width;}else joined.push({...piece});}
    for(const p of joined){page.drawText(p.text,{x:X(x),y:Y(y),size:size*s,font:p.font,color:pdfColor(color),xSkew:p.skew?degrees(12):undefined});if(p.strike)line(x,y-size*.35,x+p.width,y-size*.35,color,Math.max(.7,size/18));if(p.underline)line(x,y+2,x+p.width,y+2,color,Math.max(.7,size/18));x+=p.width;}
   }});return lines.length*lineHeight;
  }
  page.pushOperators(pushGraphicsState(),rectangle(plan.margin,plan.margin,plan.contentWidth,plan.contentHeight),clip(),endPath());
  const background=board.background??theme.background;rect(region.x,region.y,region.width,region.height,background);
  if(board.pattern!=='plain'){
   const step=20;const grid=board.background?(automaticTextColor(background)==='#242b27'?'#bbbbbb':'#555555'):theme.grid;
   // Bound pattern density at very small fit scales; visible objects remain vectors.
   const spacing=Math.max(step,Math.ceil(6/s/step)*step);
   for(let x=Math.ceil(region.x/spacing)*spacing;x<region.x+region.width;x+=spacing){if(board.pattern==='grid')line(x,region.y,x,region.y+region.height,grid,.6);else for(let y=Math.ceil(region.y/spacing)*spacing;y<region.y+region.height;y+=spacing)page.drawCircle({x:X(x),y:Y(y),size:Math.max(.35,.8*s),color:pdfColor(grid)});}
   if(board.pattern==='grid')for(let y=Math.ceil(region.y/spacing)*spacing;y<region.y+region.height;y+=spacing)line(region.x,y,region.x+region.width,y,grid,.6);
  }
  for(const connector of board.connectors??[]){const from=board.cards.find(c=>c.id===connector.from),to=board.cards.find(c=>c.id===connector.to);if(!from||!to)continue;const ends=connectorEndpoints(from,to);if(!ends)continue;const {start,end}=ends;line(start.x,start.y,end.x,end.y,connector.color,3);const angle=Math.atan2(end.y-start.y,end.x-start.x),size=Math.min(12,Math.hypot(end.x-start.x,end.y-start.y)/2);page.drawSvgPath(`M0 0 L${-size*Math.cos(angle-.45)} ${-size*Math.sin(angle-.45)} L${-size*Math.cos(angle+.45)} ${-size*Math.sin(angle+.45)} Z`,{x:X(end.x),y:Y(end.y),scale:s,color:pdfColor(connector.color)});}
  const objects=[...board.cards.map((card,i)=>({card,annotation:undefined as Annotation|undefined,layer:cardLayer(board,card),order:i})),...(board.annotations??[]).map((annotation,i)=>({card:undefined as Card|undefined,annotation,layer:objectLayer(annotation),order:board.cards.length+i}))].sort((a,b)=>a.layer-b.layer||a.order-b.order);
  for(const object of objects){
   if(object.card){const c=object.card,w=cardWidth(c),h=cardHeight(c),box={x:c.x,y:c.y,width:w,height:h};if(!intersects(box,region))continue;const ink=automaticTextColor(c.color);rect(c.x,c.y,w,h,c.color,'#d9dad5',1);page.pushOperators(pushGraphicsState(),rectangle(X(c.x),Y(c.y+h),w*s,h*s),clip(),endPath());const body={x:c.x+16,y:c.y+16,width:w-32,height:h-32};
    if(c.kind==='image'){const image=embedded.get(c.assetId!);if(!image)throw Error('An image could not be embedded.');const mh=h-mediaFooterHeight(c),ratio=Math.min(w/image.width,mh/image.height),iw=image.width*ratio,ih=image.height*ratio;page.drawImage(image,{x:X(c.x+(w-iw)/2),y:Y(c.y+(mh+ih)/2),width:iw*s,height:ih*s});if(c.captionVisible!==false)await text([{text:c.text}],{x:c.x+10,y:c.y+mh+4,width:w-20,height:24},12,ink);}
    else if(c.kind==='note'){
     let y=body.y;if(c.labels?.length){let x=body.x;for(const label of c.labels){const labelText=label.text.replace(/\s+/g,' ');const width=Math.min(body.width,await fonts.measure(labelText,10,{bold:true})+14);if(x+width>body.x+body.width){x=body.x;y+=24;}rect(x,y,width,20,label.color);await text([{text:labelText,bold:true}],{x:x+7,y:y+3,width:width-14,height:17},10,automaticTextColor(label.color));x+=width+5;}y+=28;}
     if(c.richText){for(const block of c.richText.blocks){const size=block.type==='heading'?18:14,pad=block.type==='bullet'||block.type==='quote'?16:0;if(block.type==='bullet')page.drawCircle({x:X(body.x+4),y:Y(y+11),size:2*s,color:pdfColor(ink)});if(block.type==='quote')line(body.x+2,y,body.x+2,y+22,'#96aa9a',3);y+=await text(block.runs.map(run=>({...run,bold:run.bold||block.type==='heading'})),{x:body.x+pad,y,width:body.width-pad,height:Math.max(0,c.y+h-y-12)},size,ink);y+=8;}}
     else await text([{text:c.text}],{...body,y,height:Math.max(0,c.y+h-y-12)},14,ink);
    }else if(c.kind==='checklist'){let y=body.y;await text([{text:c.title||'Untitled list',bold:true}],{...body,height:30},14,ink);y+=36;for(const task of c.text.split('\n')){if(y>=c.y+h-16)break;rect(body.x,y+4,12,12,undefined,ink,1);if(task.startsWith('[x] ')){line(body.x+2,y+10,body.x+5,y+13,ink,1.5);line(body.x+5,y+13,body.x+10,y+6,ink,1.5);}y+=Math.max(28,await text([{text:task.replace(/^\[x\] /,''),strike:task.startsWith('[x] ')}],{x:body.x+22,y,width:body.width-22,height:c.y+h-y-16},13,ink));}}
    else if(c.kind==='column'){await text([{text:c.text,bold:true}],{...body,height:46},16,ink);await text([{text:columnSummary(board,c.id)}],{...body,y:body.y+50,height:30},12,ink);}
    else if(c.kind==='link')await text([{text:c.text,underline:true}],body,14,ink);
    else {await text([{text:c.kind==='board'?'Board':c.kind==='video'?'Video':'File',bold:true}],{...body,height:28},16,ink);await text([{text:c.text}],{...body,y:body.y+40,height:Math.max(0,body.height-80)},14,ink);await text([{text:c.kind==='board'?'Nested board content is not included.':`Open the workspace to ${c.kind==='video'?'play':'download'} this ${c.kind}.`}],{...body,y:c.y+h-52,height:36},11,ink);}
    page.pushOperators(popGraphicsState());
   }else if(object.annotation){const a=object.annotation;if(!intersects(a,region))continue;
    if(a.kind==='text'){const style=a.style;rect(a.x,a.y,a.width,a.height,style.background==='transparent'?undefined:style.background,style.borderWidth?style.borderColor:undefined,style.borderWidth,style.borderStyle==='dashed'?[6,4]:style.borderStyle==='dotted'?[1,3]:undefined);const color=a.color==='auto'?automaticTextColor(style.background==='transparent'?background:style.background):a.color;await text([{text:a.text,family:style.fontFamily,bold:style.fontWeight>=600,italic:style.italic,underline:style.underline}],{x:a.x+8+style.borderWidth,y:a.y+8+style.borderWidth,width:Math.max(0,a.width-16-style.borderWidth*2),height:Math.max(0,a.height-16-style.borderWidth*2)},style.fontSize,color,style.align,style.fontSize*1.3);}
    else page.drawSvgPath(a.kind==='shape'?shapePath(a):strokePath(a.points),{x:X(a.x),y:Y(a.y),scale:s,borderColor:pdfColor(a.color),borderWidth:a.thickness,borderLineCap:LineCapStyle.Round,color:a.kind==='shape'&&['rectangle','circle'].includes(a.shape)&&a.fill!=='transparent'?pdfColor(a.fill):undefined,opacity:a.kind==='highlighter'?.35:1,borderOpacity:a.kind==='highlighter'?.35:1});
   }
  }
  page.pushOperators(popGraphicsState());
 }
 return pdf.save();
}
