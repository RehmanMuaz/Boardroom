import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {type Workspace} from './model';
import {type WorkspaceRepository} from './repository';
import {TeamEntry} from './team';
import {Editor} from './features/Editor';
import './style.css';
function Root(){const [opened,setOpened]=useState<{repository:WorkspaceRepository;initial:Workspace}|null>(null);return opened?<Editor key={'id' in opened.repository?opened.repository.id:'local'} open={(repository,initial)=>setOpened({repository,initial})} repository={opened.repository} initial={opened.initial} exit={()=>setOpened(null)}/>:<TeamEntry open={(repository,initial)=>setOpened({repository,initial})}/>;}
createRoot(document.getElementById('root')!).render(<Root/>);
