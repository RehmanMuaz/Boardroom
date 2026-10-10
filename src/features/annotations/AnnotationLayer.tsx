import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {automaticTextColor,clampPoint,defaultTextStyle,fontFamilies,makeStroke,strokePath,type Annotation,type Point,type StrokeAnnotation,type TextAnnotation} from '../../annotations';
import {type AnnotationTool} from './AnnotationToolbar';

type Gesture={original:Annotation;mode:'move'|'resize';start:Point;dx:number;dy:number};
type Draft={id:string;kind:StrokeAnnotation['kind'];points:Point[];color:string;thickness:number};
export function AnnotationLayer({annotations,canvasBackground,tool,writable,selectedId,onSelect,add,change,point,panActive,width,height,color,thickness,focusId,focused}:{annotations:Annotation[];canvasBackground?:string;tool:AnnotationTool;writable:boolean;selectedId:string|null;onSelect:(id:string)=>void;add:(annotation:Annotation)=>void;change:(id:string,patch:Partial<Annotation>,expected?:Partial<Annotation>)=>void;point:(x:number,y:number)=>{x:number;y:number};panActive:()=>boolean;width:number;height:number;color:string;thickness:number;focusId:string|null;focused:()=>void}){
 const [draft,setDraft]=useState<Draft|null>(null),draftRef=useRef<Draft|null>(null),[gesture,setGesture]=useState<Gesture|null>(null),gestureRef=useRef<Gesture|null>(null),[editing,setEditing]=useState<string|null>(null);
 const input=useRef<HTMLTextAreaElement>(null);
 const getPoint=(e:ReactPointerEvent)=>clampPoint(point(e.clientX,e.clientY));
 function cancel(){draftRef.current=null;gestureRef.current=null;setDraft(null);setGesture(null);}
 useEffect(()=>{cancel();if(!writable)setEditing(null);},[tool,writable]);
 useEffect(()=>{if(focusId&&annotations.some(a=>a.id===focusId)){setEditing(focusId);focused();}},[focusId,annotations,focused]);
 useEffect(()=>{if(editing&&input.current){input.current.focus();input.current.setSelectionRange(input.current.value.length,input.current.value.length);}},[editing]);
 function begin(e:ReactPointerEvent<HTMLElement|SVGElement>,original:Annotation,mode:Gesture['mode']='move'){
  if(e.button===1||panActive())return;
  e.stopPropagation();onSelect(original.id);if(!writable||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  const next={original:structuredClone(original),mode,start:getPoint(e),dx:0,dy:0};gestureRef.current=next;setGesture(next);
 }
 function move(e:ReactPointerEvent){const previous=gestureRef.current;if(!previous)return;const current=getPoint(e),next={...previous,dx:current[0]-previous.start[0],dy:current[1]-previous.start[1]};gestureRef.current=next;setGesture(next);}
 function finish(){const g=gestureRef.current;if(g&&writable){const a=g.original;if(g.mode==='move')change(a.id,{x:Math.min(100000,Math.max(0,a.x+g.dx)),y:Math.min(100000,Math.max(0,a.y+g.dy))},{x:a.x,y:a.y});else if(a.kind==='text')change(a.id,{width:Math.min(4000,Math.max(80,a.width+g.dx)),height:Math.min(10000,Math.max(32,a.height+g.dy))},{width:a.width,height:a.height});}cancel();}
 const events={onPointerMove:move,onPointerUp:finish,onPointerCancel:cancel,onLostPointerCapture:cancel};
 function startDrawing(e:ReactPointerEvent<SVGSVGElement>){
  if(!writable||e.button===1||panActive())return;if(e.button!==0)return;e.preventDefault();e.stopPropagation();const position=getPoint(e);
  if(tool==='text'){add({id:crypto.randomUUID(),kind:'text',x:position[0],y:position[1],width:320,height:120,text:'',color:'auto',style:{...defaultTextStyle}});return;}
  if(tool!=='pen'&&tool!=='highlighter')return;e.currentTarget.setPointerCapture(e.pointerId);
  const next:Draft={id:crypto.randomUUID(),kind:tool,points:[position],color,thickness};draftRef.current=next;setDraft(next);
 }
 function draw(e:ReactPointerEvent<SVGSVGElement>){const current=draftRef.current;if(!current)return;const position=getPoint(e),last=current.points[current.points.length-1];if(current.points.length>=4096||Math.hypot(position[0]-last[0],position[1]-last[1])<1)return;const next={...current,points:[...current.points,position]};draftRef.current=next;setDraft(next);}
 function finishDrawing(){const current=draftRef.current;if(current&&writable)add(makeStroke(current.id,current.kind,current.points,current.color,current.thickness));cancel();}
 return <div className="annotation-layer" role="group" aria-label="Board annotations" style={{width,height}}>
  {annotations.map(annotation=>{
   let a=annotation;const g=gesture?.original.id===a.id?gesture:null;
   if(g)a={...a,...(g.mode==='move'?{x:Math.min(100000,Math.max(0,a.x+g.dx)),y:Math.min(100000,Math.max(0,a.y+g.dy))}:{width:Math.min(4000,Math.max(80,a.width+g.dx)),height:Math.min(10000,Math.max(32,a.height+g.dy))})};
   const selected=selectedId===a.id;
   if(a.kind!=='text')return <svg key={a.id} data-annotation-id={a.id} className="stroke-annotation" style={{left:a.x,top:a.y}} width={a.width} height={a.height}>
    <path d={strokePath(a.points)} fill="none" stroke={a.color} strokeWidth={a.thickness} strokeLinecap="round" strokeLinejoin="round" opacity={a.kind==='highlighter'?.35:1} pointerEvents="none"/>
    <path d={strokePath(a.points)} fill="none" stroke="transparent" strokeWidth={Math.max(14,a.thickness+8)} className="stroke-hit" role="button" tabIndex={0} aria-label={`${a.kind==='pen'?'Pen':'Highlighter'} annotation`} onPointerDown={e=>begin(e,a)} {...events} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(a.id);}}}/>
    {selected&&<rect x={-5} y={-5} width={a.width+10} height={a.height+10} fill="none" className="annotation-outline"/>}
   </svg>;
   const text=a as TextAnnotation,s=text.style;
   return <div key={a.id} data-annotation-id={a.id} className={'text-annotation'+(selected?' selected':'')} role="group" aria-label={`Text annotation: ${a.text.slice(0,60)}`} tabIndex={0} style={{left:a.x,top:a.y,width:a.width,height:a.height,fontFamily:fontFamilies[s.fontFamily],fontSize:s.fontSize,fontWeight:s.fontWeight,fontStyle:s.italic?'italic':'normal',textDecoration:s.underline?'underline':'none',textAlign:s.align,color:a.color==='auto'?automaticTextColor(s.background==='transparent'?(canvasBackground??'transparent'):s.background):a.color,background:s.background,border:`${s.borderWidth}px ${s.borderStyle} ${s.borderColor}`}} onPointerDown={e=>{if(editing===a.id){if(!panActive())e.stopPropagation();return;}begin(e,a);}} {...events} onDoubleClick={()=>{if(writable)setEditing(a.id);}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(a.id);if(writable)setEditing(a.id);}}}>
    {editing===a.id&&writable?<textarea ref={input} aria-label="Annotation text" maxLength={10000} value={a.text} placeholder="Write your text…" onChange={e=>change(a.id,{text:e.target.value})} onBlur={()=>setEditing(null)} onKeyDown={e=>{if(e.key==='Escape'||((e.ctrlKey||e.metaKey)&&e.key==='Enter')){e.preventDefault();e.stopPropagation();setEditing(null);}}}/>:<div className="annotation-text-content">{a.text||'Double-click to write text'}</div>}
    {selected&&writable&&<div className="annotation-resize" role="slider" tabIndex={0} aria-label="Resize text annotation" aria-valuemin={80} aria-valuemax={4000} aria-valuenow={a.width} title="Drag to resize; arrows change width, Shift-arrows change height" onPointerDown={e=>begin(e,a,'resize')} {...events} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const delta=e.key==='ArrowLeft'||e.key==='ArrowDown'?-10:10;change(a.id,e.shiftKey?{height:Math.min(10000,Math.max(32,a.height+delta))}:{width:Math.min(4000,Math.max(80,a.width+delta))});}}/>}
   </div>;
  })}
  {tool!=='select'&&writable&&<svg className={'annotation-interaction '+tool} width={width} height={height} aria-label={tool==='text'?'Place text annotation':'Draw annotation'} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={cancel} onLostPointerCapture={cancel}>{draft&&<path d={strokePath(draft.points)} fill="none" stroke={draft.color} strokeWidth={draft.thickness} strokeLinecap="round" strokeLinejoin="round" opacity={draft.kind==='highlighter'?.35:1} pointerEvents="none"/>}</svg>}
 </div>;
}
