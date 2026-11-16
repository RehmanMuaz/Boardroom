import {type ImageEdit} from './image-edit';
export type Crop=ImageEdit['crop'];
export type CropHandle='move'|'n'|'s'|'e'|'w'|'nw'|'ne'|'sw'|'se';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*1e10)/1e10;
export function dragCrop(c:Crop,handle:CropHandle,dx:number,dy:number):Crop{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return c;
 if(handle==='move')return {...c,x:clamp(c.x+dx,0,1-c.width),y:clamp(c.y+dy,0,1-c.height)};
 let left=c.x,top=c.y,right=c.x+c.width,bottom=c.y+c.height;
 if(handle.includes('w'))left=clamp(left+dx,0,right-.01);
 if(handle.includes('e'))right=clamp(right+dx,left+.01,1);
 if(handle.includes('n'))top=clamp(top+dy,0,bottom-.01);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+.01,1);
 return {x:round(left),y:round(top),width:round(right-left),height:round(bottom-top)};
}
