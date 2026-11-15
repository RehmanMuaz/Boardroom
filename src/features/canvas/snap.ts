export const GRID_SIZE=20;
export function snapPoint(point:{x:number;y:number},enabled:boolean){return enabled?{x:Math.max(0,Math.min(100000,Math.round(point.x/GRID_SIZE)*GRID_SIZE)),y:Math.max(0,Math.min(100000,Math.round(point.y/GRID_SIZE)*GRID_SIZE))}:point;}
