import {type Workspace,type Card} from './model';
import {defaultWorkspaceStyle,validStyleValues,type StyleValues} from './style-schema';
import {styleValues,patchStyledCard} from './workspaceStyles';
import {same} from './operations';

export type SelectionProperty=Exclude<keyof StyleValues,'background'>;
export type SelectionValues={[K in keyof StyleValues]:StyleValues[K]|undefined};
const textCard=(c:Card)=>!['image','video','file'].includes(c.kind);
const backgroundCard=(c:Card)=>!['image','video'].includes(c.kind);
const canonical=(value:unknown)=>typeof value==='string'&&/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value)?'#'+(value.length===4?value.slice(1).split('').map(c=>c+c).join(''):value.slice(1)).toLowerCase():value;
export function sharedValue<T>(values:T[]):T|undefined{return values.length&&values.every(v=>same(canonical(v),canonical(values[0])))?canonical(values[0]) as T:undefined;}
export function selectionStyles(workspace:Workspace,boardId:string,ids:string[]){
 const board=workspace.boards.find(b=>b.id===boardId),selected=new Set(ids),cards=board?.cards.filter(c=>selected.has(c.id))??[];
 const backgrounds=cards.filter(backgroundCard),styled=workspace.workspaceStyle?cards.filter(c=>textCard(c)&&c.styleBinding):[];
 const effective=styled.map(c=>styleValues(workspace,board!,c.styleBinding!));
 const values=Object.fromEntries(Object.keys(defaultWorkspaceStyle.roles.body).map(key=>[key,key==='cardColor'?sharedValue(backgrounds.map(c=>workspace.workspaceStyle&&c.styleBinding?styleValues(workspace,board!,c.styleBinding).cardColor:c.color)):sharedValue(effective.map(v=>v[key as keyof StyleValues]))])) as SelectionValues;
 function status(key:SelectionProperty){const compatible=key==='cardColor'?backgrounds:styled;if(!compatible.length)return 'Unavailable';const custom=compatible.filter(c=>!workspace.workspaceStyle||!c.styleBinding||Object.hasOwn(c.styleBinding.overrides??{},key)).length;return custom===0?'Inherited':custom===compatible.length?'Custom':'Mixed inheritance';}
 function canReset(key:SelectionProperty){return styled.some(c=>Object.hasOwn(c.styleBinding!.overrides??{},key));}
 return {count:cards.length,backgroundCount:backgrounds.length,styledCount:styled.length,values,status,canReset};
}
/** Only supported keys are changed; untouched legacy cards never acquire a binding. */
export function patchSelectionStyles(workspace:Workspace,boardId:string,ids:string[],patch:Partial<StyleValues>):Workspace{
 if(!validStyleValues(patch,true)||Object.keys(patch).includes('background'))throw Error('Unsupported selection formatting');
 const selected=new Set(ids),{cardColor,...text}=patch,hasText=Object.keys(text).length>0;
 return {...workspace,boards:workspace.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>{
  if(!selected.has(c.id))return c;let next=c;
  if(cardColor!==undefined&&backgroundCard(c))next=patchStyledCard(next,{color:cardColor});
  if(hasText&&workspace.workspaceStyle&&textCard(c)&&next.styleBinding)next={...next,styleBinding:{...next.styleBinding,overrides:{...next.styleBinding.overrides,...text}}};
  return next;
 })})};
}
export function resetSelectionStyle(workspace:Workspace,boardId:string,ids:string[],key:SelectionProperty):Workspace{
 if(!workspace.workspaceStyle)return workspace;
 const selected=new Set(ids);return {...workspace,boards:workspace.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>{
  if(!selected.has(c.id)||!textCard(c)||!c.styleBinding||!Object.hasOwn(c.styleBinding.overrides??{},key))return c;
  const overrides={...c.styleBinding.overrides};delete overrides[key];return {...c,styleBinding:{...c.styleBinding,overrides}};
 })})};
}
