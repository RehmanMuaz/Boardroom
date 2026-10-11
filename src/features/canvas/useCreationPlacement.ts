import {useEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent} from 'react';
import {type Kind} from '../../model';
export type CreationTool=Kind;
export function useCreationPlacement({viewport,point,enabled,place,onArm}:{viewport:RefObject<HTMLDivElement|null>;point:(x:number,y:number)=>{x:number;y:number};enabled:boolean;place:(tool:CreationTool,point:{x:number;y:number})=>void;onArm:()=>void}){
 const [tool,setTool]=useState<CreationTool|null>(null),[preview,setPreview]=useState<{tool:CreationTool;x:number;y:number}|null>(null);
 const gesture=useRef<{tool:CreationTool;id:number;x:number;y:number;moved:boolean;cancelled?:boolean}|null>(null),suppressClick=useRef(false);
 const latest=useRef({point,enabled,place,onArm});latest.current={point,enabled,place,onArm};
 function inside(x:number,y:number){const rect=viewport.current?.getBoundingClientRect();return !!rect&&x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom;}
 function position(x:number,y:number){const p=latest.current.point(x,y);return {x:Math.max(0,Math.min(100000,p.x)),y:Math.max(0,Math.min(100000,p.y))};}
 function show(kind:CreationTool,x:number,y:number){setPreview(inside(x,y)?{tool:kind,...position(x,y)}:null);}
 function cancel(){if(gesture.current)gesture.current.cancelled=true;setTool(null);setPreview(null);}
 function arm(kind:CreationTool){if(suppressClick.current){suppressClick.current=false;return;}if(!latest.current.enabled)return;latest.current.onArm();setTool(kind);setPreview(null);viewport.current?.focus();}
 function start(e:ReactPointerEvent<HTMLButtonElement>,kind:CreationTool){if(!latest.current.enabled||e.button!==0)return;gesture.current={tool:kind,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
 function move(x:number,y:number){if(tool)show(tool,x,y);}
 function commit(x:number,y:number){if(!tool||!latest.current.enabled||!inside(x,y))return;const kind=tool;cancel();latest.current.place(kind,position(x,y));}
 useEffect(()=>{
  const move=(e:PointerEvent)=>{const g=gesture.current;if(!g||g.cancelled||g.id!==e.pointerId)return;if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<6)return;if(!g.moved){g.moved=true;latest.current.onArm();setTool(null);}e.preventDefault();show(g.tool,e.clientX,e.clientY);};
  const up=(e:PointerEvent)=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;if(!g.moved&&!g.cancelled)return;suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);setPreview(null);if(!g.cancelled&&latest.current.enabled&&inside(e.clientX,e.clientY))latest.current.place(g.tool,position(e.clientX,e.clientY));};
  const cancelPointer=()=>cancel();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelPointer);window.addEventListener('keydown',key);window.addEventListener('blur',cancelPointer);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelPointer);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancelPointer);};
 },[viewport]);
 useEffect(()=>{if(!enabled)cancel();},[enabled]);
 return {tool,preview,arm,start,move,commit,cancel};
}
