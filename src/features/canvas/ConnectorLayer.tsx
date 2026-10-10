import {useId} from 'react';
import {type Board} from '../../model';
import {connectorPath} from './connectors';

export function ConnectorLayer({board,width,height,selected,select,interactive=true}:{board:Board;width:number;height:number;selected:string|null;select:(id:string)=>void;interactive?:boolean}){
 const marker=useId().replace(/:/g,'');
 return <svg className="connectors" width={width} height={height} aria-label="Card connections" style={{pointerEvents:'none'}}>
  <defs><marker id={marker} viewBox="0 -5 12 10" refX="9" refY="0" markerWidth="12" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 -5 L 12 0 L 0 5 z" fill="context-stroke"/></marker></defs>
  {(board.connectors??[]).map(line=>{
   const from=board.cards.find(c=>c.id===line.from),to=board.cards.find(c=>c.id===line.to);if(!from||!to)return null;
   const d=connectorPath(from,to);if(!d)return null;
   return <g key={line.id} data-connector-id={line.id}>
    <path className={selected===line.id?'connection selected-line':'connection'} d={d} stroke={line.color} markerEnd={`url(#${marker})`} style={{pointerEvents:interactive?'stroke':'none'}} tabIndex={interactive?0:-1} role="button" aria-label={`Connection from ${from.title??from.text.slice(0,30)} to ${to.title??to.text.slice(0,30)}`} onClick={e=>{e.stopPropagation();select(line.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(line.id);}}}/>
   </g>;
  })}
 </svg>;
}
