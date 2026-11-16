import {validFrames} from '../../frame-schema';
import {type Board} from '../../model';
import {cardWidth,cardHeight} from '../canvas/domain';
export type PdfOptions={paper:'a4'|'letter';orientation:'landscape'|'portrait';scale:'fit'|'actual';scope?:'board'|'frames';frameIds?:string[]};
export type Rect={x:number;y:number;width:number;height:number};
export type PdfPage=Rect&{column:number;row:number;scale?:number;frameId?:string;label?:string};
export const defaultPdfOptions:PdfOptions={paper:'a4',orientation:'landscape',scale:'fit'};
export function boardBounds(board:Board):Rect{
 const objects=[...board.cards.map(c=>({x:c.x,y:c.y,width:cardWidth(c),height:cardHeight(c)})),...(board.annotations??[]).map(a=>{const pad=a.kind==='text'?a.style.borderWidth/2:a.thickness/2;return {x:Math.max(0,a.x-pad),y:Math.max(0,a.y-pad),width:a.width+pad*2,height:a.height+pad*2};})];
 if(!objects.length)return {x:0,y:0,width:640,height:480};
 const x=Math.max(0,Math.min(...objects.map(c=>c.x))-24),y=Math.max(0,Math.min(...objects.map(c=>c.y))-24);
 return {x,y,width:Math.max(...objects.map(c=>c.x+c.width))+24-x,height:Math.max(...objects.map(c=>c.y+c.height))+24-y};
}
export function planPdf(board:Board,options:PdfOptions){
 if(options.scope!==undefined&&!['board','frames'].includes(options.scope))throw Error('Invalid PDF scope');
 if(!['a4','letter'].includes(options.paper)||!['portrait','landscape'].includes(options.orientation)||!['fit','actual'].includes(options.scale))throw Error('Invalid PDF settings');
 if(board.cards.reduce((sum,c)=>sum+c.text.length+(c.labels??[]).reduce((n,l)=>n+l.text.length,0),0)+(board.annotations??[]).reduce((sum,a)=>sum+(a.kind==='text'?a.text.length:0),0)>2000000)throw Error('This board exceeds the PDF text limit. Split it into smaller boards.');
 if(board.cards.length+(board.annotations?.length??0)+(board.connectors?.length??0)>3000)throw Error('This board exceeds the 3,000-object PDF limit. Split it into smaller boards.');
 const bounds=boardBounds(board),paper=options.paper==='a4'?[595.28,841.89]:[612,792];
 const [width,height]=options.orientation==='landscape'?[paper[1],paper[0]]:paper,margin=24,contentWidth=width-margin*2,contentHeight=height-margin*2;
 if(options.scope==='frames'){
  const frames=selectedPdfFrames(board,options);if(options.scale!=='fit')throw Error('Named frames fit one region to each page.');
  const pages:PdfPage[]=frames.map((f,index)=>({x:f.x,y:f.y,width:f.width,height:f.height,column:0,row:index,scale:Math.min(contentWidth/f.width,contentHeight/f.height),frameId:f.id,label:f.name}));
  const x=Math.min(...frames.map(f=>f.x)),y=Math.min(...frames.map(f=>f.y)),bounds={x,y,width:Math.max(...frames.map(f=>f.x+f.width))-x,height:Math.max(...frames.map(f=>f.y+f.height))-y};
  return {bounds,width,height,margin,contentWidth,contentHeight,scale:pages[0].scale!,columns:1,rows:pages.length,pages};
 }
 const scale=options.scale==='fit'?Math.min(.75,contentWidth/bounds.width,contentHeight/bounds.height):.75;
 const worldWidth=contentWidth/scale,worldHeight=contentHeight/scale,columns=Math.max(1,Math.ceil(bounds.width/worldWidth-1e-8)),rows=Math.max(1,Math.ceil(bounds.height/worldHeight-1e-8));
 if(columns*rows>50)throw Error('This export needs more than 50 pages. Choose Fit to page or split the board.');
 const pages:PdfPage[]=[];for(let row=0;row<rows;row++)for(let column=0;column<columns;column++)pages.push({x:bounds.x+column*worldWidth,y:bounds.y+row*worldHeight,width:worldWidth,height:worldHeight,column,row});
 return {bounds,width,height,margin,contentWidth,contentHeight,scale,columns,rows,pages};
}

export function selectedPdfFrames(board:Board,options:PdfOptions){
 const frames=board.frames??[];if(!validFrames(frames))throw Error('Invalid export frames');const ids=options.frameIds??frames.map(f=>f.id);
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!frames.some(f=>f.id===id)))throw Error('A selected frame is unavailable. Choose frames again.');
 if(!ids.length)throw Error('Select at least one export frame.');return frames.filter(f=>ids.includes(f.id));
}
export const intersectsRect=(a:Rect,b:Rect)=>a.x+a.width>b.x&&a.x<b.x+b.width&&a.y+a.height>b.y&&a.y<b.y+b.height;
