import {type Workspace,type Board,type Card} from './model';
import {type Annotation,type TextAnnotation} from './annotations';
import {defaultWorkspaceStyle,type StyleBinding,type StyleValues} from './style-schema';
import {resolveStyledBoard,styleValues,legacyCardStyle} from './workspaceStyles';
import {same} from './operations';
export type PaintTarget={kind:'card'|'annotation';id:string};
export type PaintMode='fixed'|'linked';
export type CapturedFormat={boardId:string;source:PaintTarget;label:string;binding?:Pick<StyleBinding,'role'|'scope'>}&(
 {family:'card';color:string;values:StyleValues;legacy:boolean}|
 {family:'text';color:string;style:TextAnnotation['style'];values:StyleValues}|
 {family:'shape';color:string;thickness:number;fill?:string}|
 {family:'stroke';color:string;thickness:number});
function lookup(board:Board,target:PaintTarget):Card|Annotation|undefined{return target.kind==='card'?board.cards.find(c=>c.id===target.id):board.annotations?.find(a=>a.id===target.id);}
export function captureFormatting(workspace:Workspace,boardId:string,target:PaintTarget):CapturedFormat|null{
 const board=workspace.boards.find(b=>b.id===boardId);if(!board)return null;const raw=lookup(board,target);if(!raw)return null;const resolved=lookup(resolveStyledBoard(workspace,board),target)!;
 const common={boardId,source:{...target},label:target.kind==='card'?raw.kind:raw.kind==='text'?'Text annotation':raw.kind==='shape'?'Shape':raw.kind==='highlighter'?'Highlighter':'Pen'};
 if(target.kind==='card'){
  const card=raw as Card;if(['image','video','file'].includes(card.kind))return null;
  const binding=workspace.workspaceStyle&&card.styleBinding?{role:card.styleBinding.role,...(card.styleBinding.scope?{scope:card.styleBinding.scope}:{})}:undefined;
  return structuredClone({...common,family:'card',color:(resolved as Card).color,values:workspace.workspaceStyle&&card.styleBinding?styleValues(workspace,board,card.styleBinding):legacyCardStyle(card),legacy:!workspace.workspaceStyle||!card.styleBinding,...(binding?{binding}:{})});
 }
 const a=raw as Annotation,r=resolved as Annotation;
 if(a.kind==='text'&&r.kind==='text'){const binding=workspace.workspaceStyle&&a.styleBinding?{role:a.styleBinding.role,...(a.styleBinding.scope?{scope:a.styleBinding.scope}:{})}:undefined;return structuredClone({...common,family:'text',color:r.color,style:r.style,values:a.styleBinding?styleValues(workspace,board,a.styleBinding):{...r.style,textColor:r.color,cardColor:defaultWorkspaceStyle.roles.body.cardColor},...(binding?{binding}:{})});}
 if(a.kind==='shape')return {...common,family:'shape',color:a.color,thickness:a.thickness,...(['rectangle','circle'].includes(a.shape)?{fill:a.fill}:{})};
 if(a.kind==='pen'||a.kind==='highlighter')return {...common,family:'stroke',color:a.color,thickness:a.thickness};return null;
}
export function paintCompatibility(workspace:Workspace,boardId:string,target:PaintTarget|undefined,source:CapturedFormat,mode:PaintMode):string|null{
 if(source.boardId!==boardId)return 'Choose a target on the source board.';
 if(!target)return 'Select a compatible target element.';
 if(target.kind===source.source.kind&&target.id===source.source.id)return 'Select another element to receive the formatting.';
 const captured=captureFormatting(workspace,boardId,target);if(!captured)return 'Media and connections do not support Format Painter.';
 if(mode==='linked'){if(!workspace.workspaceStyle||!source.binding)return 'The source has no available named style. Choose fixed formatting.';return ['card','text'].includes(captured.family)&&['card','text'].includes(source.family)?null:'Named styles apply only to text-bearing cards and text annotations.';}
 return captured.family===source.family?null:`Select a compatible ${source.family==='card'?'text-bearing card':source.family==='text'?'text annotation':source.family==='shape'?'shape':'pen or highlighter stroke'}.`;
}
export function paintFormatting(workspace:Workspace,boardId:string,target:PaintTarget,source:CapturedFormat,mode:PaintMode):Workspace{
 const reason=paintCompatibility(workspace,boardId,target,source,mode);if(reason)throw Error(reason);
 function apply(original:Card|Annotation):Card|Annotation{
  if(mode==='linked')return {...original,styleBinding:structuredClone(source.binding!)} as Card|Annotation;
  if(source.family==='card'){
   const next={...original,color:source.color} as Card;
   if(source.legacy){if(workspace.workspaceStyle&&next.styleBinding)next.styleBinding={...next.styleBinding,overrides:{...next.styleBinding.overrides,cardColor:source.color}};}else next.styleBinding={role:source.binding?.role??'body',...(source.binding?.scope?{scope:source.binding.scope}:{}),overrides:structuredClone(source.values)};
   return next;
  }
  if(source.family==='text'){
   const next={...original,color:source.color,style:structuredClone(source.style)} as TextAnnotation;
   if(workspace.workspaceStyle)next.styleBinding={role:source.binding?.role??'body',...(source.binding?.scope?{scope:source.binding.scope}:{}),overrides:structuredClone(source.values)};else delete next.styleBinding;
   return next;
  }
  if(source.family==='shape'&&original.kind==='shape')return {...original,color:source.color,thickness:source.thickness,...(source.fill!==undefined&&['rectangle','circle'].includes(original.shape)?{fill:source.fill}:{})};
  return {...original,color:source.color,thickness:source.thickness} as Annotation;
 }
 return {...workspace,boards:workspace.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>target.kind==='card'&&c.id===target.id?apply(c) as Card:c),...(b.annotations?{annotations:b.annotations.map(a=>target.kind==='annotation'&&a.id===target.id?apply(a) as Annotation:a)}:{})})};
}
/** Excludes content, position, geometry, media, labels and layer ordering. */
export function formattingSignature(workspace:Workspace,boardId:string,target:PaintTarget):unknown{
 const board=workspace.boards.find(b=>b.id===boardId),object=board&&lookup(board,target);if(!object)return null;
 const captured=captureFormatting(workspace,boardId,target);if(!captured)return null;
 return {kind:object.kind,format:captured,binding:'styleBinding' in object?object.styleBinding??null:null};
}
export function paintChanges(before:CapturedFormat|null,after:CapturedFormat|null):string[]{
 if(!before||!after)return [];const labels:string[]=[];
 if(before.family==='card'&&after.family==='card'||before.family==='text'&&after.family==='text'){
  const left=before.values,right=after.values;for(const key of Object.keys(right) as (keyof StyleValues)[])if(!same(left[key],right[key]))labels.push(key.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase());
 }else {for(const key of ['color','thickness','fill'] as const)if(key in before||key in after){if(!same((before as unknown as Record<string,unknown>)[key],(after as unknown as Record<string,unknown>)[key]))labels.push(key==='thickness'?'stroke width':key);}}
 if(!same(before.binding,after.binding))labels.push('style inheritance');return labels;
}
