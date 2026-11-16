export type ImagePoint=[number,number];
export type ImageMark={id:string;color:string;size:number}&({kind:'pen';points:ImagePoint[]}|{kind:'text';point:ImagePoint;text:string});
export type ImageEdit={rotation:0|90|180|270;crop:{x:number;y:number;width:number;height:number};marks:ImageMark[]};
export const originalImageEdit:ImageEdit={rotation:0,crop:{x:0,y:0,width:1,height:1},marks:[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const unit=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
const point=(v:unknown):v is ImagePoint=>Array.isArray(v)&&v.length===2&&v.every(unit);
export function validImageEdit(v:unknown):v is ImageEdit{
 if(!object(v)||Object.keys(v).sort().join(',')!=='crop,marks,rotation'||![0,90,180,270].includes(v.rotation as number)||!object(v.crop)||Object.keys(v.crop).sort().join(',')!=='height,width,x,y')return false;
 const c=v.crop;if(![c.x,c.y,c.width,c.height].every(unit)||Number(c.width)<.01||Number(c.height)<.01||Number(c.x)+Number(c.width)>1.00000001||Number(c.y)+Number(c.height)>1.00000001||!Array.isArray(v.marks)||v.marks.length>100)return false;
 let points=0;const ids=new Set<string>();return v.marks.every(m=>{
  if(!object(m)||typeof m.id!=='string'||!m.id.length||m.id.length>128||ids.has(m.id)||typeof m.color!=='string'||!/^#[a-f\d]{6}$/i.test(m.color)||typeof m.size!=='number'||!Number.isFinite(m.size)||m.size<1||m.size>120)return false;ids.add(m.id);
  if(m.kind==='pen')return Object.keys(m).sort().join(',')==='color,id,kind,points,size'&&Array.isArray(m.points)&&m.points.length>0&&m.points.length<=2048&&(points+=m.points.length)<=10000&&m.points.every(point);
  return m.kind==='text'&&Object.keys(m).sort().join(',')==='color,id,kind,point,size,text'&&point(m.point)&&typeof m.text==='string'&&!!m.text.trim()&&m.text.length<=120&&!/[\r\n]/.test(m.text);
 });
}
export function rotatePoint([x,y]:ImagePoint,rotation:ImageEdit['rotation']):ImagePoint{return rotation===90?[1-y,x]:rotation===180?[1-x,1-y]:rotation===270?[y,1-x]:[x,y];}
export function sourcePoint(p:ImagePoint,rotation:ImageEdit['rotation']){return rotatePoint(p,((360-rotation)%360) as ImageEdit['rotation']);}
export function rotateImage(edit:ImageEdit):ImageEdit{const c=edit.crop;return {...edit,rotation:((edit.rotation+90)%360) as ImageEdit['rotation'],crop:{x:Math.max(0,1-c.y-c.height),y:c.x,width:c.height,height:c.width}};}
export function imageGeometry(width:number,height:number,edit:ImageEdit=originalImageEdit){const sideways=edit.rotation===90||edit.rotation===270,w=sideways?height:width,h=sideways?width:height;return {width:w,height:h,x:edit.crop.x*w,y:edit.crop.y*h,cropWidth:edit.crop.width*w,cropHeight:edit.crop.height*h,aspect:edit.crop.width*w/(edit.crop.height*h)};}
export function markPoint(p:ImagePoint,width:number,height:number,rotation:ImageEdit['rotation']){const [x,y]=rotatePoint(p,rotation),sideways=rotation===90||rotation===270;return {x:x*(sideways?height:width),y:y*(sideways?width:height)};}

/** JPEG APP1 Exif images are decoded to oriented PNGs for PDF consistency with browsers. */
export function hasExifMetadata(bytes:Uint8Array){
 if(bytes[0]!==255||bytes[1]!==216)return false;let i=2;
 while(i+4<=bytes.length){while(bytes[i]===255&&bytes[i+1]===255)i++;if(bytes[i]!==255)return false;const marker=bytes[i+1];if(marker===218||marker===217)return false;const length=bytes[i+2]*256+bytes[i+3];if(length<2||i+2+length>bytes.length)return false;if(marker===225&&length>=8&&[69,120,105,102,0,0].every((v,n)=>bytes[i+4+n]===v))return true;i+=2+length;}
 return false;
}
