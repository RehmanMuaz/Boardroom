import {useState} from 'react';
import {type Workspace} from '../model';
import {same} from '../operations';
import {fontFamilies,automaticTextColor} from '../annotations';
import {captureFormatting,formattingSignature,paintCompatibility,paintFormatting,paintChanges,type CapturedFormat,type PaintMode,type PaintTarget} from '../formatPainter';
import './format-painter.css';

export function FormatPainter({workspace,boardId,target,source,current,apply,cancel}:{workspace:Workspace;boardId:string;target?:PaintTarget;source:CapturedFormat;current:()=>Workspace;apply:(next:Workspace)=>void;cancel:()=>void}){
 const [mode,setMode]=useState<PaintMode>('fixed');
 const [expected,setExpected]=useState(()=>target?formattingSignature(workspace,boardId,target):null);
 const reason=paintCompatibility(workspace,boardId,target,source,mode);
 const signature=target?formattingSignature(workspace,boardId,target):null;
 const stale=!same(signature,expected);
 const next=!reason&&target?paintFormatting(workspace,boardId,target,source,mode):null;
 const preview=next&&target?captureFormatting(next,boardId,target):null;
 const changes=preview&&target?paintChanges(captureFormatting(workspace,boardId,target),preview):[];
 const unchanged=next&&same(workspace,next);
 return <section className="format-painter" aria-label="Format Painter" onKeyDown={e=>{if(e.key===' ')e.stopPropagation();}}>
  <strong>Format Painter</strong><p>From {source.label}. Select a target, then apply.</p>
  <label>Formatting method<select value={mode} onChange={e=>setMode(e.target.value as PaintMode)}><option value="fixed">Fixed formatting</option>{source.binding&&workspace.workspaceStyle&&<option value="linked">Linked named style</option>}</select></label>
  <p>{mode==='linked'?`Link to ${source.binding?.role}; source overrides are excluded.`:source.family==='card'&&source.legacy?'Copy background color. Legacy card typography stays unchanged.':'Copy current appearance as custom formatting.'} Content and position stay unchanged.</p>
  {preview&&<div className="format-preview" aria-label="Formatting preview">{'values' in preview?<span style={{fontFamily:fontFamilies[preview.values.fontFamily],fontSize:Math.min(28,preview.values.fontSize),fontWeight:preview.values.fontWeight,fontStyle:preview.values.italic?'italic':'normal',textDecoration:preview.values.underline?'underline':'none',background:preview.family==='card'?preview.values.cardColor:preview.values.background,color:preview.values.textColor==='auto'?automaticTextColor(preview.family==='card'?preview.values.cardColor:preview.values.background):preview.values.textColor}}>Aa</span>:<span style={{border:`${Math.min(8,preview.thickness)}px solid ${preview.color}`,background:preview.family==='shape'?preview.fill:undefined}}>Stroke</span>}<p>{changes.length?changes.join(', '):unchanged?'Already matches':'Custom formatting overrides'}</p></div>}
  <p role="status">{reason??(stale?'Target formatting changed. Refresh the preview before applying.':unchanged?'No changes needed.':'Ready to apply. Escape cancels.')}</p>
  {stale&&!reason&&<button onClick={()=>setExpected(signature)}>Refresh preview</button>}
  <div className="format-actions"><button disabled={!!reason||stale||!!unchanged} onClick={()=>{if(!target||!same(formattingSignature(current(),boardId,target),expected)){setExpected(null);return;}apply(paintFormatting(current(),boardId,target,source,mode));cancel();}}>Apply formatting</button><button onClick={cancel}>Cancel</button></div>
 </section>;
}
