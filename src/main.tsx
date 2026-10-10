import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {type Workspace} from './model';
import {LocalRepository,type WorkspaceRepository} from './repository';
import {ThemeProvider} from './theme';
import {TeamEntry} from './team';
import {Editor} from './features/Editor';
import './style.css';
import './themes.css';
function Root(){const [opened,setOpened]=useState<{repository:WorkspaceRepository;initial:Workspace}|null>(null);return <ThemeProvider localCanvas={opened?.repository instanceof LocalRepository}>{opened?<Editor key={'id' in opened.repository?opened.repository.id:'local'} open={(repository,initial)=>setOpened({repository,initial})} repository={opened.repository} initial={opened.initial} exit={()=>setOpened(null)}/>:<TeamEntry open={(repository,initial)=>setOpened({repository,initial})}/>}</ThemeProvider>;}
createRoot(document.getElementById('root')!).render(<Root/>);
