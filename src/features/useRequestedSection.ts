import {useEffect,useRef} from 'react';
/** Wait for the modal open attribute before scrolling its requested section. */
export function useRequestedSection<T extends HTMLElement>(request:number){
 const ref=useRef<T|null>(null);
 useEffect(()=>{
  if(!request)return;const section=ref.current,dialog=section?.closest('dialog');if(!section||!dialog)return;
  if(section instanceof HTMLDetailsElement)section.open=true;
  let frame=0;const scroll=()=>{if(dialog.open){observer.disconnect();frame=requestAnimationFrame(()=>section.scrollIntoView({block:'start'}));}};
  const observer=new MutationObserver(scroll);observer.observe(dialog,{attributes:true,attributeFilter:['open']});scroll();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[request]);
 return ref;
}
