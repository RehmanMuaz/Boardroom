import {validBoardBackground,validBoardPattern,type BoardPattern} from './boardAppearance';
import {validAnnotation,type Annotation} from './annotations';
export type Kind = 'note' | 'checklist' | 'link' | 'board' | 'image' | 'video' | 'file' | 'column';
export type RichRun={text:string;bold?:boolean;italic?:boolean;underline?:boolean;href?:string};
export type RichDocument={blocks:{type:'paragraph'|'heading'|'bullet'|'quote';runs:RichRun[]}[]};
export type NoteLabel={id:string;text:string;color:string};
export type Card = {id:string; kind:Kind; x:number; y:number; text:string; color:string; title?:string; labels?:NoteLabel[]; layer?:number; target?:string; width?:number; height?:number; assetId?:string; columnId?:string; captionVisible?:boolean; richText?:RichDocument};
export type Connector={id:string;from:string;to:string;color:string};
export type Board = {id:string; title:string; parent?:string; cards:Card[];connectors?:Connector[];annotations?:Annotation[];background?:string;pattern?:BoardPattern};
export type Workspace = {version:1; boards:Board[]};
export const seed:Workspace = {version:1,boards:[{id:'home',title:'Creative studio',cards:[
{id:'welcome',kind:'note',x:70,y:70,text:'A space for your next big idea\n\nCollect references, map out the story, and bring your team into the process.',color:'#fff'},
{id:'brief',kind:'note',x:355,y:70,text:'THE BRIEF\n\nCreate a cinematic brand film that feels human. Natural light. Quiet moments. A story worth telling.',color:'#fff4c9'},
{id:'todo',kind:'checklist',x:640,y:70,text:'Define the creative direction\nCollect visual references\nBuild the shot list\nConfirm locations',color:'#fff'},
{id:'project',kind:'board',x:355,y:350,text:'Brand film',target:'film',color:'#fff'},
{id:'reference',kind:'link',x:70,y:350,text:'https://milanote.com',color:'#fff'}]}, {id:'film',parent:'home',title:'Brand film',cards:[{id:'idea',kind:'note',x:70,y:70,text:'Start with a feeling.\n\nWhat should the audience remember?',color:'#e3efe9'}]}]};
export function moveCard(state:Workspace,boardId:string,id:string,x:number,y:number):Workspace {return {...state,boards:state.boards.map(b=>b.id!==boardId?b:{...b,cards:b.cards.map(c=>c.id!==id?c:{...c,x:Math.max(0,x),y:Math.max(0,y)})})};}
export function validWorkspace(value:unknown): value is Workspace {
 if(!value || typeof value!=='object')return false;
 const w=value as Workspace;
 if(w.version!==1||!Array.isArray(w.boards)||!w.boards.length||w.boards.length>1000)return false;
 const boards=new Set<string>(),cards=new Set<string>(),annotations=new Set<string>();let points=0;
 const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=128;
 for(const b of w.boards){
  if(!b||!id(b.id)||boards.has(b.id)||typeof b.title!=='string'||b.title.length>500||!Array.isArray(b.cards)||b.cards.length>10000)return false;
  if(b.background!==undefined&&!validBoardBackground(b.background)||b.pattern!==undefined&&!validBoardPattern(b.pattern))return false;
  boards.add(b.id);
  if(b.annotations!==undefined){if(!Array.isArray(b.annotations)||b.annotations.length>2000)return false;for(const a of b.annotations){if(!validAnnotation(a)||annotations.has(a.id))return false;annotations.add(a.id);if(a.kind!=='text'&&(points+=a.points.length)>100000)return false;}}
  for(const c of b.cards){
   if(!c||!id(c.id)||cards.has(c.id)||!['note','checklist','link','board','image','video','file','column'].includes(c.kind)||!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.y<0||c.x>100000||c.y>100000||typeof c.text!=='string'||c.text.length>100000||typeof c.color!=='string'||!/^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/.test(c.color))return false;
   if(c.width!==undefined&&(!Number.isFinite(c.width)||c.width<160||c.width>4000)||c.height!==undefined&&(!Number.isFinite(c.height)||c.height<100||c.height>10000))return false;
   if(['image','video','file'].includes(c.kind)&&(!c.assetId||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.assetId)))return false;
   if(c.assetId!==undefined&&!['image','video','file'].includes(c.kind))return false;
   if(c.captionVisible!==undefined&&(typeof c.captionVisible!=='boolean'||!['image','video'].includes(c.kind)))return false;
   if(c.richText!==undefined&&(c.kind!=='note'||!validRichDocument(c.richText)||richPlainText(c.richText)!==c.text))return false;
   if(c.columnId!==undefined&&(!id(c.columnId)||c.kind==='column'))return false;
   if(c.title!==undefined&&(c.kind!=='checklist'||typeof c.title!=='string'||c.title.length>500))return false;
   if(c.layer!==undefined&&(!Number.isInteger(c.layer)||c.layer<0||c.layer>20000))return false;
   if(c.labels!==undefined&&(c.kind!=='note'||!Array.isArray(c.labels)||c.labels.length>20||new Set(c.labels.map(l=>l?.id)).size!==c.labels.length||c.labels.some(l=>!l||!id(l.id)||typeof l.text!=='string'||!l.text.trim()||l.text.length>80||typeof l.color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(l.color))))return false;
   cards.add(c.id);
  }
  for(const c of b.cards)if(c.columnId&&!b.cards.some(column=>column.id===c.columnId&&column.kind==='column'))return false;
  if(b.connectors!==undefined){if(!Array.isArray(b.connectors)||b.connectors.length>10000)return false;const ids=new Set<string>();for(const line of b.connectors){if(!line||!id(line.id)||ids.has(line.id)||line.from===line.to||!b.cards.some(c=>c.id===line.from)||!b.cards.some(c=>c.id===line.to)||typeof line.color!=='string'||!/^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/.test(line.color))return false;ids.add(line.id);}}
 }
 for(const annotation of annotations)if(cards.has(annotation))return false;
 for(const b of w.boards){
  if(b.parent!==undefined&&(!id(b.parent)||!boards.has(b.parent)))return false;
  for(const c of b.cards)if(c.kind==='board'&&(!c.target||!boards.has(c.target)||w.boards.find(v=>v.id===c.target)?.parent!==b.id))return false;
  const seen=new Set<string>([b.id]);let parent=b.parent;
  while(parent){if(seen.has(parent))return false;seen.add(parent);parent=w.boards.find(v=>v.id===parent)?.parent;}
 }
 return true;
}
export function safeLink(value:string){try{const url=new URL(value);return ['http:','https:','mailto:'].includes(url.protocol);}catch{return false;}}
export const richPlainText=(doc:RichDocument)=>doc.blocks.map(b=>b.runs.map(r=>r.text).join('')).join('\n');
export function validRichDocument(value:unknown):value is RichDocument{
 if(!value||typeof value!=='object')return false;const doc=value as RichDocument;
 if(!Array.isArray(doc.blocks)||doc.blocks.length>2000)return false;let size=0;
 for(const block of doc.blocks){if(!block||!['paragraph','heading','bullet','quote'].includes(block.type)||!Array.isArray(block.runs)||block.runs.length>2000)return false;
  for(const run of block.runs){if(!run||typeof run.text!=='string'||(size+=run.text.length)>100000)return false;for(const mark of ['bold','italic','underline'] as const)if(run[mark]!==undefined&&typeof run[mark]!=='boolean')return false;if(run.href!==undefined&&(typeof run.href!=='string'||run.href.length>2000||!safeLink(run.href)))return false;}
 }return true;
}
