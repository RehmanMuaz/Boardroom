import {useEffect,useState} from 'react';
import {type Workspace,type Board} from '../../model';
import {type ExportFrame,validFrame} from '../../frame-schema';
import {addFrame,saveFrame,deleteFrame,moveFrame} from '../../frames';
import {same} from '../../operations';
import {type Rect} from './pdf-layout';
import './frames.css';
export function FrameSettings({board,current,change,writable,region,hasSelection,onDirty,visible,setVisible}:{board:Board;current:()=>Workspace;change:(next:Workspace)=>void;writable:boolean;region:()=>Rect;hasSelection:boolean;onDirty:(dirty:boolean)=>void;visible:boolean;setVisible:(value:boolean)=>void}){
 const [draft,setDraft]=useState<ExportFrame|null>(null),[baseline,setBaseline]=useState<ExportFrame|null>(null),[error,setError]=useState('');
 const dirty=!!draft&&!same(draft,baseline),live=board.frames?.find(f=>f.id===draft?.id),stale=!!draft&&!same(live,baseline);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{if(!writable){setDraft(null);setBaseline(null);}},[writable]);
 function edit(frame:ExportFrame){setDraft(structuredClone(frame));setBaseline(structuredClone(frame));setError('');}
 function run(action:()=>void){try{action();setError('');}catch(e){setError((e as Error).message);}}
 return <section className="dialog-section frame-settings"><details><summary>Export frames ({board.frames?.length??0})</summary><p>Named canvas regions become PDF pages. Reorder frames to set page order. Frames do not move or change the objects inside them.</p>
 <label className="frame-toggle"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>Show frame outlines on canvas</label>
 <button disabled={!writable||!!draft||(board.frames?.length??0)>=50} onClick={()=>run(()=>change(addFrame(current(),board.id,region())))}>{hasSelection?'Add frame around selection':'Add frame in view'}</button>
 {!board.frames?.length&&<p>No frames yet. Whole-board PDF export remains available.</p>}
 <ol className="frame-list">{board.frames?.map((frame,index)=><li key={frame.id}><div><strong>{frame.name}</strong><small>{Math.round(frame.width)} × {Math.round(frame.height)} px</small></div><div className="frame-row-actions"><button disabled={!writable||!!draft} aria-label={'Edit frame '+frame.name} onClick={()=>edit(frame)}>Edit</button><button disabled={!writable||!!draft||index===0} aria-label={'Move frame '+frame.name+' earlier'} title="Earlier page" onClick={()=>change(moveFrame(current(),board.id,frame.id,-1))}>↑</button><button disabled={!writable||!!draft||index===board.frames!.length-1} aria-label={'Move frame '+frame.name+' later'} title="Later page" onClick={()=>change(moveFrame(current(),board.id,frame.id,1))}>↓</button><button disabled={!writable||!!draft} aria-label={'Delete frame '+frame.name} onClick={()=>change(deleteFrame(current(),board.id,frame.id))}>Delete</button></div></li>)}</ol>
 {draft&&<fieldset className="frame-editor" disabled={!writable}><legend>Frame settings</legend><label>Name<input aria-label="Frame name" value={draft.name} maxLength={80} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><div className="frame-dimensions">{(['x','y','width','height'] as const).map(key=><label key={key}>{key==='x'?'Left (px)':key==='y'?'Top (px)':key==='width'?'Width (px)':'Height (px)'}<input aria-label={'Frame '+key} type="number" step="any" min={key==='x'||key==='y'?0:80} max={key==='x'||key==='y'?100000:10000} value={Number.isFinite(draft[key])?draft[key]:''} onChange={e=>setDraft({...draft,[key]:e.target.valueAsNumber})}/></label>)}</div>
 {stale&&<p role="alert">This frame changed remotely. {live?'Reload its settings before saving.':'It was removed; cancel this draft.'}</p>}{stale&&live&&<button onClick={()=>edit(live)}>Reload frame settings</button>}
 <div className="frame-row-actions"><button disabled={!dirty||stale} onClick={()=>run(()=>{if(!validFrame(draft))throw Error('Enter a name, coordinates from 0 to 100,000 and dimensions from 80 to 10,000 px.');change(saveFrame(current(),board.id,{...draft,name:draft.name.trim()},baseline!));setDraft(null);setBaseline(null);})}>Save frame</button><button onClick={()=>{setDraft(null);setBaseline(null);setError('');}}>Cancel frame edit</button></div></fieldset>}
 {error&&<p role="alert">{error}</p>}<small>Use Export → PDF → Named frames to choose pages. Up to 50 frames per board. Frame outlines stay out of the PDF.</small>
 </details></section>;
}
