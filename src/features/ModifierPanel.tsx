import {createContext,useContext,useRef,useState,type ReactNode} from 'react';
import './modifier-panel.css';
type PanelState={tab:'style'|'arrange';query:string;kind:string;actions:HTMLDivElement|null;setHasActions:(value:boolean)=>void};
const Context=createContext<PanelState|null>(null);
export const useModifierPanel=()=>useContext(Context);
export function ModifierPanel({kind,children}:{kind:string;children:ReactNode}){
 const [tab,setTab]=useState<'style'|'arrange'>(()=>{try{return localStorage.getItem('boardroom.panel.'+kind)==='arrange'?'arrange':'style';}catch{return 'style';}}),[query,setQuery]=useState(''),[actions,setActions]=useState<HTMLDivElement|null>(null),[hasActions,setHasActions]=useState(false);const menu=useRef<HTMLDetailsElement>(null);
 function changeTab(value:'style'|'arrange'){setTab(value);setQuery('');try{localStorage.setItem('boardroom.panel.'+kind,value);}catch{/* Session preference still works. */}}
 return <Context.Provider value={{tab,query,kind,actions,setHasActions}}><div className="modifier-panel" onKeyDown={e=>{if(e.key==='Escape'&&menu.current?.open){e.preventDefault();e.stopPropagation();menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
  <div className="modifier-navigation"><input aria-label="Find a property" placeholder="Find a property…" type="search" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'&&query){e.preventDefault();e.stopPropagation();setQuery('');}}}/><div className="modifier-tabs" role="tablist" aria-label="Modifier category" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'style':e.key==='End'?'arrange':tab==='style'?'arrange':'style';changeTab(next);e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next==='style'?0:1]?.focus();}}><button role="tab" tabIndex={tab==='style'?0:-1} aria-selected={tab==='style'} onClick={()=>changeTab('style')}>Style</button><button role="tab" tabIndex={tab==='arrange'?0:-1} aria-selected={tab==='arrange'} onClick={()=>changeTab('arrange')}>Arrange</button></div></div>
  <details ref={menu} className="modifier-actions" hidden={!hasActions}><summary aria-label="Object actions" title="Object actions">•••</summary><div ref={setActions} className="modifier-action-menu"/></details>
  {children}
 </div></Context.Provider>;
}
