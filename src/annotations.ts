export type Point=[number,number];
export type TextStyle={fontFamily:'sans'|'serif'|'mono'|'rounded';fontSize:number;fontWeight:400|500|600|700|800;italic:boolean;underline:boolean;align:'left'|'center'|'right';background:string;borderColor:string;borderWidth:number;borderStyle:'solid'|'dashed'|'dotted'};
type Base={id:string;x:number;y:number;width:number;height:number;color:string;layer?:number};
export type StrokeAnnotation=Base&{kind:'pen'|'highlighter';thickness:number;points:Point[]};
export type TextAnnotation=Base&{kind:'text';text:string;style:TextStyle};
export type ShapeKind='line'|'arrow'|'rectangle'|'circle';
export type ShapeAnnotation=Base&{kind:'shape';shape:ShapeKind;thickness:number;fill:string;points:[Point,Point]};
export type Annotation=StrokeAnnotation|TextAnnotation|ShapeAnnotation;
export const defaultTextStyle:TextStyle={fontFamily:'sans',fontSize:24,fontWeight:400,italic:false,underline:false,align:'left',background:'transparent',borderColor:'#64786c',borderWidth:0,borderStyle:'solid'};
export const fontFamilies:Record<TextStyle['fontFamily'],string>={sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'"Courier New", monospace',rounded:'"Trebuchet MS", sans-serif'};
const hex=(value:unknown)=>typeof value==='string'&&/^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/.test(value);
const number=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
export function validAnnotation(value:unknown):value is Annotation{
 if(!value||typeof value!=='object')return false;const a=value as Annotation;
 if(typeof a.id!=='string'||!a.id.length||a.id.length>128||!number(a.x,0,100000)||!number(a.y,0,100000)||!number(a.width,1,10000)||!number(a.height,1,10000))return false;
 if(a.layer!==undefined&&(!Number.isInteger(a.layer)||a.layer<0||a.layer>20000))return false;
 const base=['id','kind','x','y','width','height','color','layer'];
 if(a.kind==='text'){
  if(Object.keys(a).some(k=>![...base,'text','style'].includes(k))||a.width<80||a.width>4000||a.height<32||typeof a.text!=='string'||a.text.length>10000||!(hex(a.color)||a.color==='auto'))return false;
  const s=a.style;if(!s||typeof s!=='object'||Object.keys(s).sort().join(',')!==Object.keys(defaultTextStyle).sort().join(','))return false;
  return ['sans','serif','mono','rounded'].includes(s.fontFamily)&&number(s.fontSize,12,120)&&[400,500,600,700,800].includes(s.fontWeight)&&typeof s.italic==='boolean'&&typeof s.underline==='boolean'&&['left','center','right'].includes(s.align)&&(s.background==='transparent'||hex(s.background))&&hex(s.borderColor)&&number(s.borderWidth,0,8)&&Number.isInteger(s.borderWidth)&&['solid','dashed','dotted'].includes(s.borderStyle);
 }
 if(a.kind==='shape'){
  if(Object.keys(a).some(k=>![...base,'shape','thickness','fill','points'].includes(k))||!['line','arrow','rectangle','circle'].includes(a.shape)||!(a.fill==='transparent'||hex(a.fill))||!Array.isArray(a.points)||a.points.length!==2||!hex(a.color)||!number(a.thickness,1,60))return false;
  if(!a.points.every(p=>Array.isArray(p)&&p.length===2&&number(p[0],0,a.width)&&number(p[1],0,a.height)))return false;
  const [start,end]=a.points;return Math.abs(start[0]-end[0])===a.width&&Math.abs(start[1]-end[1])===a.height;
 }
 if(!['pen','highlighter'].includes(a.kind)||Object.keys(a).some(k=>![...base,'thickness','points'].includes(k))||!hex(a.color)||!number(a.thickness,1,60)||!Array.isArray(a.points)||!a.points.length||a.points.length>4096)return false;
 return a.points.every(p=>Array.isArray(p)&&p.length===2&&number(p[0],0,a.width)&&number(p[1],0,a.height));
}
export const clampPoint=(point:{x:number;y:number}):Point=>[Math.min(100000,Math.max(0,point.x)),Math.min(100000,Math.max(0,point.y))];
export function makeStroke(id:string,kind:StrokeAnnotation['kind'],points:Point[],color:string,thickness:number):StrokeAnnotation{
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
 return {id,kind,x,y,width:Math.max(1,Math.max(...xs)-x),height:Math.max(1,Math.max(...ys)-y),color,thickness,points:points.map(p=>[p[0]-x,p[1]-y])};
}
export function strokePath(points:Point[]){if(points.length===1)return `M ${points[0][0]} ${points[0][1]} l .01 0`;return points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ');}
export function makeShape(id:string,shape:ShapeKind,start:Point,end:Point,color:string,thickness:number,fill='transparent'):ShapeAnnotation{
 // Horizontal/vertical shapes use a one-unit box so geometry always remains bounded.
 const adjusted:Point=[end[0]===start[0]?Math.min(100000,start[0]+1):end[0],end[1]===start[1]?Math.min(100000,start[1]+1):end[1]];
 if(adjusted[0]===start[0])adjusted[0]=start[0]-1;if(adjusted[1]===start[1])adjusted[1]=start[1]-1;
 const stroke=makeStroke(id,'pen',[start,adjusted],color,thickness);
 return {...stroke,kind:'shape',shape,fill,points:stroke.points as [Point,Point]};
}
export function shapePath(a:ShapeAnnotation):string{
 const [[sx,sy],[ex,ey]]=a.points;
 if(a.shape==='rectangle')return `M 0 0 H ${a.width} V ${a.height} H 0 Z`;
 if(a.shape==='circle')return `M 0 ${a.height/2} A ${a.width/2} ${a.height/2} 0 1 0 ${a.width} ${a.height/2} A ${a.width/2} ${a.height/2} 0 1 0 0 ${a.height/2} Z`;
 const line=`M ${sx} ${sy} L ${ex} ${ey}`;if(a.shape==='line')return line;
 const angle=Math.atan2(ey-sy,ex-sx),size=Math.min(Math.hypot(ex-sx,ey-sy)*.45,Math.max(12,a.thickness*3));
 return line+` M ${ex-size*Math.cos(angle-.5)} ${ey-size*Math.sin(angle-.5)} L ${ex} ${ey} L ${ex-size*Math.cos(angle+.5)} ${ey-size*Math.sin(angle+.5)}`;
}
export function resizeShape(a:ShapeAnnotation,width:number,height:number):ShapeAnnotation{return {...a,width,height,points:a.points.map(([x,y])=>[x===0?0:width,y===0?0:height]) as [Point,Point]};}
export function automaticTextColor(background:string){if(background==='transparent')return 'var(--ink)';let h=background.slice(1);if(h.length===3)h=h.split('').map(c=>c+c).join('');const channels=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.3?'#242b27':'#f5f7f5';}
