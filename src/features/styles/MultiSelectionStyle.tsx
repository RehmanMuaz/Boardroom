import {type Workspace,type Board} from '../../model';
import {type StyleValues} from '../../style-schema';
import {selectionStyles,patchSelectionStyles,resetSelectionStyle,type SelectionProperty} from '../../selectionStyles';
import {ModifierSection} from '../ModifierSection';
import {ColorPicker} from '../content/ColorPicker';
import './multi-selection-style.css';

export function MultiSelectionStyle({workspace,board,ids,writable,current,change}:{workspace:Workspace;board:Board;ids:string[];writable:boolean;current:()=>Workspace;change:(next:Workspace)=>void}){
 const info=selectionStyles(workspace,board.id,ids),v=info.values;
 const patch=(p:Partial<StyleValues>)=>{if(writable)change(patchSelectionStyles(current(),board.id,ids,p));};
 function status(key:SelectionProperty,label:string){return <span className="mixed-property-status"><small>{info.status(key)}</small>{info.canReset(key)&&<button type="button" disabled={!writable} aria-label={'Reset selection '+label} title={'Reset '+label+' to inherited values'} onClick={()=>change(resetSelectionStyle(current(),board.id,ids,key))}>&#8634;</button>}</span>;}
 function choice<K extends SelectionProperty>(key:K,label:string,options:readonly StyleValues[K][],names?:string[]){return <div className="mixed-property"><label>{label}<select disabled={!writable} aria-label={'Selection '+label.toLowerCase()} value={v[key]===undefined?'':String(v[key])} onChange={e=>patch({[key]:typeof options[0]==='number'?Number(e.target.value):e.target.value})}><option value="" disabled>Mixed</option>{options.map((value,i)=><option key={String(value)} value={String(value)}>{names?.[i]??String(value)}</option>)}</select></label>{status(key,label.toLowerCase())}</div>;}
 function toggle(key:'italic'|'underline',label:string){return <div className="mixed-property"><label className="mixed-toggle"><input type="checkbox" disabled={!writable} aria-label={'Selection '+label.toLowerCase()} aria-checked={v[key]===undefined?'mixed':v[key]} checked={v[key]??false} ref={el=>{if(el)el.indeterminate=v[key]===undefined;}} onChange={e=>patch({[key]:e.target.checked})}/>{label}{v[key]===undefined&&<small>Mixed</small>}</label>{status(key,label.toLowerCase())}</div>;}
 return <>
 <ModifierSection title="Typography"><p className="mixed-selection-help">Typography applies to {info.styledCount} of {info.count} selected cards. {info.styledCount<info.count?(workspace.workspaceStyle?'Link other text-bearing cards to a style individually to edit their typography. Media and legacy cards keep their appearance. ':'Enable workspace styles in Board actions, then link cards individually to edit typography. Existing cards keep their appearance. '):''}Mixed means the values differ; editing changes only that property.</p>
 {info.styledCount>0&&<fieldset className="mixed-style-fields" disabled={!writable}>
 {choice('fontFamily','Font',['sans','serif','mono','rounded'],['Sans serif','Serif','Monospace','Rounded'])}
 <div className="mixed-property"><label>Font size {v.fontSize===undefined&&<small>Mixed</small>}<div className="style-size"><input type="range" aria-label="Selection font size slider" aria-valuetext={v.fontSize===undefined?'Mixed; move slider to set all':String(v.fontSize)} min={12} max={120} value={v.fontSize??66} onChange={e=>patch({fontSize:e.target.valueAsNumber})}/><input type="number" aria-label="Selection font size" min={12} max={120} placeholder="Mixed" value={v.fontSize??''} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n)&&n>=12&&n<=120)patch({fontSize:n});}}/></div></label>{status('fontSize','font size')}</div>
 {choice('fontWeight','Font weight',[400,500,600,700,800])}{toggle('italic','Italic')}{toggle('underline','Underline')}{choice('align','Alignment',['left','center','right'])}
 </fieldset>}</ModifierSection>
 {info.styledCount>0&&<>
 <ModifierSection title="Text color"><p className="mixed-selection-help">Applies to {info.styledCount} style-linked cards. Per-word rich-text formatting stays unchanged.</p><fieldset className="mixed-style-fields" disabled={!writable}><ColorPicker name="Selection text color" value={v.textColor==='auto'?undefined:v.textColor} disabled={!writable} emptyLabel={v.textColor==='auto'?'Auto':'Mixed'} change={textColor=>patch({textColor})}/>{status('textColor','text color')}<button type="button" onClick={()=>patch({textColor:'auto'})}>Automatic selection text color</button></fieldset></ModifierSection>
 <ModifierSection title="Border"><p className="mixed-selection-help">Applies to {info.styledCount} style-linked cards.</p><fieldset className="mixed-style-fields" disabled={!writable}>{choice('borderWidth','Border width',[0,1,2,3,4,5,6,7,8])}<ColorPicker name="Selection border color" value={v.borderColor} disabled={!writable} change={borderColor=>patch({borderColor})}/>{status('borderColor','border color')}{choice('borderStyle','Border style',['solid','dashed','dotted'])}</fieldset></ModifierSection>
 </>}
 </>;
}
