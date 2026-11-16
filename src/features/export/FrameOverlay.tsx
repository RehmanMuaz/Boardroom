import {type ExportFrame} from '../../frame-schema';
import './frames.css';
export function FrameOverlay({frames}:{frames:ExportFrame[]}){return <div className="export-frame-layer" aria-hidden="true">{frames.map((f,i)=><div key={f.id} className="export-frame-outline" style={{left:f.x,top:f.y,width:f.width,height:f.height}}><span>{i+1}. {f.name}</span></div>)}</div>;}
