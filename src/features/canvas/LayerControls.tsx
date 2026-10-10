import {type LayerAction} from './organization';
export function LayerControls({change}:{change:(action:LayerAction)=>void}){
 return <details className="layer-controls"><summary>Arrange</summary><div className="layer-menu">{([['forward','Bring forward'],['backward','Send backward'],['front','Bring to front'],['back','Send to back']] as [LayerAction,string][]).map(([action,label])=><button key={action} onClick={()=>change(action)}>{label}</button>)}</div></details>;
}
