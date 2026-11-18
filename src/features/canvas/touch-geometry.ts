export type TouchPoint={x:number;y:number};
export function pinchTransform(start:{distance:number;zoom:number;anchor:TouchPoint},a:TouchPoint,b:TouchPoint){
 const distance=Math.hypot(b.x-a.x,b.y-a.y),zoom=Math.max(.25,Math.min(2,start.zoom*distance/Math.max(1,start.distance)));
 return {zoom,left:Math.max(0,start.anchor.x*zoom-(a.x+b.x)/2),top:Math.max(0,start.anchor.y*zoom-(a.y+b.y)/2)};
}
