import {type Workspace} from './model';
import {type ExportFrame,validFrame} from './frame-schema';
import {same} from './operations';
export function addFrame(workspace:Workspace,boardId:string,rect:{x:number;y:number;width:number;height:number},id:string=crypto.randomUUID()):Workspace{
 const board=workspace.boards.find(b=>b.id===boardId);if(!board)throw Error('Board not found');if((board.frames?.length??0)>=50)throw Error('A board supports up to 50 export frames.');
 if(rect.width>10000||rect.height>10000)throw Error('The selected region exceeds 10,000 px. Choose a smaller selection.');let number=(board.frames?.length??0)+1;while(board.frames?.some(f=>f.name==='Frame '+number))number++;
 const frame:ExportFrame={id,name:'Frame '+number,x:Math.max(0,Math.min(100000,rect.x)),y:Math.max(0,Math.min(100000,rect.y)),width:Math.max(80,Math.min(10000,rect.width)),height:Math.max(80,Math.min(10000,rect.height))};if(!validFrame(frame))throw Error('Invalid frame bounds');
 return {...workspace,boards:workspace.boards.map(b=>b.id===boardId?{...b,frames:[...b.frames??[],frame]}:b)};
}
export function saveFrame(workspace:Workspace,boardId:string,frame:ExportFrame,expected:ExportFrame):Workspace{
 if(!validFrame(frame))throw Error('Use a name and valid frame bounds (80–10,000 px).');
 const board=workspace.boards.find(b=>b.id===boardId),current=board?.frames?.find(f=>f.id===frame.id);if(!current||!same(current,expected))throw Error('This frame changed remotely. Reload its settings before saving.');
 return {...workspace,boards:workspace.boards.map(b=>b.id===boardId?{...b,frames:b.frames!.map(f=>f.id===frame.id?structuredClone(frame):f)}:b)};
}
export function deleteFrame(workspace:Workspace,boardId:string,id:string):Workspace{return {...workspace,boards:workspace.boards.map(b=>{if(b.id!==boardId||!b.frames)return b;const frames=b.frames.filter(f=>f.id!==id),next={...b};if(frames.length)next.frames=frames;else delete next.frames;return next;})};}
export function moveFrame(workspace:Workspace,boardId:string,id:string,step:-1|1):Workspace{return {...workspace,boards:workspace.boards.map(b=>{if(b.id!==boardId||!b.frames)return b;const index=b.frames.findIndex(f=>f.id===id),to=index+step;if(index<0||to<0||to>=b.frames.length)return b;const frames=[...b.frames];[frames[index],frames[to]]=[frames[to],frames[index]];return {...b,frames};})};}
