import {type BoardPattern} from '../boardAppearance';
export function BoardAppearance({background,pattern,writable,change}:{background?:string;pattern?:BoardPattern;writable:boolean;change:(patch:{background?:string;pattern?:BoardPattern})=>void}){
 return <details className="board-appearance" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>Board appearance</summary><div className="board-appearance-panel" role="group" aria-label="Board appearance settings">
  <label>Background<input aria-label="Board background color" type="color" disabled={!writable} value={background??'#f3f3ef'} onChange={e=>change({background:e.target.value})}/></label>
  <button disabled={!writable||background===undefined} onClick={()=>change({background:undefined})}>Use theme background</button>
  <label>Canvas<select aria-label="Board canvas pattern" disabled={!writable} value={pattern??'dots'} onChange={e=>change({pattern:e.target.value as BoardPattern})}><option value="plain">Plain</option><option value="dots">Dots</option><option value="grid">Grid</option></select></label>
  <small>{writable?'Shared with everyone on this board.':'View only'}</small>
 </div></details>;
}
