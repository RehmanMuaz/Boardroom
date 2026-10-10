import {useId} from 'react';
import {type Board} from '../../model';
import {cardHeight,cardWidth} from './domain';

export function ConnectorLayer({board,width,height,selected,select,interactive=true}:{board:Board;width:number;height:number;selected:string|null;select:(id:string)=>void;interactive?:boolean}){
 const marker=useId().replace(/:/g,'');
 return <svg className="connectors" width={width} height={height} aria-label="Card connections" style={{pointerEvents:'none'}}>
  <defs><marker id={marker} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto"><path d="M 1 1 L 10 6 L 1 11 z" fill="context-stroke" stroke="white" strokeWidth=".5"/></marker></defs>
  {(board.connectors??[]).map(line=>{
   const from=board.cards.find(c=>c.id===line.from),to=board.cards.find(c=>c.id===line.to);if(!from||!to)return null;
   const x=from.x+cardWidth(from)/2,y=from.y+cardHeight(from)/2,tx=to.x+cardWidth(to)/2,ty=to.y+cardHeight(to)/2;
   const d=x===tx&&y===ty?`M ${x} ${y} C ${x+80} ${y-80},${x+80} ${y+80},${tx} ${ty}`:`M ${x} ${y} L ${tx} ${ty}`;
   return <g key={line.id} data-connector-id={line.id}>
    <path className="connection-halo" d={d} stroke="white" strokeWidth={7} fill="none" pointerEvents="none"/>
    <path className={selected===line.id?'connection selected-line':'connection'} d={d} stroke={line.color} markerEnd={`url(#${marker})`} style={{pointerEvents:interactive?'stroke':'none'}} tabIndex={interactive?0:-1} role="button" aria-label={`Connection from ${from.title??from.text.slice(0,30)} to ${to.title??to.text.slice(0,30)}`} onClick={e=>{e.stopPropagation();select(line.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(line.id);}}}/>
   </g>;
  })}
 </svg>;
}
