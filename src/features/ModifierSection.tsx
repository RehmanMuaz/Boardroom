import {useId,type ReactNode} from 'react';
export function ModifierSection({title,children}:{title:string;children:ReactNode}){const id=useId();return <section className="modifier-section" aria-labelledby={id}><h3 id={id}>{title}</h3><div className="modifier-section-content">{children}</div></section>;}
