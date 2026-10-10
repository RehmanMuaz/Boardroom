import {boardCanvasStyle} from '../boardAppearance';
import {BoardAppearance} from './BoardAppearance';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {validWorkspace,type Workspace,type Kind,type Card,type Board} from '../model';
import {usePersistence} from '../usePersistence';
import {type LiveView} from '../liveRepository';
import {applyChanges,diffWorkspace,same,type Change} from '../operations';
import {type Annotation,type ShapeKind} from '../annotations';
import {AnnotationLayer} from './annotations/AnnotationLayer';
import {AnnotationToolbar,type AnnotationTool} from './annotations/AnnotationToolbar';
import './annotations/annotations.css';
import './canvas/organization.css';
import './canvas/object-sidebar.css';
import {WorkspaceControls} from './WorkspaceControls';
import {Members} from '../team';
import {TeamRepository,uploadAsset,type WorkspaceRepository} from '../repository';
import {cardWidth,cardHeight,moveSelection,deleteSelection,duplicateCards,canvasExtent,screenDelta,mediaFooterHeight} from './canvas/domain';
import {RichNote} from './content/RichNote';
import {MediaCard,VideoLink} from './content/MediaCard';
import {Checklist} from './content/Checklist';
import {NoteLabels} from './content/NoteLabels';
import {UrlIcon} from './content/UrlIcon';
import {ConnectorLayer} from './canvas/ConnectorLayer';
import {LayerControls} from './canvas/LayerControls';
import {cardLayer,columnAt,columnSummary,dropIntoColumn,resizeInColumns,reorderLayers,layoutColumns} from './canvas/organization';

