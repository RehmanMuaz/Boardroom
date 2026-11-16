import {type Board,type Workspace,type ElementGroup} from '../../model';
import {cardWidth,cardHeight,duplicateCards} from './domain';

export const groupOf=(board:Board,id:string)=>board.groups?.find(g=>g.members.includes(id));
export function expandGroups(board:Board,ids:string[]){const selected=new Set(ids);for(const group of board.groups??[])if(group.members.some(id=>selected.has(id)))for(const id of group.members)selected.add(id);return [...selected];}
export function completeGroups(board:Board,ids:string[]){const selected=new Set(ids);return (board.groups??[]).filter(g=>g.members.every(id=>selected.has(id)));}
export function groupReason(board:Board,ids:string[]):string|null{
 const selected=new Set(ids),objects=[...board.cards,...board.annotations??[]].filter(o=>selected.has(o.id));
 if(objects.length<2)return 'Select at least two elements.';
 if(objects.some(o=>o.kind==='column'||'columnId' in o&&o.columnId))return 'Columns and cards inside columns cannot be grouped. Move cards onto the canvas first.';
 if(objects.some(o=>groupOf(board,o.id)))return 'Ungroup existing groups before making a new group.';
 return null;
}
export function groupSelection(workspace:Workspace,boardId:string,ids:string[],id:string=crypto.randomUUID()):Workspace{
 const board=workspace.boards.find(b=>b.id===boardId);if(!board)throw Error('Board not found');const reason=groupReason(board,ids);if(reason)throw Error(reason);
 const members=[...board.cards,...board.annotations??[]].filter(o=>ids.includes(o.id)).map(o=>o.id);
 return {...workspace,boards:workspace.boards.map(b=>b.id!==boardId?b:{...b,groups:[...b.groups??[],{id,members}]})};
}
export function ungroupSelection(workspace:Workspace,boardId:string,ids:string[]):Workspace{return {...workspace,boards:workspace.boards.map(b=>{if(b.id!==boardId||!b.groups)return b;const complete=new Set(completeGroups(b,ids).map(g=>g.id));const next:Board={...b,groups:b.groups.filter(g=>!complete.has(g.id))};if(!next.groups?.length)delete next.groups;return next;})};}
/** Removal only: never repairs malformed imported or remote group definitions. */
export function pruneGroups(board:Board):Board{
 if(!board.groups)return board;const existing=new Set([...board.cards,...board.annotations??[]].map(o=>o.id));const groups=board.groups.map(g=>({...g,members:g.members.filter(id=>existing.has(id))})).filter(g=>g.members.length>=2);const next:Board={...board,groups};if(!groups.length)delete next.groups;return next;
}
export function selectionBounds(board:Board,ids:string[]){
 const objects=[...board.cards.map(c=>({...c,width:cardWidth(c),height:cardHeight(c)})),...board.annotations??[]].filter(o=>ids.includes(o.id));if(!objects.length)return null;
 const left=Math.min(...objects.map(o=>o.x)),top=Math.min(...objects.map(o=>o.y));return {left,top,width:Math.max(...objects.map(o=>o.x+o.width))-left,height:Math.max(...objects.map(o=>o.y+o.height))-top};
}
export function marqueeSelection(board:Board,rect:{left:number;right:number;top:number;bottom:number}){
 const {left,right,top,bottom}=rect;const cards=board.cards.filter(c=>c.kind==='column'?c.x>=left&&c.x+cardWidth(c)<=right&&c.y>=top&&c.y+cardHeight(c)<=bottom:c.x<right&&c.x+cardWidth(c)>left&&c.y<bottom&&c.y+cardHeight(c)>top).map(c=>c.id);
 const annotations=(board.annotations??[]).filter(a=>a.x<=right&&a.x+a.width>=left&&a.y<=bottom&&a.y+a.height>=top).map(a=>a.id);
 return expandGroups(board,[...cards,...annotations]);
}
export function duplicateObjects(board:Board,ids:string[],offset=32){
 const source=[...board.cards,...board.annotations??[]].filter(o=>ids.includes(o.id)),dx=Math.min(offset,100000-Math.max(...source.map(o=>o.x))),dy=Math.min(offset,100000-Math.max(...source.map(o=>o.y)));
 const result=duplicateCards(board,ids,0);result.cards=result.cards.map(c=>({...c,x:c.x+dx,y:c.y+dy}));const original=board.cards.filter(c=>ids.includes(c.id)&&c.kind!=='board');
 const map=new Map(original.map((c,i)=>[c.id,result.cards[i].id]));
 const annotations=(board.annotations??[]).filter(a=>ids.includes(a.id)).map(a=>{const id=crypto.randomUUID();map.set(a.id,id);const next={...structuredClone(a),id,x:a.x+dx,y:a.y+dy};return next;});
 const groups:ElementGroup[]=completeGroups(board,ids).flatMap(g=>{const members=g.members.flatMap(id=>map.has(id)?[map.get(id)!]:[]);return members.length>=2?[{id:crypto.randomUUID(),members}]:[];});
 return {...result,annotations,groups,ids:[...result.cards.map(c=>c.id),...annotations.map(a=>a.id)] as string[]};
}
