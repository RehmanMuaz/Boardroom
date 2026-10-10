import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {api} from './repository';

type Theme='light'|'dark'|'system';
const key='boardroom.theme';
const valid=(value:unknown):value is Theme=>value==='light'||value==='dark'||value==='system';
function deviceTheme():Theme{try{const value=localStorage.getItem(key);return valid(value)?value:'system';}catch{return 'system';}}
const Context=createContext<{theme:Theme;busy:boolean;error:string;change:(theme:Theme)=>void}|null>(null);
export function ThemeProvider({localCanvas,children}:{localCanvas:boolean;children:ReactNode}){
 const [device,setDevice]=useState(deviceTheme),[account,setAccount]=useState<Theme>('system'),[user,setUser]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
 const identity=useRef<string|null>(null),generation=useRef(0);
 const personal=Boolean(user&&!localCanvas),theme=personal?account:device;
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)'),system=()=>setSystemDark(media.matches);
  const session=(event:Event)=>{const info=(event as CustomEvent<{userId?:string;theme?:unknown}>).detail;const next=info.userId??null;if(next!==identity.current){generation.current++;setBusy(false);setError('');}identity.current=next;setUser(next);setAccount(valid(info.theme)?info.theme:'system');};
  const storage=(event:StorageEvent)=>{if(event.key===key)setDevice(deviceTheme());};
  const refresh=()=>{void api('/session').catch(()=>{});};
  media.addEventListener('change',system);window.addEventListener('boardroom:session',session);window.addEventListener('storage',storage);window.addEventListener('focus',refresh);
  return()=>{media.removeEventListener('change',system);window.removeEventListener('boardroom:session',session);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);};
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme==='system'?(systemDark?'dark':'light'):theme;document.documentElement.style.colorScheme=theme==='system'?(systemDark?'dark':'light'):theme;},[theme,systemDark]);
 function change(next:Theme){
  setError('');if(!personal){setDevice(next);try{localStorage.setItem(key,next);}catch{setError('Theme changed, but this browser could not remember it.');}return;}
  const request=++generation.current;setBusy(true);
  void api<{theme:Theme}>('/account/preferences','PATCH',{theme:next}).then(result=>{if(request===generation.current)setAccount(result.theme);}).catch(e=>{if(request===generation.current)setError((e as Error).message);}).finally(()=>{if(request===generation.current)setBusy(false);});
 }
 return <Context.Provider value={{theme,busy,error,change}}>{children}</Context.Provider>;
}
export function ThemeControl(){const context=useContext(Context);if(!context)return null;return <div className="theme-control"><label>Appearance<select aria-label="Appearance" value={context.theme} disabled={context.busy} onChange={e=>context.change(e.target.value as Theme)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>{context.busy&&<small role="status">Saving appearance…</small>}{context.error&&<small role="alert">{context.error}</small>}</div>;}
