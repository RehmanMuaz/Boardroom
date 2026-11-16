import {Icon} from './Icon';
import {useEffect,useId,useRef,useState} from 'react';
import {searchCommands,groupCommands,type CanvasCommand} from '../commands';
export type {CanvasCommand} from '../commands';
import './command-menu.css';
export function CommandMenu({commands}:{commands:CanvasCommand[]}){
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),id=useId(),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[activeId,setActiveId]=useState<string|null>(null);
 const groups=groupCommands(searchCommands(commands,query)),matches=groups.flatMap(g=>g.commands),active=matches.findIndex(c=>c.id===activeId);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopImmediatePropagation();input.current?.focus();setOpen(true);setActiveId(null);}};const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};window.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside);return()=>{window.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside);};},[]);
 useEffect(()=>{if(open&&active>=0)root.current?.querySelector('[role=option][aria-selected=true]')?.scrollIntoView({block:'nearest'});},[open,active,query]);
 function execute(command:CanvasCommand){if(command.disabled)return;setOpen(false);setQuery('');setActiveId(null);input.current?.blur();command.run();}
 return <div className="header-command-search" ref={root} onKeyDown={e=>e.stopPropagation()} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
 <span aria-hidden="true">&#8981;</span><input ref={input} type="search" role="combobox" aria-label="Search commands" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-describedby={id+'-count'} aria-activedescendant={open&&active>=0?id+'-'+matches[active].id:undefined} placeholder="Search tools and actions..." value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setActiveId(null);setOpen(true);}} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();setOpen(false);input.current?.blur();}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);const next=active<0?(e.key==='ArrowDown'?0:matches.length-1):(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;setActiveId(matches[next]?.id??null);}
  else if((e.key==='Home'||e.key==='End')&&open&&e.altKey){e.preventDefault();setActiveId((e.key==='Home'?matches[0]:matches.at(-1))?.id??null);}
  else if(e.key==='Enter'&&open){e.preventDefault();const command=matches[active]??matches.find(c=>!c.disabled);if(command)execute(command);}
 }}/><kbd>Ctrl K</kbd>
 <div className="command-suggestions" hidden={!open}><div className="command-list-title">Tools &amp; actions <span id={id+'-count'} role="status">{matches.length} {matches.length===1?'result':'results'}</span></div><div id={id} role="listbox" aria-label="Commands">{groups.map(g=><div key={g.name} role="group" aria-label={g.name}><div className="command-group-title" aria-hidden="true">{g.name}</div>{g.commands.map(c=><div key={c.id} id={id+'-'+c.id} role="option" aria-label={c.label} aria-describedby={id+'-help-'+c.id} aria-selected={activeId===c.id} aria-disabled={!!c.disabled} className={'command-option'+(activeId===c.id?' active':'')} onMouseDown={e=>e.preventDefault()} onMouseMove={()=>setActiveId(c.id)} onClick={()=>execute(c)}><span>{c.label}</span><small id={id+'-help-'+c.id}>{c.disabled?(c.disabledReason??'This action is currently unavailable.'):[c.description,c.shortcut].filter(Boolean).join(' | ')}</small></div>)}</div>)}{!matches.length&&<p>No matching actions. Try another name or keyword.</p>}</div></div>
 </div>;
}
