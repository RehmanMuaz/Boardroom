import {type Workspace,type Card,type Board} from '../../model';
export const cardWidth=(card:Card)=>card.width??(card.kind==='column'?320:240);
export const cardHeight=(card:Card)=>card.height??(card.kind==='column'?520:card.kind==='image'||card.kind==='video'?260:220);
export const mediaFooterHeight=(card:Card)=>card.captionVisible===false?0:28;
export function resizeCard(card:Card,width:number,height:number,ratio?:number){
 if(card.kind==='image'||card.kind==='video'){
  const footer=mediaFooterHeight(card);
  const minMediaHeight=100-footer;
  const sourceAspect=ratio&&Number.isFinite(ratio)&&ratio>0?ratio:cardWidth(card)/Math.max(1,cardHeight(card)-footer);
  // Extreme source proportions cannot fit both model limits; retain contain rendering.
  const aspect=Math.min(4000/minMediaHeight,Math.max(160/(10000-footer),sourceAspect));
  const nextWidth=Math.min(4000,(10000-footer)*aspect,Math.max(160,minMediaHeight*aspect,width));
  return {width:nextWidth,height:nextWidth/aspect+footer};
 }
 return {width:Math.min(4000,Math.max(160,width)),height:Math.min(10000,Math.max(100,height))};
}
export function moveSelection(state:Workspace,boardId:string,ids:string[],dx:number,dy:number):Workspace{
 const board=state.boards.find(b=>b.id===boardId);if(!board)return state;
 const selected=new Set(ids);for(const c of board.cards)if(c.columnId&&selected.has(c.columnId))selected.add(c.id);
 const moving=board.cards.filter(c=>selected.has(c.id));if(!moving.length)return state;
 const x=Math.min(Math.max(dx,-Math.min(...moving.map(c=>c.x))),100000-Math.max(...moving.map(c=>c.x))),y=Math.min(Math.max(dy,-Math.min(...moving.map(c=>c.y))),100000-Math.max(...moving.map(c=>c.y)));
 return {...state,boards:state.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>selected.has(c.id)?{...c,x:Math.min(100000,c.x+x),y:Math.min(100000,c.y+y)}:c)})};
}
export function deleteSelection(state:Workspace,boardId:string,ids:string[]):Workspace{
 const selected=new Set(ids);
 return {...state,boards:state.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.filter(c=>!selected.has(c.id)).map(c=>{if(!c.columnId||!selected.has(c.columnId))return c;const next={...c};delete next.columnId;return next;}),connectors:(b.connectors??[]).filter(line=>!selected.has(line.from)&&!selected.has(line.to))})};
}
export function putInColumn(state:Workspace,boardId:string,ids:string[],columnId:string):Workspace{
 const board=state.boards.find(b=>b.id===boardId),column=board?.cards.find(c=>c.id===columnId&&c.kind==='column');if(!board||!column)return state;
 const moving=board.cards.filter(c=>ids.includes(c.id)&&c.kind!=='column');
 let y=column.y+70;for(const c of board.cards)if(c.columnId===columnId&&!ids.includes(c.id))y=Math.max(y,c.y+cardHeight(c)+20);
 const positions=new Map<string,Card>();for(const c of moving){positions.set(c.id,{...c,columnId,x:column.x+16,y,width:Math.max(160,Math.min(cardWidth(c),cardWidth(column)-32))});y+=cardHeight(c)+20;}
 return {...state,boards:state.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>c.id===columnId?{...c,height:Math.min(10000,Math.max(cardHeight(column),y-column.y+20))}:positions.get(c.id)??c)})};
}
export function duplicateCards(board:Board,ids:string[],offset=32){
 const selected=board.cards.filter(c=>ids.includes(c.id));const map=new Map(selected.map(c=>[c.id,crypto.randomUUID()]));
 // Board tiles cannot be cloned without cloning their entire nested board graph.
 const cards=selected.filter(c=>c.kind!=='board').map(c=>{const next={...structuredClone(c),id:map.get(c.id)!,x:Math.min(100000,c.x+offset),y:Math.min(100000,c.y+offset)};if(next.columnId){next.columnId=map.get(next.columnId);if(!next.columnId)delete next.columnId;}return next;});
 const idsIncluded=new Set(cards.map(c=>c.id));
 const connectors=(board.connectors??[]).filter(line=>map.has(line.from)&&map.has(line.to)&&idsIncluded.has(map.get(line.from)!)&&idsIncluded.has(map.get(line.to)!)).map(line=>({...line,id:crypto.randomUUID(),from:map.get(line.from)!,to:map.get(line.to)!}));
 return {cards,connectors};
}
export function canvasExtent(board:Board){return {width:Math.max(2400,...board.cards.map(c=>c.x+cardWidth(c)+300)),height:Math.max(1800,...board.cards.map(c=>c.y+cardHeight(c)+300))};}
export const screenDelta=(dx:number,dy:number,zoom:number)=>({x:dx/zoom,y:dy/zoom});
