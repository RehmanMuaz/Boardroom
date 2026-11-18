import {useEffect,useState} from 'react';
export function useMobileViewport(){
 const [phone,setPhone]=useState(()=>matchMedia('(max-width:600px)').matches),[height,setHeight]=useState(()=>window.visualViewport?.height??window.innerHeight);
 useEffect(()=>{const media=matchMedia('(max-width:600px)'),update=()=>{setPhone(media.matches);setHeight(window.visualViewport?.height??window.innerHeight);};media.addEventListener('change',update);window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);return()=>{media.removeEventListener('change',update);window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};},[]);
 return {phone,height};
}
