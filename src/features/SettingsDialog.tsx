import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import './settings-dialog.css';
import {containDialogKeys} from './dialogFocus';

/** Native modal supplies focus containment and makes the rest of the editor inert. */
export function SettingsDialog({label,title=label,children,dirty=false,onOpen,onDiscard,busy=false,openRequest=0}:{label:string;title?:string;children:ReactNode;dirty?:boolean;busy?:boolean;openRequest?:number;onOpen?:()=>void;onDiscard?:()=>void}){
 const [open,setOpen]=useState(false),[discard,setDiscard]=useState(false),ref=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{if(open){ref.current?.showModal();}else if(ref.current?.open){ref.current.close();trigger.current?.focus();}},[open]);
 useEffect(()=>{if(openRequest>0){setDiscard(false);setOpen(true);onOpen?.();}},[openRequest]);
 function close(){if(busy)return;if(dirty){setDiscard(true);return;}setOpen(false);}
 return <><button ref={trigger} className={'header-dialog-trigger '+(label==='Account'?'account-trigger':label==='Manage team'?'team-trigger':'actions-trigger')} aria-label={label} aria-haspopup="dialog" onClick={()=>{setDiscard(false);setOpen(true);onOpen?.();}}>{label==='Board actions'?'Actions':label}</button>{createPortal(<dialog ref={ref} className="settings-dialog" aria-labelledby={id} onKeyDown={containDialogKeys} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close();}}}>
  <div className="settings-dialog-header"><h2 id={id}>{title}</h2><button aria-label={'Close '+title} onClick={close} disabled={busy}>Close</button></div>
  {discard&&<div role="alert"><h3>Discard unsaved changes?</h3><p>Your form has changes that have not been submitted.</p><button onClick={()=>setDiscard(false)}>Keep editing</button><button onClick={()=>{onDiscard?.();setDiscard(false);setOpen(false);}}>Discard and close</button></div>}<div className="settings-dialog-body" hidden={discard}>{children}</div>
 </dialog>,document.body)}</>;
}
