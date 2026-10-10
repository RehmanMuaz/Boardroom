import {type Card} from '../../model';
import {cardWidth,cardHeight} from './domain';

// Aim along the center-to-center axis, but stop outside both card rectangles.
export function connectorEndpoints(from:Card,to:Card,gap=2){
 const startCenter={x:from.x+cardWidth(from)/2,y:from.y+cardHeight(from)/2};
 const endCenter={x:to.x+cardWidth(to)/2,y:to.y+cardHeight(to)/2};
 const dx=endCenter.x-startCenter.x,dy=endCenter.y-startCenter.y;
 if(dx===0&&dy===0)return null;
 const exit=(card:Card)=>Math.min(dx===0?Infinity:(cardWidth(card)/2+gap)/Math.abs(dx),dy===0?Infinity:(cardHeight(card)/2+gap)/Math.abs(dy));
 const source=exit(from),destination=exit(to);
 // Touching/overlapping items have no exposed segment along this axis.
 if(source+destination>=1)return null;
 return {start:{x:startCenter.x+dx*source,y:startCenter.y+dy*source},end:{x:endCenter.x-dx*destination,y:endCenter.y-dy*destination}};
}
export function connectorPath(from:Card,to:Card){
 const endpoints=connectorEndpoints(from,to);if(!endpoints)return null;
 const dx=endpoints.end.x-endpoints.start.x,dy=endpoints.end.y-endpoints.start.y,length=Math.hypot(dx,dy);
 // The marker tip extends three units beyond the shaft, keeping even thick selected arrows pointed.
 if(length<=3)return null;
 const end={x:endpoints.end.x-dx/length*3,y:endpoints.end.y-dy/length*3};
 const number=(value:number)=>Number(value.toFixed(3));
 return `M ${number(endpoints.start.x)} ${number(endpoints.start.y)} L ${number(end.x)} ${number(end.y)}`;
}
