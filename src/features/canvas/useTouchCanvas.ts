import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent} from 'react';
import {pinchTransform,type TouchPoint} from './touch-geometry';
type Options={viewport:RefObject<HTMLDivElement|null>;zoom:number;setZoom:(zoom:number)=>void;resetKey:string;pass:(target:Element)=>boolean;cancel:()=>void;tap:(target:Element,x:number,y:number,double:boolean)=>void};
export function useTouchCanvas(options:Options){
 const latest=useRef(options);latest.current=options;
 const points=useRef(new Map<number,TouchPoint>()),single=useRef<{id:number;x:number;y:number;left:number;top:number;target:Element;pass:boolean;moved:boolean;multi:boolean}|null>(null),pinch=useRef<{distance:number;zoom:number;anchor:TouchPoint}|null>(null),pending=useRef<{left:number;top:number}|null>(null),lastTap=useRef<{target:Element;time:number;x:number;y:number}|null>(null),suppress=useRef(0);
 const [used,setUsed]=useState(false);
 function local(x:number,y:number){const box=latest.current.viewport.current!.getBoundingClientRect();return {x:x-box.left,y:y-box.top};}
 function clear(){points.current.clear();single.current=null;pinch.current=null;pending.current=null;}
 useEffect(()=>{clear();},[options.resetKey]);
 useEffect(()=>{const blur=()=>{if(points.current.size)latest.current.cancel();clear();};window.addEventListener('blur',blur);return()=>{window.removeEventListener('blur',blur);clear();};},[]);
 useLayoutEffect(()=>{const el=options.viewport.current;if(el&&pending.current){el.scrollLeft=pending.current.left;el.scrollTop=pending.current.top;pending.current=null;}},[options.zoom]);
 function down(e:ReactPointerEvent<HTMLDivElement>){
  if(e.pointerType!=='touch'){suppress.current=0;return false;}if(!(e.target instanceof Element))return false;
  const el=e.currentTarget,target=e.target,video=target.closest('video');
  if(!points.current.size&&video&&e.clientY>video.getBoundingClientRect().bottom-40*latest.current.zoom){suppress.current=0;return false;}
  if(!points.current.size&&target.closest('.card.editing,.text-annotation textarea,input[type=checkbox],a,.media-inspect,.embed-play')){suppress.current=0;return false;}
  setUsed(true);points.current.set(e.pointerId,local(e.clientX,e.clientY));
  if(points.current.size===1){const pass=!!target.closest('.resize-handle,.annotation-resize,.shape-resize')||latest.current.pass(target);single.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop,target:target.closest('[data-card-id],[data-annotation-id]')??target,pass,moved:false,multi:false};if(pass)return false;}
  else{
   latest.current.cancel();if(single.current){single.current.multi=true;single.current.pass=false;}
   const [a,b]=[...points.current.values()];pinch.current={distance:Math.hypot(b.x-a.x,b.y-a.y),zoom:latest.current.zoom,anchor:{x:(el.scrollLeft+(a.x+b.x)/2)/latest.current.zoom,y:(el.scrollTop+(a.y+b.y)/2)/latest.current.zoom}};
  }
  suppress.current=Date.now()+500;e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);return true;
 }
 function move(e:ReactPointerEvent<HTMLDivElement>){
  if(!points.current.has(e.pointerId))return;points.current.set(e.pointerId,local(e.clientX,e.clientY));const g=single.current;
  if(pinch.current&&points.current.size>=2){e.preventDefault();e.stopPropagation();const [a,b]=[...points.current.values()],next=pinchTransform(pinch.current,a,b);pending.current={left:next.left,top:next.top};if(next.zoom===latest.current.zoom){e.currentTarget.scrollLeft=next.left;e.currentTarget.scrollTop=next.top;pending.current=null;}else latest.current.setZoom(next.zoom);suppress.current=Date.now()+500;return;}
  if(!g||g.pass)return;
  if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moved=true;
  e.preventDefault();e.stopPropagation();if(g.moved){e.currentTarget.scrollLeft=g.left-(e.clientX-g.x);e.currentTarget.scrollTop=g.top-(e.clientY-g.y);}
 }
 function up(e:ReactPointerEvent<HTMLDivElement>,cancelled=false){
  if(!points.current.has(e.pointerId))return;const g=single.current,owned=!!pinch.current||!g?.pass;points.current.delete(e.pointerId);
  if(owned){e.preventDefault();e.stopPropagation();suppress.current=Date.now()+500;}
  if(cancelled){latest.current.cancel();clear();return;}
  if(points.current.size){pinch.current=null;const [id,p]=[...points.current][0],box=e.currentTarget.getBoundingClientRect();single.current={id,x:p.x+box.left,y:p.y+box.top,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop,target:g?.target??e.currentTarget,pass:false,moved:false,multi:true};return;}
  if(g&&!g.pass&&!g.moved&&!g.multi){const previous=lastTap.current,now=Date.now(),double=!!previous&&previous.target===g.target&&now-previous.time<350&&Math.hypot(previous.x-e.clientX,previous.y-e.clientY)<18;latest.current.tap(g.target,e.clientX,e.clientY,double);lastTap.current=double?null:{target:g.target,time:now,x:e.clientX,y:e.clientY};}
  else lastTap.current=null;clear();
 }
 return {used,down,move,up,suppressClick:()=>Date.now()<suppress.current};
}
