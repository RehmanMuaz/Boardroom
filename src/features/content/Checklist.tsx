import {useEffect,useRef,useState} from 'react';
import {type Card} from '../../model';

export function Checklist({card,editable,change}:{card:Card;editable:boolean;change:(patch:Partial<Card>)=>void}){
 const rows=card.text.split('\n'),inputs=useRef<(HTMLInputElement|null)[]>([]),[focus,setFocus]=useState<number|null>(null);
 useEffect(()=>{if(focus!==null){inputs.current[focus]?.focus();setFocus(null);}},[focus,card.text]);
 const write=(next:string[])=>{const text=next.join('\n');if(text.length<=100000)change({text});};
 function insert(index:number){const next=[...rows];next.splice(index+1,0,'');write(next);setFocus(index+1);}
 function remove(index:number){const next=rows.filter((_,i)=>i!==index);write(next.length?next:['']);setFocus(Math.max(0,index-1));}
 return <div className="checklist">
  <input className="checklist-title" aria-label="List title" placeholder="Untitled list" maxLength={500} readOnly={!editable} value={card.title??''} onChange={e=>change({title:e.target.value})}/>
  <div className="checklist-items">{rows.map((line,index)=>{
   const done=line.startsWith('[x] '),text=done?line.slice(4):line;
   return <div className="checklist-row" key={index}>
    <input type="checkbox" aria-label={`Complete task ${index+1}`} disabled={!editable} checked={done} onChange={()=>write(rows.map((l,i)=>i===index?(done?text:'[x] '+text):l))}/>
    <input ref={input=>{inputs.current[index]=input;}} className={'task-text'+(done?' done':'')} aria-label={`Task ${index+1}`} placeholder="Write a task" readOnly={!editable} value={text} onChange={e=>write(rows.map((l,i)=>i===index?(done?'[x] ':'')+e.target.value:l))} onKeyDown={e=>{
     if(!editable)return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();insert(index);}else if(e.key==='Backspace'&&!text&&rows.length>1){e.preventDefault();e.stopPropagation();remove(index);}
    }} onPaste={e=>{const pasted=e.clipboardData.getData('text/plain');if(!editable||!pasted.includes('\n'))return;e.preventDefault();const input=e.currentTarget,start=input.selectionStart??0,end=input.selectionEnd??start,lines=(text.slice(0,start)+pasted.replace(/\r/g,'')+text.slice(end)).split('\n');const next=[...rows];next.splice(index,1,...lines.map((l,i)=>(done&&i===0?'[x] ':'')+l));write(next);setFocus(index+lines.length-1);}}/>
    {editable&&<button className="remove-task" aria-label={`Remove task ${index+1}`} title="Remove task" onClick={()=>remove(index)}>×</button>}
   </div>;
  })}</div>
  {editable&&<button className="add-task" onClick={()=>insert(rows.length-1)}>+ Add task</button>}
 </div>;
}
