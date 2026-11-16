/** Read local upload geometry before creating its card; never resize saved boards on load. */
export function mediaAspect(file:File,kind:'image'|'video'):Promise<number|undefined>{
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file),element=kind==='image'?new Image():document.createElement('video');
  let finished=false;const finish=(ratio?:number)=>{if(finished)return;finished=true;clearTimeout(timer);element.onload=null;element.onerror=null;if(element instanceof HTMLVideoElement){element.onloadedmetadata=null;element.removeAttribute('src');element.load();}URL.revokeObjectURL(url);resolve(ratio&&Number.isFinite(ratio)&&ratio>0?ratio:undefined);};
  const timer=setTimeout(()=>finish(),10000);element.onerror=()=>finish();
  if(element instanceof HTMLVideoElement){element.preload='metadata';element.onloadedmetadata=()=>finish(element.videoWidth/element.videoHeight);}else element.onload=()=>finish(element.naturalWidth/element.naturalHeight);
  element.src=url;
 });
}
