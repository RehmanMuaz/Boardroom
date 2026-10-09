import {useEffect,useRef} from 'react';
import {type RichDocument,type RichRun,richPlainText,safeLink} from '../../model';
const plainDocument=(text:string):RichDocument=>({blocks:text.split('\n').map(text=>({type:'paragraph',runs:[{text}]}))});
function readRuns(node:Node,marks:Omit<RichRun,'text'>={}):RichRun[]{
 if(node.nodeType===Node.TEXT_NODE)return [{text:node.textContent??'',...marks}];
 if(!(node instanceof HTMLElement))return [];
 if(node.tagName==='BR')return [{text:'\n',...marks}];
 const next={...marks};if(['B','STRONG'].includes(node.tagName))next.bold=true;if(['I','EM'].includes(node.tagName))next.italic=true;if(node.tagName==='U')next.underline=true;
 if(node.tagName==='A'&&safeLink(node.getAttribute('href')??''))next.href=node.getAttribute('href')!;
 return [...node.childNodes].flatMap(child=>readRuns(child,next));
}
function readDocument(element:HTMLElement):RichDocument{
 const blocks:RichDocument['blocks']=[];let inline:RichRun[]=[];
 const flush=()=>{if(inline.length){blocks.push({type:'paragraph',runs:inline});inline=[];}};
 for(const node of element.childNodes){
  if(node instanceof HTMLElement&&['UL','OL'].includes(node.tagName)){flush();for(const child of node.children)blocks.push({type:'bullet',runs:readRuns(child)});}
  else if(node instanceof HTMLElement&&['P','DIV','H1','H2','H3','BLOCKQUOTE'].includes(node.tagName)){flush();blocks.push({type:node.tagName.startsWith('H')?'heading':node.tagName==='BLOCKQUOTE'?'quote':'paragraph',runs:readRuns(node)});}
  else inline.push(...readRuns(node));
 }flush();return {blocks:blocks.length?blocks:[{type:'paragraph',runs:[]}]};
}
function renderDocument(element:HTMLElement,doc:RichDocument){
 const fragment=document.createDocumentFragment();
 for(const block of doc.blocks){const line=document.createElement(block.type==='heading'?'h3':block.type==='quote'?'blockquote':block.type==='bullet'?'div':'p');if(block.type==='bullet')line.className='rich-bullet';
  for(const run of block.runs){let node:Node=document.createTextNode(run.text);for(const [enabled,tag] of [[run.bold,'strong'],[run.italic,'em'],[run.underline,'u']] as const)if(enabled){const wrap=document.createElement(tag);wrap.append(node);node=wrap;}if(run.href){const a=document.createElement('a');a.href=run.href;a.rel='noreferrer';a.target='_blank';a.append(node);node=a;}line.append(node);}
  if(!line.childNodes.length)line.append(document.createElement('br'));fragment.append(line);
 }element.replaceChildren(fragment);
}
export function RichNote({text,document:rich,editable,change}:{text:string;document?:RichDocument;editable:boolean;change:(text:string,doc?:RichDocument)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(ref.current&&rich&&JSON.stringify(readDocument(ref.current))!==JSON.stringify(rich))renderDocument(ref.current,rich);},[rich]);
 if(!rich)return <><textarea aria-label="Note content" readOnly={!editable} value={text} onChange={e=>change(e.target.value)}/>{editable&&<button className="format-note" onClick={()=>change(text,plainDocument(text))}>Format note</button>}</>;
 const command=(name:string,value?:string)=>{document.execCommand('styleWithCSS',false,'false');document.execCommand(name,false,value);if(ref.current){const doc=readDocument(ref.current);change(richPlainText(doc),doc);}};
 return <>{editable&&<div className="rich-tools" role="toolbar" aria-label="Note formatting">{[['bold','B'],['italic','I'],['underline','U'],['insertUnorderedList','List']] .map(([name,label])=><button key={name} aria-label={name==='insertUnorderedList'?'Bullet list':name} onMouseDown={e=>e.preventDefault()} onClick={()=>command(name)}>{label}</button>)}<button onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','h3')}>Heading</button></div>}<div ref={ref} className="rich-note" contentEditable={editable} suppressContentEditableWarning role="textbox" aria-label="Rich note content" aria-multiline="true" aria-readonly={!editable} onInput={()=>{if(ref.current){const doc=readDocument(ref.current);change(richPlainText(doc),doc);}}} onPaste={e=>{if(e.clipboardData.files.length)return;e.preventDefault();command('insertText',e.clipboardData.getData('text/plain'));}}/></>;
}
