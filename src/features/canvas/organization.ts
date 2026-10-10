import {type Workspace,type Board,type Card} from '../../model';
import {cardHeight,cardWidth,resizeCard,mediaFooterHeight} from './domain';

export const columnPadding=16,columnHeader=100,columnGap=20;
export const objectLayer=(object:{kind:string;layer?:number})=>object.layer??(object.kind==='column'?0:['note','checklist','link','board','image','video','file'].includes(object.kind)?2:6);
export function cardLayer(board:Board,card:Card){
 const column=board.cards.find(c=>c.id===card.columnId);
 return Math.max(objectLayer(card),column?objectLayer(column)+1:0);
}
export function columnMembers(board:Board,columnId:string){return board.cards.filter(c=>c.columnId===columnId).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id));}
export function columnSummary(board:Board,columnId:string){
 const items=columnMembers(board,columnId),files=items.filter(c=>c.kind==='file').length,boards=items.filter(c=>c.kind==='board').length,cards=items.length-files-boards;
 return [[cards,'card'],[files,'file'],[boards,'board']].filter(([n])=>Number(n)>0).map(([n,kind])=>`${n} ${kind}${n===1?'':'s'}`).join(', ')||'0 cards';
}
export function columnAt(board:Board,point:{x:number;y:number},excluded:string[]=[]){
 return board.cards.filter(c=>c.kind==='column'&&!excluded.includes(c.id)&&point.x>=c.x&&point.x<=c.x+cardWidth(c)&&point.y>=c.y&&point.y<=c.y+cardHeight(c)).sort((a,b)=>cardLayer(board,b)-cardLayer(board,a)||board.cards.indexOf(b)-board.cards.indexOf(a))[0];
}
function fit(card:Card,available:number,aspects?:ReadonlyMap<string,number>){
 const width=Math.min(cardWidth(card),available);
 if(card.kind==='image'||card.kind==='video'){
  // Preserve the current/source proportions while respecting existing model limits.
  const size=resizeCard(card,width,cardHeight(card),aspects?.get(card.id)??cardWidth(card)/Math.max(1,cardHeight(card)-mediaFooterHeight(card)));
  // Very wide sources use contain rendering when the minimum frame height prevents exact proportions.
  return {...card,...size,width:Math.min(size.width,available)};
 }
 return {...card,width};
}
export function layoutColumns(board:Board,columnIds:string[],aspects?:ReadonlyMap<string,number>):Board{
 let cards=board.cards;
 for(const columnId of new Set(columnIds)){
  const column=cards.find(c=>c.id===columnId&&c.kind==='column');if(!column)continue;
  const width=Math.max(192,cardWidth(column)),available=width-columnPadding*2;
  let y=column.y+columnHeader;
  const placed=new Map<string,Card>();
  for(const member of columnMembers({...board,cards},columnId)){
   const next={...fit(member,available,aspects),x:column.x+columnPadding,y};placed.set(next.id,next);y+=cardHeight(next)+columnGap;
  }
  cards=cards.map(c=>c.id===columnId?{...c,width,height:Math.min(10000,Math.max(cardHeight(column),y-column.y+columnPadding))}:placed.get(c.id)??c);
 }
 return {...board,cards};
}
export function dropIntoColumn(state:Workspace,boardId:string,ids:string[],columnId?:string,dropY=Infinity,aspects?:ReadonlyMap<string,number>):Workspace{
 return {...state,boards:state.boards.map(board=>{
  if(board.id!==boardId)return board;
  const column=board.cards.find(c=>c.id===columnId&&c.kind==='column');
  const moving=board.cards.filter(c=>ids.includes(c.id)&&c.kind!=='column'&&(!c.columnId||!ids.includes(c.columnId)));
  if(!moving.length)return board;
  const affected=moving.flatMap(c=>c.columnId?[c.columnId]:[]);if(column)affected.push(column.id);
  const members=column?columnMembers(board,column.id).filter(c=>!ids.includes(c.id)):[];
  const index=members.findIndex(c=>dropY<c.y+cardHeight(c)/2);
  members.splice(index<0?members.length:index,0,...moving);
  const order=new Map(members.map((c,i)=>[c.id,i]));
  const cards=board.cards.map(c=>{
   if(column&&order.has(c.id))return {...c,columnId:column.id,y:column.y+columnHeader+order.get(c.id)!};
   if(moving.some(m=>m.id===c.id)){const next={...c};delete next.columnId;return next;}return c;
  });
  return layoutColumns({...board,cards},affected,aspects);
 })};
}
export function resizeInColumns(state:Workspace,boardId:string,id:string,width:number,height:number,ratio?:number,aspects?:ReadonlyMap<string,number>):Workspace{
 return {...state,boards:state.boards.map(board=>{
  if(board.id!==boardId)return board;const card=board.cards.find(c=>c.id===id);if(!card)return board;
  const column=board.cards.find(c=>c.id===card.columnId),maxWidth=column?Math.max(160,cardWidth(column)-columnPadding*2):4000;
  const size=resizeCard(card,Math.min(width,maxWidth),height,ratio);
  size.width=Math.min(size.width,maxWidth);
  if(card.kind==='column')size.width=Math.max(192,size.width);
  return layoutColumns({...board,cards:board.cards.map(c=>c.id===id?{...c,...size}:c)},card.kind==='column'?[id]:card.columnId?[card.columnId]:[],aspects);
 })};
}
export type LayerAction='forward'|'backward'|'front'|'back';
export function reorderLayers(state:Workspace,boardId:string,ids:string[],action:LayerAction):Workspace{
 return {...state,boards:state.boards.map(board=>{
  if(board.id!==boardId)return board;
  const selected=new Set(ids);for(const c of board.cards)if(c.columnId&&selected.has(c.columnId))selected.add(c.id);
  const objects=[...board.cards,...board.annotations??[]].sort((a,b)=>objectLayer(a)-objectLayer(b));
  let order=objects;
  if(action==='front')order=[...objects.filter(o=>!selected.has(o.id)),...objects.filter(o=>selected.has(o.id))];
  else if(action==='back')order=[...objects.filter(o=>selected.has(o.id)),...objects.filter(o=>!selected.has(o.id))];
  else{
   order=[...objects];const step=action==='forward'?1:-1;
   for(let i=step===1?order.length-2:1;step===1?i>=0:i<order.length;i-=step){if(selected.has(order[i].id)&&!selected.has(order[i+step].id))[order[i],order[i+step]]=[order[i+step],order[i]];}
  }
  // A column remains behind its own children, even when the whole group changes layers.
  for(const c of board.cards.filter(c=>c.columnId)){
   const child=order.findIndex(o=>o.id===c.id),parent=order.findIndex(o=>o.id===c.columnId);
   if(child<parent){const [item]=order.splice(child,1);order.splice(order.findIndex(o=>o.id===c.columnId)+1,0,item);}
  }
  const layers=new Map(order.map((o,i)=>[o.id,i+1]));
  return {...board,cards:board.cards.map(c=>({...c,layer:layers.get(c.id)})),annotations:board.annotations?.map(a=>({...a,layer:layers.get(a.id)}))};
 })};
}
