import {useEffect,useState} from 'react';
import {api,LocalRepository,TeamRepository,type WorkspaceRepository} from '../repository';
import {type Workspace} from '../model';
import {ThemeControl} from '../theme';

type Team={id:string;name:string;role:string};
export function WorkspaceControls({repository,canLeave,open,exit,onError}:{repository:WorkspaceRepository;canLeave:()=>boolean;open:(repository:WorkspaceRepository,state:Workspace)=>void;exit:()=>void;onError:(message:string)=>void}){
 const [teams,setTeams]=useState<Team[]>([]),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[renaming,setRenaming]=useState(false),[rename,setRename]=useState(''),[expectedName,setExpectedName]=useState('');
 const team=repository instanceof TeamRepository?repository:undefined;
 useEffect(()=>{const dismiss=(event:PointerEvent)=>{if(!(event.target instanceof Node))return;for(const details of document.querySelectorAll<HTMLDetailsElement>('header details[open]'))if(!details.contains(event.target))details.open=false;};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);
 useEffect(()=>{let active=true;void (async()=>{const session=await api<{email?:string;userId?:string}>('/session');if(!active)return;setEmail(session.email??'');if(session.userId){const list=await api<Team[]>('/workspaces');if(active)setTeams(list);}})().catch(()=>{/* Local canvas also works without the API. */});return()=>{active=false;};},[repository]);
 useEffect(()=>{const changed=(event:Event)=>{const detail=(event as CustomEvent<{id:string;name:string}>).detail;setTeams(list=>list.map(t=>t.id===detail.id?{...t,name:detail.name}:t));if(team?.id===detail.id)team.displayName=detail.name;};window.addEventListener('boardroom:workspace-name',changed);return()=>window.removeEventListener('boardroom:workspace-name',changed);},[team]);
 const current=teams.find(t=>t.id===team?.id),owner=current?.role==='owner';
 async function saveName(){if(!team||!owner||busy)return;setBusy(true);try{const result=await api<{id:string;name:string}>(`/workspaces/${team.id}`,'PATCH',{name:rename,expectedName});team.displayName=result.name;setTeams(list=>list.map(t=>t.id===result.id?{...t,name:result.name}:t));setRenaming(false);}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
 async function switchTo(next:WorkspaceRepository){if(!canLeave())return;setBusy(true);try{const state=await next.load();if(canLeave())open(next,state);}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
 return <>
  <details className="workspace-switcher header-popover"><summary aria-label="Switch workspace"><span>{team?(teams.find(t=>t.id===team.id)?.name??team.displayName):'Browser-local canvas'}</span><span aria-hidden="true">⌄</span></summary><div className="popover-content">
   <strong>Workspaces</strong>{teams.map(t=><button key={t.id} disabled={busy||t.id===team?.id} aria-current={t.id===team?.id?'true':undefined} onClick={()=>void switchTo(new TeamRepository(t.id,t.name))}>{t.name}<small>{t.role}{t.id===team?.id?' · current':''}</small></button>)}
   {owner&&<><button disabled={busy} onClick={()=>{const name=current?.name??team!.displayName;setExpectedName(name);setRename(name);setRenaming(true);}}>Rename workspace</button>{renaming&&<form className="workspace-rename" onSubmit={e=>{e.preventDefault();void saveName();}}><label>Workspace name<input aria-label="Workspace name" autoFocus required maxLength={120} value={rename} disabled={busy} onChange={e=>setRename(e.target.value)}/></label><button disabled={busy||!rename.trim()||rename.trim()===expectedName}>Save name</button><button type="button" disabled={busy} onClick={()=>setRenaming(false)}>Cancel</button></form>}</>}
   <button disabled={busy||!team} onClick={()=>void switchTo(new LocalRepository())}>Browser-local canvas<small>Only on this device</small></button>
   <button onClick={()=>{if(canLeave())exit();}}>All workspaces</button>
  </div></details>
  <details className="account-menu header-popover"><summary aria-label="Account">Account</summary><div className="popover-content"><ThemeControl/>{email?<><p>{email}</p><button disabled={busy} onClick={()=>{if(!canLeave())return;setBusy(true);void api('/logout','POST').then(exit).catch(e=>onError(e.message)).finally(()=>setBusy(false));}}>Sign out</button></>:<button onClick={()=>{if(canLeave())exit();}}>Sign in</button>}</div></details>
 </>;
}
