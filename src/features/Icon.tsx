import {type ReactNode} from 'react';
const paths:Record<string,ReactNode>={
 chevron:<path d="m6 9 6 6 6-6"/>,
 note:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
 link:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
 checklist:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 12 3 3 7-7"/></>,
 board:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/></>,
 column:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h8"/></>,
 connection:<><path d="M5 19 19 5M10 5h9v9"/></>,
 image:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></>,
 video:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m10 8 6 4-6 4z"/></>,
 file:<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 14h8M8 17h5"/></>,
 undo:<path d="m9 5-5 5 5 5M4 10h9a6 6 0 0 1 6 6v3"/>,
 redo:<path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3"/>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 account:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 team:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
 actions:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="9" cy="18" r="2" fill="var(--surface)"/></>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 back:<path d="M20 12H4m6-6-6 6 6 6"/>,
};
export function Icon({name,size=18}:{name:string;size?:number}){return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;}
export function AppMark({size=26}:{size?:number}){return <img className="app-mark" src="/brand/boardroom.svg" width={size} height={size} alt="" aria-hidden="true"/>;}
