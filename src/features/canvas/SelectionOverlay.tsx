import {useLayoutEffect,useState,type RefObject} from 'react';
import {type Board} from '../../model';
import {selectionBounds,completeGroups,groupReason} from './groups';
import './selection-overlay.css';

export function SelectionOverlay({board,ids,zoom,viewport,writable,group,ungroup}:{board:Board;ids:string[];zoom:number;viewport:RefObject<HTMLDivElement|null>;writable:boolean;group:()=>void;ungroup:()=>void}){
 const [view,setView]=useState({left:0,top:0,width:0,height:0,offset:160,obscured:0,bottom:0});
 useLayoutEffect(()=>{const el=viewport.current;if(!el)return;const update=()=>setView({left:el.scrollLeft,top:el.scrollTop,width:el.clientWidth,height:el.clientHeight,offset:el.offsetTop,bottom:(()=>{const sidebar=document.querySelector('.app.contextual-sidebar>aside')?.getBoundingClientRect(),box=el.getBoundingClientRect();return sidebar&&sidebar.top>box.top&&sidebar.left<=box.left&&sidebar.right>=box.right?Math.max(0,box.bottom-sidebar.top):0;})(),obscured:(()=>{const sidebar=document.querySelector('.app.contextual-sidebar>aside')?.getBoundingClientRect(),box=el.getBoundingClientRect();return sidebar&&sidebar.top<=box.top&&sidebar.bottom>box.top?Math.max(0,sidebar.right-box.left):0;})()});update();el.addEventListener('scroll',update);const observer=new ResizeObserver(update);observer.observe(el);const sidebar=document.querySelector('.app>aside');if(sidebar)observer.observe(sidebar);return()=>{el.removeEventListener('scroll',update);observer.disconnect();};},[viewport,ids.length]);
 const bounds=selectionBounds(board,ids);if(ids.length<2||!bounds)return null;
 const groups=completeGroups(board,ids),covered=new Set(groups.flatMap(g=>g.members)),canUngroup=groups.length>0&&ids.every(id=>covered.has(id));
 const reason=groupReason(board,ids),label=canUngroup?'Ungroup selection':'Group selection';
 const left=bounds.left*zoom-view.left,top=bounds.top*zoom-view.top,width=bounds.width*zoom,height=bounds.height*zoom;
 const visible=left+width>=0&&top+height>=0&&left<=view.width&&top<=view.height;
 return <div className="selection-overlay" style={{top:view.offset,height:view.height,width:view.width}} aria-label={canUngroup?'Selected group':'Selected elements'}>
  <div className={'selection-boundary'+(canUngroup?' is-group':'')} style={{left:left-6,top:top-6,width:width+12,height:height+12}}/>
  {writable&&visible&&<div className="selection-group-action" style={{left:Math.max(view.obscured+8,Math.min(view.width-44,left+width-28)),top:Math.max(8,Math.min(view.height-view.bottom-44,top-44))}} title={canUngroup?label:reason??label}>
   <button type="button" aria-label={label} title={canUngroup?label:reason??label} disabled={!canUngroup&&!!reason} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();(canUngroup?ungroup:group)();}} onKeyDown={e=>{if(e.key===' ')e.stopPropagation();}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{canUngroup?<><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><rect x="6" y="6" width="5" height="5"/><rect x="13" y="13" width="5" height="5"/></>:<><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2"/><rect x="6" y="6" width="6" height="6"/><rect x="12" y="12" width="6" height="6"/></>}</svg></button>
  </div>}
 </div>;
}
