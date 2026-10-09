import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {validWorkspace,type Workspace,type Kind,type Card,type Board} from '../model';
import {usePersistence} from '../usePersistence';
import {type LiveView} from '../liveRepository';
import {applyChanges,diffWorkspace,type Change} from '../operations';
import {WorkspaceControls} from './WorkspaceControls';
import {Members} from '../team';
import {TeamRepository,uploadAsset,type WorkspaceRepository} from '../repository';
import {cardWidth,cardHeight,moveSelection,deleteSelection,putInColumn,duplicateCards,canvasExtent,screenDelta,resizeCard,mediaFooterHeight} from './canvas/domain';
import {RichNote} from './content/RichNote';
import {MediaCard,VideoLink} from './content/MediaCard';

type Drag={id:string;ids:string[];x:number;y:number;before:Workspace};
type Resize={id:string;x:number;y:number;width:number;height:number;before:Workspace};
type Area={x:number;y:number;endX:number;endY:number;before:string[]};
const clipboardPrefix='BOARDROOM-CARDS:';
const editing=(target:EventTarget|null)=>target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));

export function Editor({repository,initial,exit,open}:{open:(repository:WorkspaceRepository,state:Workspace)=>void;repository:WorkspaceRepository;initial:Workspace;exit:()=>void}){
 const [state,setState]=useState<Workspace>(initial),stateRef=useRef(state);
 const [live,setLive]=useState<LiveView|null>(null);
 const writable=!(repository instanceof TeamRepository)||((live?.role??repository.role)!=='viewer'&&!live?.blocked);
 const local=usePersistence(state,repository,writable);
 const status=repository instanceof TeamRepository?(live?.status??'Connecting...'):local.status;
 const dirty=repository instanceof TeamRepository?(live?.dirty??false):local.dirty;
 const [boardId,setBoardId]=useState(initial.boards[0].id),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(1),[query,setQuery]=useState('');
 const [connection,setConnection]=useState<string|null>(null),[uploading,setUploading]=useState(false),[notice,setNotice]=useState(''),[area,setArea]=useState<Area|null>(null);
 const leaveBlocked=useRef(false);leaveBlocked.current=dirty||uploading;
 const past=useRef<Change[][]>([]),future=useRef<Change[][]>([]),drag=useRef<Drag|null>(null),resize=useRef<Resize|null>(null),viewport=useRef<HTMLDivElement>(null);
 const pendingCaptionFocus=useRef<string|null>(null);
 const mediaAspects=useRef(new Map<string,number>());
 const space=useRef(false),pan=useRef<{x:number;y:number;left:number;top:number}|null>(null),marquee=useRef<Area|null>(null);
 const importInput=useRef<HTMLInputElement>(null);
 const uploadInput=useRef<HTMLInputElement>(null),fileAccept=useRef('*');
 const board=state.boards.find(b=>b.id===boardId)||state.boards[0],extent=canvasExtent(board);
 const teamId=repository instanceof TeamRepository?repository.id:undefined;
 useEffect(()=>{if(!(repository instanceof TeamRepository))return;return repository.start(view=>{stateRef.current=view.snapshot;setState(view.snapshot);setLive(view);});},[repository]);
 useEffect(()=>{if(!(repository instanceof TeamRepository)||!dirty&&!uploading)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[repository,dirty,uploading]);
 useEffect(()=>{if(repository instanceof TeamRepository)repository.presence(board.id);},[repository,board.id]);
 useEffect(()=>{setSelected([]);setConnection(null);setQuery('');if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}},[board.id]);
 const apply=(next:Workspace)=>{if(!writable)return;if(repository instanceof TeamRepository)repository.change(stateRef.current,next);else {stateRef.current=next;setState(next);}};
 const update=(next:Workspace)=>{if(!writable)return;const inverse=diffWorkspace(next,stateRef.current);if(!inverse.length)return;past.current.push(inverse);future.current=[];apply(next);};
 function changeCard(id:string,patch:Partial<Card>){update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(c=>c.id===id?{...c,...patch}:c)})});}
 function location(){const view=viewport.current;return {x:Math.min(100000,Math.max(60,(view?.scrollLeft??0)/zoom+60+(board.cards.length%3)*300)),y:Math.min(100000,Math.max(70,(view?.scrollTop??0)/zoom+70+Math.floor(board.cards.length/3)*280))};}
 function add(kind:Kind,text?:string){
  if(!writable)return;const id=crypto.randomUUID(),target=kind==='board'?crypto.randomUUID():undefined;
  const card:Card={id,kind,text:text??(kind==='board'?'Untitled board':kind==='column'?'New column':kind==='checklist'?'First task\nSecond task':kind==='link'?'https://example.com':'Write your idea…'),color:'#fff',...location()};
  if(target)card.target=target;if(kind==='column'){card.width=320;card.height=520;card.color='#ebeee8';}
  const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,card]})};
  if(target)next.boards.push({id:target,parent:board.id,title:card.text,cards:[]});update(next);setSelected([id]);
 }
 function history(direction:'undo'|'redo'){
  if(!writable)return;const from=direction==='undo'?past:future,to=direction==='undo'?future:past,changes=from.current.pop();
  if(changes){try{const next=applyChanges(stateRef.current,changes);to.current.push(diffWorkspace(next,stateRef.current));apply(next);setSelected([]);}catch{from.current.push(changes);setNotice('This field changed remotely. Undo would overwrite another edit.');}}
 }
 function remove(){if(connection){update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:(b.connectors??[]).filter(line=>line.id!==connection)})});setConnection(null);return;}update(deleteSelection(stateRef.current,board.id,selected));setSelected([]);}
 function choose(id:string,shift=false){setConnection(null);setSelected(current=>shift?(current.includes(id)?current.filter(value=>value!==id):[...current,id]):current.includes(id)?current:[id]);}
 function expandedIds(ids=selected){return [...new Set([...ids,...board.cards.filter(c=>c.columnId&&ids.includes(c.columnId)).map(c=>c.id)])];}
 function duplicate(){const result=duplicateCards(board,expandedIds());update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,...result.cards],connectors:[...(b.connectors??[]),...result.connectors]})});setSelected(result.cards.map(c=>c.id));if(selected.some(id=>board.cards.find(c=>c.id===id)?.kind==='board'))setNotice('Nested board tiles are not duplicated.');}
 function connectCards(){if(selected.length!==2)return;update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:[...(b.connectors??[]),{id:crypto.randomUUID(),from:selected[0],to:selected[1],color:'#789180'}]})});}
 function exportBoard(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='boardroom-backup.json';a.click();URL.revokeObjectURL(a.href);}
 async function files(files:File[],point=location()){
  if(!files.length)return;if(!teamId){setNotice('Open a team workspace to upload private images, videos, or files.');return;}if(!writable||uploading)return;
  const destination=board.id;setUploading(true);setNotice('');
  try{for(const [index,file] of files.entries()){
   if(file.size>50*1024*1024)throw Error('Files and videos are limited to 50 MB; images to 10 MB.');
   const asset=await uploadAsset(teamId,file),id=crypto.randomUUID();
   if(!stateRef.current.boards.some(b=>b.id===destination))throw Error('Destination board was removed. The upload remains in private storage.');
   update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==destination?b:{...b,cards:[...b.cards,{id,kind:asset.kind,assetId:asset.id,text:asset.kind==='file'?asset.name:'',...(asset.kind==='file'?{}:{captionVisible:false}),color:'#fff',x:Math.min(100000,point.x+index*40),y:Math.min(100000,point.y+index*40),width:320,height:asset.kind==='file'?180:300}]})});setSelected([id]);
  }}catch(e){setNotice(e instanceof Error?e.message:'Upload failed');}finally{setUploading(false);}
 }
 function pickFiles(accept:string){fileAccept.current=accept;if(uploadInput.current){uploadInput.current.accept=accept;uploadInput.current.click();}}
 function contentPoint(x:number,y:number){const view=viewport.current,rect=view?.getBoundingClientRect();return {x:(x-(rect?.left??0)+(view?.scrollLeft??0))/zoom,y:(y-(rect?.top??0)+(view?.scrollTop??0))/zoom};}
 function startDrag(e:ReactPointerEvent<HTMLDivElement>,card:Card){
  if(!writable||e.button!==0||space.current)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
  const ids=selected.includes(card.id)?selected:[card.id];setSelected(ids);drag.current={id:card.id,ids:expandedIds(ids),x:e.clientX,y:e.clientY,before:stateRef.current};
 }
 function finishGesture(cancel=false){
  const gesture=drag.current??resize.current;if(!gesture)return;
  const fields=drag.current?['x','y']:['width','height'],ids=drag.current?.ids??[gesture.id];
  const inverse=diffWorkspace(stateRef.current,gesture.before).filter(change=>change.cardId&&ids.includes(change.cardId)&&fields.includes(change.field));
  if(cancel){try{apply(applyChanges(stateRef.current,inverse));}catch{setNotice('A remote change prevented canceling this gesture.');}}
  else if(inverse.length){past.current.push(inverse);future.current=[];}
  drag.current=null;resize.current=null;
 }
 useEffect(()=>{
  function key(e:KeyboardEvent){
   const modifier=e.metaKey||e.ctrlKey;
   if(modifier&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
   if(modifier&&e.key.toLowerCase()==='y'){e.preventDefault();history('redo');return;}
   if(e.key==='Escape'){setSelected([]);setConnection(null);setNotice('');(document.activeElement as HTMLElement|null)?.blur();return;}
   if(editing(e.target))return;
   if(e.code==='Space'){space.current=true;e.preventDefault();}
   if(modifier&&e.key.toLowerCase()==='a'){e.preventDefault();setSelected(board.cards.map(c=>c.id));}
   if(modifier&&e.key.toLowerCase()==='d'){e.preventDefault();if(writable)duplicate();}
   if(['Delete','Backspace'].includes(e.key)&&(selected.length||connection)){e.preventDefault();if(writable)remove();}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.length&&writable){e.preventDefault();const step=e.shiftKey?10:1;update(moveSelection(stateRef.current,board.id,selected,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));}
   if(modifier&&['+','=','-','0'].includes(e.key)){e.preventDefault();setZoom(z=>e.key==='0'?1:Math.max(.25,Math.min(2,z+(e.key==='-'?-.1:.1))));}
  }
  function up(e:KeyboardEvent){if(e.code==='Space')space.current=false;}
  function copy(e:ClipboardEvent){if(editing(e.target)||!selected.length)return;const ids=expandedIds();const payload={version:1,workspaceId:teamId,cards:board.cards.filter(c=>ids.includes(c.id)&&c.kind!=='board'),connectors:(board.connectors??[]).filter(line=>ids.includes(line.from)&&ids.includes(line.to))};e.preventDefault();e.clipboardData?.setData('text/plain',clipboardPrefix+JSON.stringify(payload));if(e.type==='cut'&&writable)remove();}
  function paste(e:ClipboardEvent){
   if(e.clipboardData?.files.length){e.preventDefault();void files([...e.clipboardData.files]);return;}if(editing(e.target)||!writable)return;
   const text=e.clipboardData?.getData('text/plain')??'';if(!text)return;
   if(!text.startsWith(clipboardPrefix)){e.preventDefault();add(/^https?:\/\//.test(text)?'link':'note',text);return;}
   e.preventDefault();try{const payload=JSON.parse(text.slice(clipboardPrefix.length));const copied:Board={id:'clipboard',title:'Clipboard',cards:payload.cards,connectors:payload.connectors};
    if(!validWorkspace({version:1,boards:[copied]}))throw Error('Clipboard does not contain valid cards');
    if(copied.cards.some(c=>c.assetId)&&payload.workspaceId!==teamId)throw Error('Private media can only be pasted within its source workspace. Download and upload it to move it.');
    const result=duplicateCards(copied,copied.cards.map(c=>c.id));update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,...result.cards],connectors:[...(b.connectors??[]),...result.connectors]})});setSelected(result.cards.map(c=>c.id));
   }catch(e){setNotice(e instanceof Error?e.message:'Invalid clipboard');}
  }
  window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('copy',copy);window.addEventListener('cut',copy);window.addEventListener('paste',paste);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('copy',copy);window.removeEventListener('cut',copy);window.removeEventListener('paste',paste);};
 });
 const rectangle=area?{left:Math.min(area.x,area.endX)*zoom,top:Math.min(area.y,area.endY)*zoom,width:Math.abs(area.endX-area.x)*zoom,height:Math.abs(area.endY-area.y)*zoom}:undefined;
 return <div className="app"><header onKeyDown={e=>{if(e.key==='Escape'&&e.target instanceof HTMLElement){const details=e.target.closest('details');if(details){e.preventDefault();e.stopPropagation();details.open=false;details.querySelector('summary')?.focus();}}}}>
  <span className="brand" aria-label="Boardroom"><span aria-hidden="true">▦</span><span>boardroom</span></span>
  <WorkspaceControls repository={repository} canLeave={()=>{if(leaveBlocked.current){setNotice('Wait for saving to finish, or export your edits before switching workspaces.');return false;}return true;}} open={open} exit={exit} onError={setNotice}/>
  <span className="save" role="status" title={status}>{uploading?'Uploading...':status}</span>
  {teamId&&<span className="presence" title={live?.members.map(m=>m.email).join(', ')}>{new Set(live?.members.map(m=>m.userId)).size} online</span>}
  {repository instanceof TeamRepository&&(live?.role??repository.role)==='owner'&&<Members repository={repository}/>}
  <details className="board-actions header-popover"><summary aria-label="Board actions">Actions</summary><div className="popover-content"><button onClick={exportBoard}>Export</button>
  <div className="import"><button disabled={!writable} onClick={()=>importInput.current?.click()}>Import</button><input ref={importInput} aria-label="Import backup" type="file" disabled={!writable} accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(file){try{const value:unknown=JSON.parse(await file.text());if(!validWorkspace(value))throw Error('Invalid backup');update(value);setBoardId(value.boards[0].id);setSelected([]);}catch(e){setNotice(e instanceof Error?e.message:'Invalid backup');}}e.target.value='';}}/></div>
  <details className="shortcuts"><summary>?</summary><div><strong>Canvas shortcuts</strong><p>Shift-click or drag empty space: select cards<br/>Space-drag or middle drag: pan<br/>Arrows / Shift-arrows: move 1 / 10 px<br/>Ctrl/⌘ A: select all · D: duplicate<br/>Ctrl/⌘ C/X/V: copy, cut, paste<br/>Ctrl/⌘ Z / Shift-Z: undo / redo<br/>Delete: remove · Escape: clear selection<br/>Ctrl/⌘ +/−/0: zoom</p></div></details>
 </div></details></header>
 <aside><div className="tools">{([['note','▤','Note'],['link','↗','Link'],['checklist','☑','To-do'],['board','▦','Board'],['column','▥','Column']] as [Kind,string,string][]).map(([kind,icon,label])=><button key={kind} aria-label={label} disabled={!writable} onClick={()=>add(kind)}><span aria-hidden="true">{icon}</span>{label}</button>)}
  {([['Image','▧','image/png,image/jpeg,image/webp,image/gif'],['Video','▷','video/mp4,video/webm'],['File','⇧','.pdf,.zip,.txt']] as const).map(([label,icon,accept])=><button key={label} aria-label={'Upload '+label.toLowerCase()} disabled={!writable||!teamId||uploading} title={!teamId?'Uploads require a team workspace':undefined} onClick={()=>pickFiles(accept)}><span aria-hidden="true">{icon}</span>{label}</button>)}
 </div><div className="aside-bottom"><button disabled={!writable} onClick={()=>history('undo')}>↶<small>Undo</small></button><button disabled={!writable} onClick={()=>history('redo')}>↷<small>Redo</small></button></div></aside>
 <input ref={uploadInput} className="upload-input" type="file" multiple aria-label="Upload media files" onChange={e=>{void files([...e.target.files??[]]);e.target.value='';}}/>
 <main><div className="board-heading"><div className="board-identity"><nav className="breadcrumbs" aria-label="Board breadcrumbs">{(()=>{const chain:Board[]=[];let current:Board|undefined=board;const seen=new Set<string>();while(current&&!seen.has(current.id)){chain.unshift(current);seen.add(current.id);current=state.boards.find(b=>b.id===current?.parent);}return chain.map((ancestor,index)=><span key={ancestor.id}>{index>0&&<span className="crumb-separator" aria-hidden="true">/</span>}{ancestor.id===board.id?<span aria-current="page">{ancestor.title}</span>:<button onClick={()=>setBoardId(ancestor.id)}>{ancestor.title}</button>}</span>);})()}</nav><h1 aria-label={board.title}><input aria-label="Board title" readOnly={!writable} value={board.title} onChange={e=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id===board.id?{...b,title:e.target.value}:b)})}/></h1><span className="workspace-mode">{teamId?`${live?.role??(repository as TeamRepository).role} access`:'Browser-local | No team sync'}</span></div><input className="search" placeholder="Find on this board…" aria-label="Search cards" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {notice&&<div className="notice" role="alert">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div>}
  <div className="viewport" ref={viewport} role="region" aria-label="Board canvas" tabIndex={0}
   onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();void files([...e.dataTransfer.files],contentPoint(e.clientX,e.clientY));}}
   onPointerDown={e=>{if(e.button===1||space.current){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pan.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};return;}if(!(e.target instanceof HTMLElement)||!['viewport','canvas','plane'].some(name=>(e.target as HTMLElement).classList.contains(name)))return;const point=contentPoint(e.clientX,e.clientY);const next={...point,endX:point.x,endY:point.y,before:e.shiftKey?selected:[]};marquee.current=next;setArea(next);setSelected(next.before);setConnection(null);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(pan.current){e.currentTarget.scrollLeft=pan.current.left-(e.clientX-pan.current.x);e.currentTarget.scrollTop=pan.current.top-(e.clientY-pan.current.y);}else if(marquee.current){const point=contentPoint(e.clientX,e.clientY),next={...marquee.current,endX:point.x,endY:point.y};setArea(next);const left=Math.min(next.x,next.endX),right=Math.max(next.x,next.endX),top=Math.min(next.y,next.endY),bottom=Math.max(next.y,next.endY);if(right-left>3||bottom-top>3){const ids=board.cards.filter(c=>c.kind==='column'?c.x>=left&&c.x+cardWidth(c)<=right&&c.y>=top&&c.y+cardHeight(c)<=bottom:c.x<right&&c.x+cardWidth(c)>left&&c.y<bottom&&c.y+cardHeight(c)>top).map(c=>c.id);setSelected([...new Set([...next.before,...ids])]);}}}}
   onPointerUp={()=>{pan.current=null;marquee.current=null;setArea(null);}} onPointerCancel={()=>{pan.current=null;marquee.current=null;setArea(null);}}
  ><div className="canvas" style={{width:extent.width*zoom,height:extent.height*zoom}}><div className="plane" style={{width:extent.width,height:extent.height,transform:`scale(${zoom})`}}>
   <svg className="connectors" width={extent.width} height={extent.height} aria-label="Card connections"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#789180"/></marker></defs>{(board.connectors??[]).map(line=>{const from=board.cards.find(c=>c.id===line.from),to=board.cards.find(c=>c.id===line.to);if(!from||!to)return null;const x=from.x+cardWidth(from)/2,y=from.y+cardHeight(from)/2,tx=to.x+cardWidth(to)/2,ty=to.y+cardHeight(to)/2;return <path key={line.id} className={connection===line.id?'connection selected-line':'connection'} d={`M ${x} ${y} C ${x+(tx-x)/2} ${y},${x+(tx-x)/2} ${ty},${tx} ${ty}`} stroke={line.color} markerEnd="url(#arrow)" tabIndex={0} role="button" aria-label={`Connection from ${from.text.slice(0,30)} to ${to.text.slice(0,30)}`} onClick={()=>{setConnection(line.id);setSelected([]);}} onKeyDown={e=>{if(e.key==='Enter'){setConnection(line.id);setSelected([]);}}}/>;})}</svg>
   {board.cards.filter(c=>c.kind==='column'||c.text.toLowerCase().includes(query.toLowerCase())).map(c=><article key={c.id} data-card-id={c.id} className={'card '+c.kind+(selected.includes(c.id)?' selected':'')} style={{left:c.x,top:c.y,background:['image','video'].includes(c.kind)?'transparent':c.color,width:cardWidth(c),height:c.height??(['image','video','file','column'].includes(c.kind)?cardHeight(c):undefined)}} role="group" aria-label={`${c.kind} card: ${c.text.slice(0,60)}`} tabIndex={0} onClick={e=>choose(c.id,e.shiftKey)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();choose(c.id,e.shiftKey);}}}>
    <div className="handle" title="Drag card" onPointerDown={e=>startDrag(e,c)} onPointerMove={e=>{const moving=drag.current;if(moving?.id===c.id){const delta=screenDelta(e.clientX-moving.x,e.clientY-moving.y,zoom);apply(moveSelection(stateRef.current,board.id,moving.ids,delta.x,delta.y));moving.x=e.clientX;moving.y=e.clientY;}}} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)}>⠿</div>
    {c.kind==='board'?<button className="board-tile" onDoubleClick={()=>{if(state.boards.some(b=>b.id===c.target))setBoardId(c.target!);}}><div className="folder">▦</div><strong>{state.boards.find(b=>b.id===c.target)?.title||c.text}</strong><small>Double-click to open</small></button>
    :c.kind==='column'?<input className="column-title" aria-label="Column title" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/>
    :['image','video','file'].includes(c.kind)?<><MediaCard card={c} workspaceId={teamId} dragHandlers={['image','video'].includes(c.kind)?{onPointerDown:e=>{if(c.kind==='video'){const video=e.currentTarget.querySelector('video'),rect=video?.getBoundingClientRect();if(rect&&e.clientY>rect.bottom-40*zoom)return;}startDrag(e,c);},onPointerMove:e=>{const moving=drag.current;if(moving?.id===c.id){const delta=screenDelta(e.clientX-moving.x,e.clientY-moving.y,zoom);apply(moveSelection(stateRef.current,board.id,moving.ids,delta.x,delta.y));moving.x=e.clientX;moving.y=e.clientY;}},onPointerUp:()=>finishGesture(),onPointerCancel:()=>finishGesture(true)}:undefined} editable={writable} toggleCaption={()=>{const visible=c.captionVisible===false;if(visible)pendingCaptionFocus.current=c.id;changeCard(c.id,{captionVisible:visible,height:Math.min(10000,Math.max(100,cardHeight(c)+(visible?28:-28)))});}} onAspect={ratio=>{if(Number.isFinite(ratio)&&ratio>0)mediaAspects.current.set(c.id,ratio);}}/>{(c.kind==='file'||c.captionVisible!==false)&&<input className="media-caption" placeholder={c.kind==='file'?undefined:'Write a subtitle...'} ref={input=>{if(input&&pendingCaptionFocus.current===c.id){pendingCaptionFocus.current=null;input.focus();input.setSelectionRange(input.value.length,input.value.length);}}} aria-label="Media caption" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/>}</>
    :c.kind==='note'?<RichNote text={c.text} document={c.richText} editable={writable} change={(text,richText)=>changeCard(c.id,{text,richText})}/>
    :c.kind==='checklist'?<div className="checklist"><strong>TO DO</strong>{c.text.split('\n').map((line,i)=><label key={i}><input type="checkbox" disabled={!writable} checked={line.startsWith('[x] ')} onChange={()=>changeCard(c.id,{text:c.text.split('\n').map((l,j)=>j===i?(l.startsWith('[x] ')?l.slice(4):'[x] '+l):l).join('\n')})}/><span className={line.startsWith('[x] ')?'done':''}>{line.replace(/^\[x\] /,'')}</span></label>)}<textarea readOnly={!writable} aria-label="Edit task list, one task per line" value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/></div>
    :<><textarea readOnly={!writable} aria-label="Link address" value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/>{/^https?:\/\//.test(c.text)&&<a href={c.text} target="_blank" rel="noreferrer">Open reference ↗</a>}<VideoLink url={c.text}/></>}
    {writable&&selected.includes(c.id)&&<div className="resize-handle" style={['image','video'].includes(c.kind)?{bottom:mediaFooterHeight(c)}:undefined} role="slider" tabIndex={0} aria-label={`Resize ${c.kind} card`} aria-valuemin={160} aria-valuemax={4000} aria-valuenow={cardWidth(c)} title={['image','video'].includes(c.kind)?'Drag or use arrows to resize proportionally':'Drag to resize; arrows change width, Shift-arrows change height'} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.key==='ArrowLeft'||e.key==='ArrowDown'?-10:10;changeCard(c.id,resizeCard(c,cardWidth(c)+(e.shiftKey&&!['image','video'].includes(c.kind)?0:step),cardHeight(c)+(e.shiftKey?step:0),mediaAspects.current.get(c.id)));}}
     onPointerDown={e=>{e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);resize.current={id:c.id,x:e.clientX,y:e.clientY,width:cardWidth(c),height:cardHeight(c),before:stateRef.current};}}
     onPointerMove={e=>{const gesture=resize.current;if(gesture?.id===c.id){const delta=screenDelta(e.clientX-gesture.x,e.clientY-gesture.y,zoom);apply({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(card=>card.id!==c.id?card:{...card,...resizeCard(card,gesture.width+delta.x,gesture.height+delta.y,mediaAspects.current.get(card.id))})})});}}} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)}/>
    }
   </article>)}
  </div>{rectangle&&<div className="marquee" style={rectangle}/>}</div>{board.cards.length===0&&<div className="empty">A fresh board.<br/><small>Add a note or drop an image to start.</small></div>}</div>
  <div className="zoom"><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><button onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2,z+.1))}>+</button></div>
  {(selected.length>0||connection)&&writable&&<div className="selection">{connection?<button onClick={remove}>Delete connection</button>:<><span>{selected.length} selected</span>{['#fff','#fff4c9','#e3efe9','#e7e8f7','#f7dfdc'].map(color=><button className="swatch" key={color} aria-label={'Set color '+color} style={{background:color}} onClick={()=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(c=>selected.includes(c.id)?{...c,color}:c)})})}/>)}<button onClick={duplicate}>Duplicate</button>{selected.length===2&&<button onClick={connectCards}>Connect cards</button>}{board.cards.some(c=>c.kind==='column')&&<select aria-label="Move selection to column" value="" onChange={e=>{update(putInColumn(stateRef.current,board.id,selected,e.target.value));}}><option value="">Move to column…</option>{board.cards.filter(c=>c.kind==='column').map(c=><option key={c.id} value={c.id}>{c.text}</option>)}</select>}<button onClick={remove}>Delete {selected.length===1?'card':'cards'}</button></>}</div>}
  <footer>{teamId?`${live?.role??(repository as TeamRepository).role} | Live team workspace | ${new Set(live?.members.map(m=>m.userId)).size} online`:'Browser-local canvas | No team sync'} · Space-drag to pan · Shift-click to select</footer>
 </main></div>;
}
