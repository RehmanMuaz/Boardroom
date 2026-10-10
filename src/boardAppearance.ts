import {type CSSProperties} from 'react';
export type BoardPattern='plain'|'dots'|'grid';
export function validBoardBackground(value:unknown):value is string{return typeof value==='string'&&/^#[a-fA-F0-9]{6}$/.test(value);}
export function validBoardPattern(value:unknown):value is BoardPattern{return ['plain','dots','grid'].includes(value as string);}
export function boardCanvasStyle(background?:string,pattern?:BoardPattern):CSSProperties{
 const color=background??'var(--canvas)',ink=background?contrastPattern(background):'var(--grid)';
 return {backgroundColor:color,backgroundImage:pattern==='plain'?'none':pattern==='grid'?`linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`:`radial-gradient(${ink} .8px, transparent .8px)`,backgroundSize:'20px 20px'};
}
function contrastPattern(color:string){const values=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));return .2126*values[0]+.7152*values[1]+.0722*values[2]>140?'#00000020':'#ffffff30';}
