import {Icon} from './Icon';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useModifierPanel} from './ModifierPanel';
export function ModifierSection({title,children}:{title:string;children:ReactNode}){
 const id=useId(),panel=useModifierPanel(),content=useRef<HTMLDivElement>(null),[matches,setMatches]=useState(true),[open,setOpen]=useState(()=>{try{const saved=localStorage.getItem(`boardroom.section.${panel?.kind}.${title}`);return saved===null?!['Border','Layers','Placement'].includes(title):saved==='true';}catch{return true;}});
 useEffect(()=>{if(title==='Actions'&&panel){panel.setHasActions(true);return()=>panel.setHasActions(false);}},[title,panel?.setHasActions]);
 useEffect(()=>{const text=content.current?.textContent??'';const labels=[...content.current?.querySelectorAll('[aria-label]')??[]].map(el=>el.getAttribute('aria-label')).join(' ');setMatches((title+' '+text+' '+labels).toLowerCase().includes(panel?.query.toLowerCase()??''));},[children,panel?.query,title]);
 if(title==='Actions'&&panel)return panel.actions?createPortal(children,panel.actions):null;
 if(!panel)return <section className="modifier-section" aria-labelledby={id}><h3 id={id}>{title}</h3><div className="modifier-section-content">{children}</div></section>;
 const category=['Size','Placement','Layers'].includes(title)?'arrange':'style',visible=panel.query?matches:category===panel.tab,expanded=!!panel.query||open;
 return <section hidden={!visible} className="modifier-section" aria-labelledby={id}><button className="modifier-section-toggle" aria-expanded={expanded} aria-controls={id+'-content'} onClick={()=>{const next=!open;setOpen(next);try{localStorage.setItem(`boardroom.section.${panel.kind}.${title}`,String(next));}catch{/* Optional preference. */}}}><h3 id={id}>{title}</h3><span className="modifier-section-indicator"><Icon name={expanded?'minus':'plus'} size={16}/></span></button><div ref={content} id={id+'-content'} hidden={!panel.query&&!open} className="modifier-section-content">{children}</div></section>;
}
