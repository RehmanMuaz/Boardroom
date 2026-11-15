import {type ReactNode} from 'react';
const icons:Record<string,ReactNode>={
 duplicate:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
 delete:<><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></>,
 undo:<><path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3"/></>,
 redo:<><path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3"/></>,
};
export function ObjectActions({writable,canDuplicate,duplicateLabel,deleteLabel,duplicate,remove,undo,redo}:{writable:boolean;canDuplicate:boolean;duplicateLabel:string;deleteLabel:string;duplicate:()=>void;remove:()=>void;undo:()=>void;redo:()=>void}){
 const actions=[...(writable?[{icon:'duplicate',label:duplicateLabel,disabled:!canDuplicate,run:duplicate},{icon:'delete',label:deleteLabel,disabled:false,run:remove}]:[]),{icon:'undo',label:'Undo',disabled:!writable,run:undo},{icon:'redo',label:'Redo',disabled:!writable,run:redo}];
 return <div className={'object-history object-icon-actions'+(!writable?' view-only-actions':'')} role="group" aria-label="Quick actions">{actions.map(action=><button key={action.icon} type="button" aria-label={action.label} title={action.disabled&&action.icon==='duplicate'?'Connections cannot be duplicated':action.label} disabled={action.disabled} onClick={action.run}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[action.icon]}</svg></button>)}</div>;
}
