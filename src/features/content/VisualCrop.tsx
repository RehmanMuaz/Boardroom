import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {ImageArtwork} from './ImageArtwork';
import {originalImageEdit,type ImageEdit} from '../../image-edit';
import {dragCrop,type CropHandle,type Crop} from '../../crop';
import './visual-crop.css';
const handles:CropHandle[]=['nw','n','ne','e','se','s','sw','w'];
const names:Record<CropHandle,string>={move:'Move crop',nw:'Crop top left',n:'Crop top edge',ne:'Crop top right',e:'Crop right edge',se:'Crop bottom right',s:'Crop bottom edge',sw:'Crop bottom left',w:'Crop left edge'};
export function VisualCrop({source,edit,change,onError}:{source:string;edit:ImageEdit;change:(crop:Crop)=>void;onError:()=>void}){
 const stage=useRef<HTMLDivElement>(null),image=useRef<HTMLDivElement>(null),[aspect,setAspect]=useState(1),[size,setSize]=useState({width:1,height:1}),gesture=useRef<{id:number;handle:CropHandle;crop:Crop;x:number;y:number;width:number;height:number}|null>(null);
 useEffect(()=>{const el=stage.current;if(!el)return;const update=()=>{const width=Math.max(1,Math.min(el.clientWidth-48,(el.clientHeight-48)*aspect));setSize({width,height:width/aspect});};update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();},[aspect]);
 function start(e:ReactPointerEvent<HTMLButtonElement>,handle:CropHandle){if(e.button!==0)return;const box=image.current?.getBoundingClientRect();if(!box?.width||!box.height)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);gesture.current={id:e.pointerId,handle,crop:{...edit.crop},x:e.clientX,y:e.clientY,width:box.width,height:box.height};}
 function move(e:ReactPointerEvent<HTMLButtonElement>){const g=gesture.current;if(!g||g.id!==e.pointerId)return;change(dragCrop(g.crop,g.handle,(e.clientX-g.x)/g.width,(e.clientY-g.y)/g.height));}
 function cancel(){const g=gesture.current;if(g)change(g.crop);gesture.current=null;}
 const c=edit.crop;
 return <div ref={stage} className="visual-crop-stage" aria-label="Visual crop tool" onKeyDown={e=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopPropagation();cancel();}}}>
  <div ref={image} className="visual-crop-image" style={size}>
   <ImageArtwork source={source} alt="Full image for cropping" edit={{...edit,crop:originalImageEdit.crop}} onAspect={setAspect} onError={onError}/>
   <div className="visual-crop-rectangle" style={{left:c.x*100+'%',top:c.y*100+'%',width:c.width*100+'%',height:c.height*100+'%'}}>
    <button className="crop-move" aria-label="Move crop" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={()=>{gesture.current=null;}} onPointerCancel={cancel} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();change(dragCrop(c,'move',e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0,e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0));}}><span className="crop-thirds" aria-hidden="true"/></button>
    {handles.map(handle=><button key={handle} className={'crop-handle crop-'+handle} aria-label={names[handle]} title={names[handle]+' (drag or use arrow keys)'} onPointerDown={e=>start(e,handle)} onPointerMove={move} onPointerUp={()=>{gesture.current=null;}} onPointerCancel={cancel} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?.05:.01;change(dragCrop(c,handle,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));}}/>)}
   </div>
  </div>
  <p className="crop-hint">Drag edges or corners to crop. Drag inside to move. Arrow keys adjust a focused handle.</p>
 </div>;
}
