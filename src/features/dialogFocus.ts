import {type KeyboardEvent} from 'react';
export function containDialogKeys(event:KeyboardEvent<HTMLDialogElement>){
 event.stopPropagation();
 if(event.key!=='Tab')return;
 const nodes=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
 const first=nodes[0],last=nodes[nodes.length-1],active=document.activeElement;
 if(!first){event.preventDefault();event.currentTarget.focus();return;}
 if(event.shiftKey&&(active===first||!nodes.includes(active as HTMLElement))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(active===last||!nodes.includes(active as HTMLElement))){event.preventDefault();first.focus();}
}
