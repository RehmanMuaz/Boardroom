export function NumberSlider({label,name,value,min,max,disabled=false,onChange}:{label:string;name:string;value:number;min:number;max:number;disabled?:boolean;onChange:(value:number)=>void}){
 function change(raw:string){if(raw==='')return;const next=Number(raw);if(Number.isFinite(next)&&next>=min&&next<=max)onChange(next);}
 return <div className="annotation-number-control"><span>{label}</span><input aria-label={`${name} slider`} type="range" min={min} max={max} step={1} value={value} disabled={disabled} onChange={e=>change(e.target.value)}/><input aria-label={name} type="number" min={min} max={max} step={1} value={value} disabled={disabled} onChange={e=>change(e.target.value)}/></div>;
}
