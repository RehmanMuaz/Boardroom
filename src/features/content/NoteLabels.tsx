import {ColorPicker} from './ColorPicker';
import {useState} from 'react';
import {type NoteLabel} from '../../model';

export function labelInk(color:string){const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#17221b':'#ffffff';}
export function NoteLabels({labels=[],editable,change}:{labels?:NoteLabel[];editable:boolean;change:(labels:NoteLabel[])=>void}){
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[color,setColor]=useState('#e3efe9');
 const open=(label?:NoteLabel)=>{setEditing(label?.id??'new');setName(label?.text??'');setColor(label?.color??'#e3efe9');};
 return <div className="note-labels" onClick={e=>e.stopPropagation()}>
  <div className="label-badges">{labels.map(label=>editable?<button key={label.id} className="note-label" style={{background:label.color,color:labelInk(label.color)}} title={`Edit label: ${label.text}`} onClick={()=>open(label)}>{label.text}</button>:<span key={label.id} className="note-label" style={{background:label.color,color:labelInk(label.color)}}>{label.text}</span>)}
   {editable&&labels.length<20&&<button className="add-label" aria-label="Add label" title="Add label" onClick={()=>open()}>+ Label</button>}
  </div>
  {editable&&editing&&<form className="label-editor" onSubmit={e=>{e.preventDefault();if(!name.trim())return;const label={id:editing==='new'?crypto.randomUUID():editing,text:name.trim(),color};change(editing==='new'?[...labels,label]:labels.map(l=>l.id===editing?label:l));setEditing(null);}}>
   <input autoFocus aria-label="Label name" maxLength={80} placeholder="Label name" value={name} onChange={e=>setName(e.target.value)}/>
   <ColorPicker name="Label color" value={color} change={setColor}/>
   <button type="submit" disabled={!name.trim()}>Save label</button>
   {editing!=='new'&&<button type="button" onClick={()=>{change(labels.filter(l=>l.id!==editing));setEditing(null);}}>Remove label</button>}
   <button type="button" onClick={()=>setEditing(null)}>Cancel</button>
  </form>}
 </div>;
}