type Drag={id:string;ids:string[];x:number;y:number;startX:number;startY:number;moved:boolean;point?:{x:number;y:number};inverse:Change[]};
type Resize={id:string;x:number;y:number;width:number;height:number;inverse:Change[]};
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
 const [connectorTool,setConnectorTool]=useState(false),[connectorSource,setConnectorSource]=useState<string|null>(null),[dropTarget,setDropTarget]=useState<string|null>(null);
 const [annotationShape,setAnnotationShape]=useState<ShapeKind>('arrow');
 const [annotationTool,setAnnotationTool]=useState<AnnotationTool>('select'),[selectedAnnotation,setSelectedAnnotation]=useState<string|null>(null),[annotationColor,setAnnotationColor]=useState('#d95d39'),[annotationThickness,setAnnotationThickness]=useState(3),[annotationFocus,setAnnotationFocus]=useState<string|null>(null);
 const leaveBlocked=useRef(false);leaveBlocked.current=dirty||uploading;
 const past=useRef<Change[][]>([]),future=useRef<Change[][]>([]),drag=useRef<Drag|null>(null),resize=useRef<Resize|null>(null),viewport=useRef<HTMLDivElement>(null);
 const pendingCaptionFocus=useRef<string|null>(null);
 const [editingCard,setEditingCard]=useState<string|null>(null),[toolsTarget,setToolsTarget]=useState<HTMLDivElement|null>(null);
 const surfaceClick=useRef(false);
 const activeCard=selected.length===1?boardCard():undefined;
 function boardCard(){return state.boards.find(b=>b.id===boardId)?.cards.find(c=>c.id===selected[0]);}
 function backToTools(){setSelected([]);setSelectedAnnotation(null);setConnection(null);setEditingCard(null);setAnnotationTool('select');(document.activeElement as HTMLElement|null)?.blur();}
 function editContent(id:string){if(!writable)return;setEditingCard(id);requestAnimationFrame(()=>{const article=document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);const field=article?.querySelector<HTMLElement>('textarea,input:not([type=checkbox]),[contenteditable=true]');field?.focus();});}
 const mediaAspects=useRef(new Map<string,number>());
 const space=useRef(false),pan=useRef<{x:number;y:number;left:number;top:number}|null>(null),marquee=useRef<Area|null>(null);
 const importInput=useRef<HTMLInputElement>(null);
 const uploadInput=useRef<HTMLInputElement>(null),fileAccept=useRef('*');
 const board=state.boards.find(b=>b.id===boardId)||state.boards[0],extent=canvasExtent(board);
 const teamId=repository instanceof TeamRepository?repository.id:undefined;
 useEffect(()=>{if(selected.length||connection)setSelectedAnnotation(null);},[selected,connection]);
 useEffect(()=>{if(!(repository instanceof TeamRepository))return;return repository.start(view=>{stateRef.current=view.snapshot;setState(view.snapshot);setLive(view);});},[repository]);
 useEffect(()=>{if(!(repository instanceof TeamRepository)||!dirty&&!uploading)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[repository,dirty,uploading]);
 useEffect(()=>{if(repository instanceof TeamRepository)repository.presence(board.id);},[repository,board.id]);
 useEffect(()=>{setSelected([]);setConnection(null);setQuery('');setSelectedAnnotation(null);setAnnotationFocus(null);setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}},[board.id]);
 useEffect(()=>{if(!writable){setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);}},[writable]);
 const apply=(next:Workspace)=>{if(!writable)return;if(repository instanceof TeamRepository)repository.change(stateRef.current,next);else {stateRef.current=next;setState(next);}};
 const update=(next:Workspace)=>{if(!writable)return;if(!validWorkspace(next)){setNotice('This change exceeds supported card, label or column limits.');return;}const inverse=diffWorkspace(next,stateRef.current);if(!inverse.length)return;past.current.push(inverse);future.current=[];apply(next);};
 function changeCard(id:string,patch:Partial<Card>){update({...stateRef.current,boards:stateRef.current.boards.map(b=>{
  if(b.id!==board.id)return b;const card=b.cards.find(c=>c.id===id);const next={...b,cards:b.cards.map(c=>c.id===id?{...c,...patch}:c)};
  return card&&(patch.width!==undefined||patch.height!==undefined)?layoutColumns(next,card.kind==='column'?[id]:card.columnId?[card.columnId]:[],mediaAspects.current):next;
 })});}
 function changeAnnotation(id:string,patch:Partial<Annotation>,expected?:Partial<Annotation>){
  const current=stateRef.current.boards.find(b=>b.id===board.id)?.annotations?.find(a=>a.id===id);if(!current||!writable)return;
  if(expected&&Object.entries(expected).some(([key,value])=>!same((current as unknown as Record<string,unknown>)[key],value))){setNotice('This annotation changed remotely. Try the move or resize again.');return;}
  const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,annotations:(b.annotations??[]).map(a=>a.id===id?{...a,...patch} as Annotation:a)})};
  if(!validWorkspace(next)){setNotice('Annotation exceeds the supported size or formatting limits.');return;}update(next);
 }
 function addAnnotation(annotation:Annotation){
  if(!writable)return;const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,annotations:[...(b.annotations??[]),annotation]})};
  if(!validWorkspace(next)){setNotice('Annotation limit reached. Strokes allow up to 4,096 points and a 10,000-unit span.');return;}update(next);setSelected([]);setConnection(null);setSelectedAnnotation(annotation.id);
  setAnnotationTool('select');if(annotation.kind==='text')setAnnotationFocus(annotation.id);
 }
 function selectAnnotation(id:string){setSelectedAnnotation(id);setSelected([]);setConnection(null);}
 function location(){const view=viewport.current;return {x:Math.min(100000,Math.max(60,(view?.scrollLeft??0)/zoom+60+(board.cards.length%3)*300)),y:Math.min(100000,Math.max(70,(view?.scrollTop??0)/zoom+70+Math.floor(board.cards.length/3)*280))};}
 function add(kind:Kind,text?:string){
  if(!writable)return;setConnectorTool(false);setConnectorSource(null);const id=crypto.randomUUID(),target=kind==='board'?crypto.randomUUID():undefined;
  const card:Card={id,kind,text:text??(kind==='board'?'Untitled board':kind==='column'?'New column':kind==='checklist'?'First task\nSecond task':kind==='link'?'https://example.com':'Write your idea…'),color:'#fff',...location()};
  if(target)card.target=target;if(kind==='checklist')card.title='Untitled list';if(kind==='column'){card.width=320;card.height=520;card.color='#ebeee8';}
  const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,card]})};
  if(target)next.boards.push({id:target,parent:board.id,title:card.text,cards:[]});update(next);setSelected([id]);
 }
 function history(direction:'undo'|'redo'){
  if(!writable)return;const from=direction==='undo'?past:future,to=direction==='undo'?future:past,changes=from.current.pop();
  if(changes){try{const next=applyChanges(stateRef.current,changes);to.current.push(diffWorkspace(next,stateRef.current));apply(next);setSelected([]);setSelectedAnnotation(null);}catch{from.current.push(changes);setNotice('This field changed remotely. Undo would overwrite another edit.');}}
 }
 function remove(){if(selectedAnnotation){update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,annotations:(b.annotations??[]).filter(a=>a.id!==selectedAnnotation)})});setSelectedAnnotation(null);return;}if(connection){update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:(b.connectors??[]).filter(line=>line.id!==connection)})});setConnection(null);return;}const removed=deleteSelection(stateRef.current,board.id,selected);update({...removed,boards:removed.boards.map(b=>b.id===board.id?layoutColumns(b,board.cards.filter(c=>selected.includes(c.id)&&c.columnId).map(c=>c.columnId!),mediaAspects.current):b)});setSelected([]);}
 function choose(id:string,shift=false){
  setSelectedAnnotation(null);setConnection(null);
  if(connectorTool&&writable){
   if(!connectorSource){setConnectorSource(id);setSelected([id]);return;}
   if(connectorSource===id)return;
   update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:[...(b.connectors??[]),{id:crypto.randomUUID(),from:connectorSource,to:id,color:'#789180'}]})});
   setConnectorSource(null);setConnectorTool(false);setSelected([]);return;
  }
  setSelected(current=>shift?(current.includes(id)?current.filter(value=>value!==id):[...current,id]):current.includes(id)?current:[id]);
 }
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
 function startDrag(e:ReactPointerEvent<HTMLElement>,card:Card){
  if(!writable||connectorTool||annotationTool!=='select'||e.button!==0||space.current||e.shiftKey)return;
  const target=e.target as HTMLElement;if(!e.currentTarget.contains(target))return;
  if(target.closest('.resize-handle,input[type=checkbox],a,.embed-play,iframe')||(editingCard===card.id&&target.closest('input,textarea,[contenteditable=true]')))return;
  const video=target.closest('video');if(video&&e.clientY>video.getBoundingClientRect().bottom-40*zoom)return;
  e.preventDefault();e.stopPropagation();setEditingCard(null);surfaceClick.current=false;
  const ids=selected.includes(card.id)?selected:[card.id];setSelected(ids);drag.current={id:card.id,ids:expandedIds(ids),x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,inverse:[]};
 }
 function previewGesture(next:Workspace){
  const gesture=drag.current??resize.current;if(!gesture||!validWorkspace(next))return;
  const inverse=diffWorkspace(next,stateRef.current);
  for(const change of inverse){
   const prior=gesture.inverse.find(c=>c.boardId===change.boardId&&c.cardId===change.cardId&&c.annotationId===change.annotationId&&c.field===change.field);
   if(prior)prior.before=change.before;else gesture.inverse.push(change);
  }
  gesture.inverse=gesture.inverse.filter(c=>!same(c.before,c.after));apply(next);
 }
 function moveDrag(e:{clientX:number;clientY:number},id:string){
  const moving=drag.current;if(moving?.id!==id)return;
  if(Math.hypot(e.clientX-moving.startX,e.clientY-moving.startY)>3)moving.moved=true;
  if(!moving.moved)return;
  const delta=screenDelta(e.clientX-moving.x,e.clientY-moving.y,zoom);
  previewGesture(moveSelection(stateRef.current,board.id,moving.ids,delta.x,delta.y));moving.x=e.clientX;moving.y=e.clientY;moving.point=contentPoint(e.clientX,e.clientY);
  const current=stateRef.current.boards.find(b=>b.id===board.id)!;
  setDropTarget(current.cards.find(c=>c.id===moving.id)?.kind==='column'?null:columnAt(current,moving.point,moving.ids)?.id??null);
 }
 function finishGesture(cancel=false){
  const gesture=drag.current??resize.current;if(!gesture)return;if(drag.current?.moved)surfaceClick.current=true;
  if(!cancel&&drag.current?.moved&&drag.current.point){
   const current=stateRef.current.boards.find(b=>b.id===board.id)!;
   const target=columnAt(current,drag.current.point,drag.current.ids);
   previewGesture(dropIntoColumn(stateRef.current,board.id,drag.current.ids,target?.id,drag.current.point.y,mediaAspects.current));
  }
  if(cancel){try{apply(applyChanges(stateRef.current,gesture.inverse));}catch{setNotice('A remote change prevented canceling this gesture.');}}
  else if(gesture.inverse.length){past.current.push(gesture.inverse);future.current=[];}
  drag.current=null;resize.current=null;setDropTarget(null);
 }
 useEffect(()=>{
  const move=(e:PointerEvent)=>{if(drag.current)moveDrag(e,drag.current.id);};
  const up=()=>{if(drag.current)finishGesture();};
  const cancel=()=>{if(drag.current)finishGesture(true);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);};
 });
 useEffect(()=>{
  function key(e:KeyboardEvent){
   const modifier=e.metaKey||e.ctrlKey;
   if(modifier&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
   if(modifier&&e.key.toLowerCase()==='y'){e.preventDefault();history('redo');return;}
   if(e.key==='Escape'){setEditingCard(null);setSelected([]);setSelectedAnnotation(null);finishGesture(true);setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);setConnection(null);setNotice('');(document.activeElement as HTMLElement|null)?.blur();return;}
   if(editing(e.target))return;
   if(e.code==='Space'){space.current=true;e.preventDefault();}
   if(modifier&&e.key.toLowerCase()==='a'){e.preventDefault();setSelected(board.cards.map(c=>c.id));}
   if(modifier&&e.key.toLowerCase()==='d'){e.preventDefault();if(writable)duplicate();}
   if(['Delete','Backspace'].includes(e.key)&&(selected.length||connection||selectedAnnotation)){e.preventDefault();if(writable)remove();}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selectedAnnotation&&writable){e.preventDefault();const a=board.annotations?.find(a=>a.id===selectedAnnotation);if(a){const step=e.shiftKey?10:1;changeAnnotation(a.id,{x:Math.min(100000,Math.max(0,a.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0))),y:Math.min(100000,Math.max(0,a.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)))});}return;}
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
 return <div className={'app'+((selected.length||selectedAnnotation||connection)&&!connectorTool?' contextual-sidebar':'')}><header onKeyDown={e=>{if(e.key==='Escape'&&e.target instanceof HTMLElement){const details=e.target.closest('details');if(details){e.preventDefault();e.stopPropagation();details.open=false;details.querySelector('summary')?.focus();}}}}>
  <span className="brand" aria-label="Boardroom"><span aria-hidden="true">▦</span><span>boardroom</span></span>
  <WorkspaceControls repository={repository} canLeave={()=>{if(leaveBlocked.current){setNotice('Wait for saving to finish, or export your edits before switching workspaces.');return false;}return true;}} open={open} exit={exit} onError={setNotice}/>
  <span className="save" role="status" title={status}>{uploading?'Uploading...':status}</span>
  {teamId&&<span className="presence" title={live?.members.map(m=>m.email).join(', ')}>{new Set(live?.members.map(m=>m.userId)).size} online</span>}
  {repository instanceof TeamRepository&&(live?.role??repository.role)==='owner'&&<Members repository={repository}/>}
  <details className="board-actions header-popover"><summary aria-label="Board actions">Actions</summary><div className="popover-content"><button onClick={exportBoard}>Export</button>
  <div className="import"><button disabled={!writable} onClick={()=>importInput.current?.click()}>Import</button><input ref={importInput} aria-label="Import backup" type="file" disabled={!writable} accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(file){try{const value:unknown=JSON.parse(await file.text());if(!validWorkspace(value))throw Error('Invalid backup');update(value);setBoardId(value.boards[0].id);setSelected([]);}catch(e){setNotice(e instanceof Error?e.message:'Invalid backup');}}e.target.value='';}}/></div>
  <details className="shortcuts"><summary>?</summary><div><strong>Canvas shortcuts</strong><p>Shift-click or drag empty space: select cards<br/>Space-drag or middle drag: pan<br/>Arrows / Shift-arrows: move 1 / 10 px<br/>Ctrl/⌘ A: select all · D: duplicate<br/>Ctrl/⌘ C/X/V: copy, cut, paste<br/>Ctrl/⌘ Z / Shift-Z: undo / redo<br/>Delete: remove · Escape: clear selection<br/>Ctrl/⌘ +/−/0: zoom</p></div></details>
 </div></details></header>
 <aside aria-label="Left sidebar">{(selected.length||selectedAnnotation||connection)&&!connectorTool?<div className="object-sidebar" role="region" aria-label="Object tools">
  <button className="back-tools" aria-label="Back to tools" onClick={backToTools}><span aria-hidden="true">←</span> Back to tools</button>
  <h2>{connection?'Connection':selectedAnnotation?'Annotation':selected.length>1?`${selected.length} items`:activeCard?.kind==='checklist'?'List':activeCard?.kind??'Item'}</h2>
  {!writable&&<p className="view-only">View only</p>}
  {activeCard&&writable&&!['board','image','video'].includes(activeCard.kind)&&<button onClick={()=>editContent(activeCard.id)}>Edit content</button>}
  {activeCard&&writable&&<div className="object-dimensions"><label>Width<input aria-label="Item width" type="number" min={160} max={4000} value={Math.round(cardWidth(activeCard))} onChange={e=>{const value=e.currentTarget.valueAsNumber;if(Number.isFinite(value))update(resizeInColumns(stateRef.current,board.id,activeCard.id,value,cardHeight(activeCard),mediaAspects.current.get(activeCard.id),mediaAspects.current));}}/></label>{!['image','video'].includes(activeCard.kind)&&<label>Height<input aria-label="Item height" type="number" min={100} max={10000} value={Math.round(cardHeight(activeCard))} onChange={e=>{const value=e.currentTarget.valueAsNumber;if(Number.isFinite(value))update(resizeInColumns(stateRef.current,board.id,activeCard.id,cardWidth(activeCard),value,undefined,mediaAspects.current));}}/></label>}</div>}
  <div className="object-content-tools" ref={setToolsTarget} onClick={()=>{if(activeCard)setEditingCard(activeCard.id);}}/>
  {activeCard?.kind==='note'&&<NoteLabels key={activeCard.id} labels={activeCard.labels} editable={writable} change={labels=>changeCard(activeCard.id,{labels})}/>}
  {activeCard?.kind==='link'&&/^https?:\/\//.test(activeCard.text)&&<a className="object-link" href={activeCard.text} target="_blank" rel="noreferrer">Open reference ↗</a>}
  {activeCard?.kind==='board'&&<button onClick={()=>{if(state.boards.some(b=>b.id===activeCard.target))setBoardId(activeCard.target!);}}>Open board</button>}
  {selectedAnnotation&&<AnnotationToolbar contextual shape={annotationShape} setShape={setAnnotationShape} tool="select" setTool={setAnnotationTool} writable={writable} color={annotationColor} setColor={setAnnotationColor} thickness={annotationThickness} setThickness={setAnnotationThickness} selected={board.annotations?.find(a=>a.id===selectedAnnotation)} change={changeAnnotation} remove={remove}/>}
  {selected.length>0&&writable&&<><fieldset><legend>Color</legend><div className="object-colors">{['#fff','#fff4c9','#e3efe9','#e7e8f7','#f7dfdc'].map(color=><button className="swatch" key={color} aria-label={'Set color '+color} style={{background:color}} onClick={()=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(c=>selected.includes(c.id)?{...c,color}:c)})})}/>)}</div></fieldset>
  <button onClick={duplicate}>Duplicate</button>{selected.length===2&&<button onClick={connectCards}>Connect cards</button>}
  {board.cards.some(c=>c.kind==='column')&&<label>Column<select aria-label="Move selection to column" value="" onChange={e=>update(dropIntoColumn(stateRef.current,board.id,selected,e.target.value,Infinity,mediaAspects.current))}><option value="">Move to column…</option>{board.cards.filter(c=>c.kind==='column'&&!selected.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.text}</option>)}</select></label>}
  <button onClick={remove}>Delete {selected.length===1?'card':'cards'}</button></>}
  {(selected.length>0||selectedAnnotation)&&writable&&<LayerControls change={action=>update(reorderLayers(stateRef.current,board.id,selectedAnnotation?[selectedAnnotation]:selected,action))}/>}
  {connection&&writable&&<button onClick={remove}>Delete connection</button>}
  <div className="object-history"><button disabled={!writable} onClick={()=>history('undo')}>Undo</button><button disabled={!writable} onClick={()=>history('redo')}>Redo</button></div>
 </div>:<><div className="tools">{([['note','▤','Note'],['link','↗','Link'],['checklist','☑','To-do'],['board','▦','Board'],['column','▥','Column']] as [Kind,string,string][]).map(([kind,icon,label])=><button key={kind} aria-label={label} disabled={!writable} onClick={()=>add(kind)}><span aria-hidden="true">{label==='Link'?<UrlIcon/>:icon}</span>{label}</button>)}
  <button aria-label="Connect items" title="Line tool: connect two items" aria-pressed={connectorTool} disabled={!writable} onClick={()=>{setConnectorTool(!connectorTool);setConnectorSource(null);setAnnotationTool('select');setSelectedAnnotation(null);setSelected([]);setConnection(null);}}><span aria-hidden="true">↗</span>Line</button>
  {([['Image','▧','image/png,image/jpeg,image/webp,image/gif'],['Video','▷','video/mp4,video/webm'],['File','⇧','.pdf,.zip,.txt']] as const).map(([label,icon,accept])=><button key={label} aria-label={'Upload '+label.toLowerCase()} disabled={!writable||!teamId||uploading} title={!teamId?'Uploads require a team workspace':undefined} onClick={()=>pickFiles(accept)}><span aria-hidden="true">{icon}</span>{label}</button>)}
 </div>  <AnnotationToolbar shape={annotationShape} setShape={setAnnotationShape} tool={annotationTool} setTool={tool=>{setConnectorTool(false);setConnectorSource(null);setAnnotationTool(tool);setSelected([]);setConnection(null);setSelectedAnnotation(null);if(tool==='highlighter'){setAnnotationColor('#f5c542');setAnnotationThickness(18);}else if(tool==='pen'||tool==='shape'){setAnnotationColor('#d95d39');setAnnotationThickness(3);}}} writable={writable} color={annotationColor} setColor={setAnnotationColor} thickness={annotationThickness} setThickness={setAnnotationThickness} change={changeAnnotation} remove={remove}/><div className="aside-bottom"><button disabled={!writable} onClick={()=>history('undo')}>↶<small>Undo</small></button><button disabled={!writable} onClick={()=>history('redo')}>↷<small>Redo</small></button></div></>}</aside>
 <input ref={uploadInput} className="upload-input" type="file" multiple aria-label="Upload media files" onChange={e=>{void files([...e.target.files??[]]);e.target.value='';}}/>
 <main><BoardAppearance background={board.background} pattern={board.pattern} writable={writable} change={patch=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id===board.id?{...b,...patch}:b)})}/><div className="board-heading"><div className="board-identity"><nav className="breadcrumbs" aria-label="Board breadcrumbs">{(()=>{const chain:Board[]=[];let current:Board|undefined=board;const seen=new Set<string>();while(current&&!seen.has(current.id)){chain.unshift(current);seen.add(current.id);current=state.boards.find(b=>b.id===current?.parent);}return chain.map((ancestor,index)=><span key={ancestor.id}>{index>0&&<span className="crumb-separator" aria-hidden="true">/</span>}{ancestor.id===board.id?<span aria-current="page">{ancestor.title}</span>:<button onClick={()=>setBoardId(ancestor.id)}>{ancestor.title}</button>}</span>);})()}</nav><h1 aria-label={board.title}><input aria-label="Board title" readOnly={!writable} value={board.title} onChange={e=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id===board.id?{...b,title:e.target.value}:b)})}/></h1><span className="workspace-mode">{teamId?`${live?.role??(repository as TeamRepository).role} access`:'Browser-local | No team sync'}</span></div><input className="search" placeholder="Find on this board…" aria-label="Search cards" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {notice&&<div className="notice" role="alert">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div>}
  <div className="viewport" style={boardCanvasStyle(board.background,board.pattern)} ref={viewport} role="region" aria-label="Board canvas" tabIndex={0}
   onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();void files([...e.dataTransfer.files],contentPoint(e.clientX,e.clientY));}}
   onPointerDown={e=>{if(e.button===1||space.current){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pan.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};return;}if(!(e.target instanceof HTMLElement)||!['viewport','canvas','plane'].some(name=>(e.target as HTMLElement).classList.contains(name)))return;const point=contentPoint(e.clientX,e.clientY);const next={...point,endX:point.x,endY:point.y,before:e.shiftKey?selected:[]};marquee.current=next;setArea(next);setSelected(next.before);setSelectedAnnotation(null);setConnection(null);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(pan.current){e.currentTarget.scrollLeft=pan.current.left-(e.clientX-pan.current.x);e.currentTarget.scrollTop=pan.current.top-(e.clientY-pan.current.y);}else if(marquee.current){const point=contentPoint(e.clientX,e.clientY),next={...marquee.current,endX:point.x,endY:point.y};setArea(next);const left=Math.min(next.x,next.endX),right=Math.max(next.x,next.endX),top=Math.min(next.y,next.endY),bottom=Math.max(next.y,next.endY);if(right-left>3||bottom-top>3){const ids=board.cards.filter(c=>c.kind==='column'?c.x>=left&&c.x+cardWidth(c)<=right&&c.y>=top&&c.y+cardHeight(c)<=bottom:c.x<right&&c.x+cardWidth(c)>left&&c.y<bottom&&c.y+cardHeight(c)>top).map(c=>c.id);setSelected([...new Set([...next.before,...ids])]);}}}}
   onPointerUp={()=>{pan.current=null;marquee.current=null;setArea(null);}} onPointerCancel={()=>{pan.current=null;marquee.current=null;setArea(null);}}
  ><div className="canvas" style={{width:extent.width*zoom,height:extent.height*zoom}}><div className={'plane'+(connectorTool?' connecting':'')} style={{width:extent.width,height:extent.height,transform:`scale(${zoom})`}}>

   {board.cards.filter(c=>c.kind==='column'||[c.text,c.title,...(c.labels??[]).map(l=>l.text)].join(' ').toLowerCase().includes(query.toLowerCase())).map(c=><article key={c.id} data-card-id={c.id} className={'card '+c.kind+(selected.includes(c.id)?' selected':'')+(editingCard===c.id?' editing':'')+(dropTarget===c.id?' drop-target':'')} style={{zIndex:cardLayer(board,c),left:c.x,top:c.y,background:['image','video'].includes(c.kind)?'transparent':c.color,width:cardWidth(c),height:cardHeight(c)}} role="group" aria-label={`${c.kind} card: ${c.text.slice(0,60)}`} tabIndex={0} onPointerDownCapture={e=>{if(connectorTool&&!space.current){e.preventDefault();e.stopPropagation();}else startDrag(e,c);}} onPointerMove={e=>moveDrag(e,c.id)} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)} onFocusCapture={e=>{if(writable&&e.currentTarget.contains(e.target as Node)&&editing(e.target)&&!(e.target as HTMLElement).matches('[type=checkbox]')){setEditingCard(c.id);choose(c.id);}}} onDoubleClick={e=>{if(!e.currentTarget.contains(e.target as Node))return;if(c.kind!=='board'){choose(c.id);setEditingCard(c.id);const target=e.target as HTMLElement;if(target.matches('input,textarea,[contenteditable=true]'))target.focus();else editContent(c.id);}}} onClickCapture={e=>{if(connectorTool){e.preventDefault();e.stopPropagation();choose(c.id);}}} onClick={e=>{if(surfaceClick.current){surfaceClick.current=false;return;}choose(c.id,e.shiftKey);}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();choose(c.id,e.shiftKey);if(e.key==='Enter')editContent(c.id);}}}>

    {c.kind==='board'?<button className="board-tile" onDoubleClick={()=>{if(state.boards.some(b=>b.id===c.target))setBoardId(c.target!);}}><div className="folder">▦</div><strong>{state.boards.find(b=>b.id===c.target)?.title||c.text}</strong></button>
    :c.kind==='column'?<><input className="column-title" aria-label="Column title" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/><div className="column-summary" aria-live="polite">{columnSummary(board,c.id)}</div></>
    :['image','video','file'].includes(c.kind)?<><MediaCard card={c} workspaceId={teamId} toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} editable={writable} toggleCaption={()=>{const visible=c.captionVisible===false;if(visible){pendingCaptionFocus.current=c.id;setEditingCard(c.id);}changeCard(c.id,{captionVisible:visible,height:Math.min(10000,Math.max(100,cardHeight(c)+(visible?28:-28)))});}} onAspect={ratio=>{if(Number.isFinite(ratio)&&ratio>0)mediaAspects.current.set(c.id,ratio);}}/>{(c.kind==='file'||c.captionVisible!==false)&&<input className="media-caption" placeholder={c.kind==='file'?undefined:'Write a subtitle...'} ref={input=>{if(input&&pendingCaptionFocus.current===c.id){pendingCaptionFocus.current=null;input.focus();input.setSelectionRange(input.value.length,input.value.length);}}} aria-label="Media caption" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/>}</>
    :c.kind==='note'?<><div className="note-body"><RichNote toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} text={c.text} document={c.richText} editable={writable} change={(text,richText)=>changeCard(c.id,{text,richText})}/></div><NoteLabels labels={c.labels} editable={false} change={labels=>changeCard(c.id,{labels})}/></>
    :c.kind==='checklist'?<Checklist toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} card={c} editable={writable} change={patch=>changeCard(c.id,patch)}/>
    :<><div className="link-card-icon"><UrlIcon/></div><textarea readOnly={!writable} aria-label="Link address" value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/><VideoLink url={c.text}/></>}
    {writable&&selected.includes(c.id)&&<div className="resize-handle" style={['image','video'].includes(c.kind)?{bottom:mediaFooterHeight(c)}:undefined} role="slider" tabIndex={0} aria-label={`Resize ${c.kind} card`} aria-valuemin={160} aria-valuemax={4000} aria-valuenow={cardWidth(c)} title={['image','video'].includes(c.kind)?'Drag or use arrows to resize proportionally':'Drag to resize; arrows change width, Shift-arrows change height'} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.key==='ArrowLeft'||e.key==='ArrowDown'?-10:10;update(resizeInColumns(stateRef.current,board.id,c.id,cardWidth(c)+(e.shiftKey&&!['image','video'].includes(c.kind)?0:step),cardHeight(c)+(e.shiftKey?step:0),mediaAspects.current.get(c.id),mediaAspects.current));}}
     onPointerDown={e=>{e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);resize.current={id:c.id,x:e.clientX,y:e.clientY,width:cardWidth(c),height:cardHeight(c),inverse:[]};}}
     onPointerMove={e=>{const gesture=resize.current;if(gesture?.id===c.id){const delta=screenDelta(e.clientX-gesture.x,e.clientY-gesture.y,zoom);previewGesture(resizeInColumns(stateRef.current,board.id,c.id,gesture.width+delta.x,gesture.height+delta.y,mediaAspects.current.get(c.id),mediaAspects.current));}}} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)}/>
    }
   </article>)}
   <ConnectorLayer board={board} width={extent.width} height={extent.height} selected={connection} interactive={annotationTool==='select'&&!connectorTool} select={id=>{setConnection(id);setSelected([]);setSelectedAnnotation(null);}}/>
   <AnnotationLayer canvasBackground={board.background} key={board.id} shape={annotationShape} annotations={board.annotations??[]} tool={annotationTool} writable={writable} selectedId={selectedAnnotation} onSelect={selectAnnotation} add={addAnnotation} change={changeAnnotation} point={contentPoint} panActive={()=>space.current} width={extent.width} height={extent.height} color={annotationColor} thickness={annotationThickness} focusId={annotationFocus} focused={()=>setAnnotationFocus(null)}/>
  </div>{rectangle&&<div className="marquee" style={rectangle}/>}</div>{board.cards.length===0&&<div className="empty">A fresh board.<br/><small>Add a note or drop an image to start.</small></div>}</div>


  {connectorTool&&<div className="connector-hint" role="status">{connectorSource?'Choose the destination item':'Choose the first item to connect'}<button onClick={()=>{setConnectorTool(false);setConnectorSource(null);setSelected([]);}}>Cancel</button></div>}
  <div className="zoom"><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><button onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2,z+.1))}>+</button></div>

  <footer>{teamId?`${live?.role??(repository as TeamRepository).role} | Live team workspace | ${new Set(live?.members.map(m=>m.userId)).size} online`:'Browser-local canvas | No team sync'} · Space-drag to pan · Shift-click to select</footer>
 </main></div>;
}
