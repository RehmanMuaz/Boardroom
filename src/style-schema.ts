import {type TextStyle} from './annotations';
export const styleRoles=['heading','body','caption','feedback'] as const;
export type StyleRole=typeof styleRoles[number];
export type StyleValues=TextStyle&{textColor:string;cardColor:string};
export type StyleBinding={role:StyleRole;scope?:'board'|'workspace';overrides?:Partial<StyleValues>};
export type BoardStyle={roles?:Partial<Record<StyleRole,Partial<StyleValues>>>};
export type WorkspaceStyle={name:string;background:string;pattern:'plain'|'dots'|'grid';palette:string[];roles:Record<StyleRole,StyleValues>};
const base:StyleValues={fontFamily:'sans',fontSize:14,fontWeight:400,italic:false,underline:false,align:'left',background:'transparent',borderColor:'#64786c',borderWidth:0,borderStyle:'solid',textColor:'auto',cardColor:'#ffffff'};
export const defaultWorkspaceStyle:WorkspaceStyle={name:'Workspace style',background:'#f3f3ef',pattern:'dots',palette:['#ffffff','#fff4c9','#e3efe9','#e7e8f7','#f7dfdc'],roles:{body:{...base},heading:{...base,fontSize:40,fontWeight:700},caption:{...base,fontSize:14},feedback:{...base,fontSize:18,cardColor:'#fff4c9'}}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hex=(v:unknown)=>typeof v==='string'&&/^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/.test(v);
const keys=Object.keys(base);
export function validStyleValues(value:unknown,partial=false):value is StyleValues{
 if(!object(value)||Object.keys(value).some(k=>!keys.includes(k))||!partial&&keys.some(k=>!(k in value)))return false;
 return Object.entries(value).every(([key,v])=>{
  switch(key){case 'fontFamily':return typeof v==='string'&&['sans','serif','mono','rounded'].includes(v);case 'fontSize':return typeof v==='number'&&Number.isFinite(v)&&v>=12&&v<=120;case 'fontWeight':return [400,500,600,700,800].includes(v as number);case 'italic':case 'underline':return typeof v==='boolean';case 'align':return typeof v==='string'&&['left','center','right'].includes(v);case 'background':return v==='transparent'||hex(v);case 'textColor':return v==='auto'||hex(v);case 'borderColor':case 'cardColor':return hex(v);case 'borderWidth':return typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=8;case 'borderStyle':return typeof v==='string'&&['solid','dashed','dotted'].includes(v);default:return false;}
 });
}
export function validBinding(value:unknown):value is StyleBinding{return object(value)&&Object.keys(value).every(k=>['role','scope','overrides'].includes(k))&&styleRoles.includes(value.role as StyleRole)&&(value.scope===undefined||value.scope==='workspace'||value.scope==='board')&&(value.overrides===undefined||validStyleValues(value.overrides,true));}
export function validBoardStyle(value:unknown):value is BoardStyle{return object(value)&&Object.keys(value).every(k=>k==='roles')&&(value.roles===undefined||object(value.roles)&&Object.entries(value.roles).every(([key,v])=>styleRoles.includes(key as StyleRole)&&validStyleValues(v,true)));}
export function validWorkspaceStyle(value:unknown):value is WorkspaceStyle{return object(value)&&Object.keys(value).every(k=>['name','background','pattern','palette','roles'].includes(k))&&typeof value.name==='string'&&!!value.name.trim()&&value.name.length<=80&&hex(value.background)&&typeof value.pattern==='string'&&['plain','dots','grid'].includes(value.pattern)&&Array.isArray(value.palette)&&value.palette.length>=1&&value.palette.length<=16&&value.palette.every(hex)&&object(value.roles)&&Object.keys(value.roles).length===styleRoles.length&&styleRoles.every(key=>validStyleValues((value.roles as Record<string,unknown>)[key]));}
