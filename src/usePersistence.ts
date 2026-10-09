import {useEffect,useRef,useState} from 'react';
import {TeamRepository,type WorkspaceRepository} from './repository';
import {type Workspace} from './model';

export function usePersistence(state:Workspace,repository:WorkspaceRepository,writable:boolean){
 const saved=repository instanceof TeamRepository?'Saved to team database':'Saved locally';
 const [status,setStatus]=useState(saved),[dirty,setDirty]=useState(false);
 const first=useRef(true),generation=useRef(0),queue=useRef(Promise.resolve());
 useEffect(()=>{
  if(repository instanceof TeamRepository)return;
  if(first.current){first.current=false;return;}if(!writable)return;
  const current=++generation.current;setDirty(true);setStatus('Unsaved changes');
  const timer=setTimeout(()=>{setStatus('Saving...');queue.current=queue.current.then(async()=>{
   await repository.save(state);
   if(current===generation.current){setStatus(saved);setDirty(false);}
  }).catch((e:Error)=>{setStatus(e.message+' Export your edits before reloading.');});},600);
  return()=>clearTimeout(timer);
 },[state,repository,writable,saved]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 return {status,dirty};
}
