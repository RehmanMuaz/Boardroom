import {type Workspace,type Board,type Card,validWorkspace} from './model';
import {type Annotation} from './annotations';

export type Field='$board'|'$card'|'$annotation'|'$boardOrder'|'$cardOrder'|'$annotationOrder'|'title'|'parent'|'kind'|'x'|'y'|'text'|'color'|'target'|'width'|'height'|'assetId'|'columnId'|'captionVisible'|'richText'|'connectors'|'points'|'thickness'|'style'|'background'|'pattern';
export type Change={boardId:string;cardId?:string;annotationId?:string;field:Field;before:unknown;after:unknown};
const annotationFields=['kind','x','y','width','height','color','text','points','thickness','style'] as const;
export type Operation={id:string;baseRevision:number;changes:Change[]};
export class OperationConflict extends Error {
 constructor(public change:Change){super(`Conflict on ${change.annotationId??change.cardId??change.boardId}.${change.field}. Export your edits before reloading.`);}
}
function canonical(value:unknown):string {
 if(value===undefined)return 'null';
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function diffWorkspace(before:Workspace,after:Workspace):Change[]{
 const changes:Change[]=[];
 for(const board of before.boards)if(!after.boards.some(b=>b.id===board.id))changes.push({boardId:board.id,field:'$board',before:board,after:null});
 for(const board of after.boards){
  const old=before.boards.find(b=>b.id===board.id);
  if(!old){changes.push({boardId:board.id,field:'$board',before:null,after:board});continue;}
  for(const field of ['title','parent','connectors','background','pattern'] as const)if(!same(old[field],board[field]))changes.push({boardId:board.id,field,before:old[field]??null,after:board[field]??null});
  for(const card of old.cards)if(!board.cards.some(c=>c.id===card.id))changes.push({boardId:board.id,cardId:card.id,field:'$card',before:card,after:null});
  for(const card of board.cards){
   const previous=old.cards.find(c=>c.id===card.id);
   if(!previous){changes.push({boardId:board.id,cardId:card.id,field:'$card',before:null,after:card});continue;}
   for(const field of ['kind','x','y','text','color','target','width','height','assetId','columnId','captionVisible','richText'] as const)if(!same(previous[field],card[field]))changes.push({boardId:board.id,cardId:card.id,field,before:previous[field]??null,after:card[field]??null});
  }
  const natural=old.cards.filter(c=>board.cards.some(next=>next.id===c.id)).map(c=>c.id).concat(board.cards.filter(c=>!old.cards.some(previous=>previous.id===c.id)).map(c=>c.id));
  const order=board.cards.map(c=>c.id);if(!same(natural,order))changes.push({boardId:board.id,field:'$cardOrder',before:natural,after:order});
  const previous=old.annotations??[],annotations=board.annotations??[];
  for(const a of previous)if(!annotations.some(next=>next.id===a.id))changes.push({boardId:board.id,annotationId:a.id,field:'$annotation',before:a,after:null});
  for(const a of annotations){const prior=previous.find(p=>p.id===a.id);if(!prior){changes.push({boardId:board.id,annotationId:a.id,field:'$annotation',before:null,after:a});continue;}for(const field of annotationFields){const left=(prior as unknown as Record<string,unknown>)[field],right=(a as unknown as Record<string,unknown>)[field];if(!same(left,right))changes.push({boardId:board.id,annotationId:a.id,field,before:left??null,after:right??null});}}
  const naturalAnnotations=previous.filter(a=>annotations.some(next=>next.id===a.id)).map(a=>a.id).concat(annotations.filter(a=>!previous.some(p=>p.id===a.id)).map(a=>a.id));
  const annotationOrder=annotations.map(a=>a.id);if(!same(naturalAnnotations,annotationOrder))changes.push({boardId:board.id,field:'$annotationOrder',before:naturalAnnotations,after:annotationOrder});
 }
 const natural=before.boards.filter(b=>after.boards.some(next=>next.id===b.id)).map(b=>b.id).concat(after.boards.filter(b=>!before.boards.some(previous=>previous.id===b.id)).map(b=>b.id));
 const order=after.boards.map(b=>b.id);if(!same(natural,order))changes.push({boardId:'*',field:'$boardOrder',before:natural,after:order});
 return structuredClone(changes);
}
export function applyChanges(original:Workspace,changes:Change[],check=true):Workspace {
 const snapshot=structuredClone(original);
 for(const change of changes){
  const board=snapshot.boards.find(b=>b.id===change.boardId);
  if(change.annotationId!==undefined||change.field==='$annotation'){
   if(!board)throw new OperationConflict(change);if(!change.annotationId||change.cardId!==undefined)throw Error('Annotation ID required without a card ID');
   const annotations=board.annotations??[],current=annotations.find(a=>a.id===change.annotationId);
   if(change.field==='$annotation'){
    if(check&&!same(current??null,change.before)&&!same(current??null,change.after))throw new OperationConflict(change);
    if(change.after===null){board.annotations=annotations.filter(a=>a.id!==change.annotationId);if(!board.annotations.length)delete board.annotations;}
    else{const next=change.after as Annotation;if(next?.id!==change.annotationId)throw Error('Annotation ID mismatch');if(current)annotations[annotations.indexOf(current)]=structuredClone(next);else annotations.push(structuredClone(next));board.annotations=annotations;}
   }else{
    if(!annotationFields.includes(change.field as typeof annotationFields[number]))throw Error('Invalid annotation field');if(!current)throw new OperationConflict(change);
    const values=current as unknown as Record<string,unknown>;if(check&&!same(values[change.field]??null,change.before)&&!same(values[change.field]??null,change.after))throw new OperationConflict(change);
    if(change.after===null)delete values[change.field];else values[change.field]=structuredClone(change.after);
   }
   continue;
  }
  if(change.field==='$boardOrder'||change.field==='$cardOrder'||change.field==='$annotationOrder'){
   if(change.cardId!==undefined||change.field==='$boardOrder'&&change.boardId!=='*')throw Error('Invalid order change');
   if(change.field!=='$boardOrder'&&!board)throw new OperationConflict(change);
   const entities=change.field==='$boardOrder'?snapshot.boards:change.field==='$annotationOrder'?board!.annotations??[]:board!.cards;
   const current=entities.map(entity=>entity.id);
   if(check&&!same(current,change.before)&&!same(current,change.after))throw new OperationConflict(change);
   const ids=change.after;if(!Array.isArray(ids)||ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!current.includes(id)))throw Error('Invalid order IDs');
   if(change.field==='$boardOrder')snapshot.boards=ids.map(id=>snapshot.boards.find(b=>b.id===id)!);else if(change.field==='$annotationOrder')board!.annotations=ids.map(id=>board!.annotations!.find(a=>a.id===id)!);else board!.cards=ids.map(id=>board!.cards.find(c=>c.id===id)!);
   continue;
  }
  if(change.field==='$board'){
   if(change.cardId!==undefined)throw Error('Board change cannot specify a card');
   if(check&&!same(board??null,change.before)&&!same(board??null,change.after))throw new OperationConflict(change);
   if(change.after===null)snapshot.boards=snapshot.boards.filter(b=>b.id!==change.boardId);
   else {const next=change.after as Board;if(next?.id!==change.boardId)throw Error('Board ID mismatch');if(board)snapshot.boards[snapshot.boards.indexOf(board)]=structuredClone(next);else snapshot.boards.push(structuredClone(next));}
  }else{
   if(!board)throw new OperationConflict(change);
   if(change.field==='$card'){
    if(!change.cardId)throw Error('Card ID required');const card=board.cards.find(c=>c.id===change.cardId);
    if(check&&!same(card??null,change.before)&&!same(card??null,change.after))throw new OperationConflict(change);
    if(change.after===null)board.cards=board.cards.filter(c=>c.id!==change.cardId);
    else {const next=change.after as Card;if(next?.id!==change.cardId)throw Error('Card ID mismatch');if(card)board.cards[board.cards.indexOf(card)]=structuredClone(next);else board.cards.push(structuredClone(next));}
   }else{
    if(['points','thickness','style'].includes(change.field))throw Error('Annotation ID required');
    const boardField=change.field==='title'||change.field==='parent'||change.field==='connectors'||change.field==='background'||change.field==='pattern';
    if(boardField===Boolean(change.cardId))throw Error('Invalid field for entity');
    const entity=boardField?board:board.cards.find(c=>c.id===change.cardId);
    if(!entity)throw new OperationConflict(change);
    const values=entity as unknown as Record<string,unknown>;
    if(check&&!same(values[change.field]??null,change.before)&&!same(values[change.field]??null,change.after))throw new OperationConflict(change);
    if(change.after===null)delete values[change.field];else values[change.field]=structuredClone(change.after);
   }
  }
 }
 if(!validWorkspace(snapshot))throw Error('Operation produces an invalid workspace');
 return snapshot;
}
