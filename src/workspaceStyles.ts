import {same} from './operations';
import {type CSSProperties} from 'react';
import {fontFamilies,automaticTextColor} from './annotations';
import {validStyleValues} from './style-schema';
import {type Workspace,type Board,type Card} from './model';
import {defaultTextStyle,type Annotation,type TextAnnotation} from './annotations';
import {defaultWorkspaceStyle,type StyleBinding,type StyleRole,type StyleValues} from './style-schema';
export function styleValues(workspace:Workspace,board:Board,binding:StyleBinding):StyleValues{return {...(workspace.workspaceStyle??defaultWorkspaceStyle).roles[binding.role],...(binding.scope==='workspace'?{}:board.boardStyle?.roles?.[binding.role]),...binding.overrides};}
export function resolveStyledBoard(workspace:Workspace,board:Board):Board{
 if(!workspace.workspaceStyle)return board;
 return {...board,...(board.styleEnabled?{background:board.background??workspace.workspaceStyle.background,pattern:board.pattern??workspace.workspaceStyle.pattern}:{}),cards:board.cards.map(c=>{if(!c.styleBinding)return c;const values=styleValues(workspace,board,c.styleBinding);return {...c,color:values.cardColor,styleBinding:{...c.styleBinding,overrides:values}};}),...(board.annotations?{annotations:board.annotations.map(a=>{if(a.kind!=='text'||!a.styleBinding)return a;const {textColor,cardColor,...style}=styleValues(workspace,board,a.styleBinding);return {...a,color:textColor,style};})}:{})};
}
export function patchStyledCard(card:Card,patch:Partial<Card>):Card{return {...card,...patch,...(card.styleBinding&&patch.color!==undefined?{styleBinding:{...card.styleBinding,overrides:{...card.styleBinding.overrides,cardColor:patch.color}}}:{})};}
export function patchStyledAnnotation(annotation:Annotation,patch:Partial<Annotation>,display?:Annotation):Annotation{
 if(annotation.kind!=='text'||!annotation.styleBinding)return {...annotation,...patch} as Annotation;
 if(!('style' in patch)&&!('color' in patch))return {...annotation,...patch} as Annotation;
 const textPatch=patch as Partial<TextAnnotation>,overrides={...annotation.styleBinding.overrides,...Object.fromEntries(Object.entries(textPatch.style??{}).filter(([key,value])=>display?.kind!=='text'||value!==display.style[key as keyof typeof display.style])),...(textPatch.color!==undefined?{textColor:textPatch.color}:{})};return {...annotation,...patch,styleBinding:{...annotation.styleBinding,overrides}} as TextAnnotation;
}
export function linkStyle(workspace:Workspace,boardId:string,ids:string[],role:StyleRole,scope:'board'|'workspace'='board'):Workspace{return {...workspace,boards:workspace.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>ids.includes(c.id)&&!['image','video','file'].includes(c.kind)?{...c,styleBinding:{role,scope}}:c),...(b.annotations?{annotations:b.annotations.map(a=>ids.includes(a.id)&&a.kind==='text'?{...a,styleBinding:{role,scope}}:a)}:{})})};}
export function styleImpact(workspace:Workspace,draft?:Workspace['workspaceStyle']){let linked=0,overrides=0,affected=0;const preview=draft?{...workspace,workspaceStyle:draft}:workspace;for(const b of workspace.boards)for(const item of [...b.cards,...b.annotations??[]]){const binding='styleBinding' in item?item.styleBinding:undefined;if(binding){linked++;if(Object.keys(binding.overrides??{}).length)overrides++;if(!same(styleValues(workspace,b,binding),styleValues(preview,b,binding)))affected++;}}return {linked,affected,overrides,boards:workspace.boards.filter(b=>b.styleEnabled).length};}
export const legacyCardStyle=(card:Card):StyleValues=>({...defaultTextStyle,fontSize:14,textColor:'auto',cardColor:card.color});

export function cardStyleCss(card:Card):CSSProperties{const v=card.styleBinding?.overrides;if(!validStyleValues(v))return {};return {fontFamily:fontFamilies[v.fontFamily],fontSize:v.fontSize,fontWeight:v.fontWeight,fontStyle:v.italic?'italic':'normal',textDecoration:v.underline?'underline':'none',textAlign:v.align,color:v.textColor==='auto'?automaticTextColor(v.cardColor):v.textColor,border:`${v.borderWidth}px ${v.borderStyle} ${v.borderColor}`};}
