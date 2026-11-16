export type ExportFrame={id:string;name:string;x:number;y:number;width:number;height:number};
export function validFrame(value:unknown):value is ExportFrame{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const f=value as ExportFrame;
 return Object.keys(f).length===6&&Object.keys(f).every(k=>['id','name','x','y','width','height'].includes(k))&&typeof f.id==='string'&&f.id.length>0&&f.id.length<=128&&typeof f.name==='string'&&!!f.name.trim()&&f.name.length<=80&&[f.x,f.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000)&&[f.width,f.height].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=80&&n<=10000);
}
export function validFrames(value:unknown):value is ExportFrame[]{return Array.isArray(value)&&value.length<=50&&value.every(validFrame)&&new Set(value.map(f=>f.id)).size===value.length;}
