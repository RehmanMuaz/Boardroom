import {useEffect,useState} from 'react';
import {api} from '../repository';
import {SharedRepository} from '../sharedRepository';
import {type Workspace} from '../model';
import {Editor} from './Editor';
export function SharedEntry(){
 const [opened,setOpened]=useState<{repository:SharedRepository;initial:Workspace}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void(async()=>{await api('/session');const token=new URLSearchParams(window.location.hash.slice(1)).get('viewer');let linkId=window.location.pathname.split('/')[2];if(token){const result=await api<{linkId:string}>('/viewer/open','POST',{token});linkId=result.linkId;window.history.replaceState(null,'','/shared/'+linkId);}if(!linkId)throw Error('Open the viewing link from your email.');const repository=new SharedRepository(linkId),initial=await repository.load();if(active)setOpened({repository,initial});})().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 if(error)return <div className="team-entry"><h1>boardroom</h1><p role="alert">{error}</p><a href="/">Return to Boardroom</a></div>;
 if(!opened)return <div className="team-entry"><h1>boardroom</h1><p role="status">Opening shared workspace…</p></div>;
 return <Editor repository={opened.repository} initial={opened.initial} exit={()=>setError('This shared view is no longer available. Open the original link or ask the owner for a new one.')} open={()=>{}}/>;
}
