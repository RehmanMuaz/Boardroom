import {useTouchCanvas} from './canvas/useTouchCanvas';
import {useMobileViewport} from './canvas/useMobileViewport';
import {ElementToolbar} from './canvas/ElementToolbar';
import {mediaAspect} from './content/media-size';
import {type CommentTarget} from '../comments';
import {UrlIcon} from './content/UrlIcon';
import {Icon,AppMark} from './Icon';
import {Comments} from './comments/Comments';
import {MediaViewer} from './content/MediaViewer';
import {type ImageEdit,validImageEdit,originalImageEdit} from '../image-edit';
import {useRequestedSection} from './useRequestedSection';
import {resetElementOverrides} from '../workspaceStyles';
import {FrameSettings} from './export/FrameSettings';
import {FrameOverlay} from './export/FrameOverlay';
import {SelectionOverlay} from './canvas/SelectionOverlay';
import {groupOf,expandGroups,completeGroups,groupSelection,ungroupSelection,groupReason,selectionBounds,marqueeSelection,duplicateObjects,pruneGroups} from './canvas/groups';
import {MultiSelectionStyle} from './styles/MultiSelectionStyle';
import {sharedValue,selectionStyles,resetSelectionStyle} from '../selectionStyles';
import {FormatPainter} from './FormatPainter';
import {captureFormatting,type CapturedFormat,type PaintTarget} from '../formatPainter';
import {WorkspaceStyles} from './styles/WorkspaceStyles';
import {ElementStyle} from './styles/ElementStyle';
import {resolveStyledBoard,patchStyledCard,patchStyledAnnotation,cardStyleCss} from '../workspaceStyles';
import {ExportSection} from './export/ExportSection';
import {ObjectActions} from './ObjectActions';
import {CommandMenu} from './CommandMenu';
import {SettingsDialog} from './SettingsDialog';
import {ModifierPanel} from './ModifierPanel';
import {SharedRepository} from '../sharedRepository';
import {snapPoint} from './canvas/snap';
import {ModifierSection} from './ModifierSection';
import {ColorPicker,normalizeHex} from './content/ColorPicker';
import {boardCanvasStyle} from '../boardAppearance';
import {useCreationPlacement,type CreationTool} from './canvas/useCreationPlacement';
import './canvas/creation-placement.css';
import {BoardAppearance} from './BoardAppearance';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {validWorkspace,type Workspace,type Kind,type Card,type Board} from '../model';
import {usePersistence} from '../usePersistence';
import {type LiveView} from '../liveRepository';
import {applyChanges,diffWorkspace,same,type Change} from '../operations';
import {defaultTextStyle,type Annotation,type ShapeKind} from '../annotations';
import {AnnotationLayer} from './annotations/AnnotationLayer';
import {AnnotationToolbar,type AnnotationTool} from './annotations/AnnotationToolbar';
import './annotations/annotations.css';
import './canvas/organization.css';
import './canvas/object-sidebar.css';
import {WorkspaceControls} from './WorkspaceControls';
import {Members} from '../team';
import {TeamRepository,uploadAsset,api,type WorkspaceRepository} from '../repository';
import {cardWidth,cardHeight,moveSelection,deleteSelection,canvasExtent,screenDelta,mediaFooterHeight,resizeCard} from './canvas/domain';
import {RichNote} from './content/RichNote';
import {MediaCard,VideoLink} from './content/MediaCard';
import {Checklist} from './content/Checklist';
import {NoteLabels,labelInk} from './content/NoteLabels';
import {ConnectorLayer} from './canvas/ConnectorLayer';
import {LayerControls} from './canvas/LayerControls';
import {cardLayer,columnAt,columnSummary,dropIntoColumn,resizeInColumns,reorderLayers,layoutColumns} from './canvas/organization';

type Drag={id:string;ids:string[];x:number;y:number;startX:number;startY:number;moved:boolean;point?:{x:number;y:number};inverse:Change[];origin:{x:number;y:number}};
type Resize={id:string;x:number;y:number;width:number;height:number;inverse:Change[]};
type Area={x:number;y:number;endX:number;endY:number;before:string[]};
const clipboardPrefix='BOARDROOM-CARDS:';
const editing=(target:EventTarget|null)=>target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));

export function Editor({repository,initial,exit,open}:{open:(repository:WorkspaceRepository,state:Workspace)=>void;repository:WorkspaceRepository;initial:Workspace;exit:()=>void}){
 const mobile=useMobileViewport();
 const [touchMode,setTouchMode]=useState<'pan'|'edit'>('pan'),[touchMulti,setTouchMulti]=useState(false),[propertiesOpen,setPropertiesOpen]=useState(false);
 const [state,setState]=useState<Workspace>(initial),stateRef=useRef(state);
 const [live,setLive]=useState<LiveView|null>(null);
 const writable=!(repository instanceof SharedRepository)&&(!(repository instanceof TeamRepository)||((live?.role??repository.role)!=='viewer'&&!live?.blocked));
 const local=usePersistence(state,repository,writable);
 const status=repository instanceof SharedRepository?'Shared view | Refreshes every 5 seconds':repository instanceof TeamRepository?(live?.status??'Connecting...'):local.status;
 const dirty=repository instanceof TeamRepository?(live?.dirty??false):local.dirty;
 const [boardId,setBoardId]=useState(initial.boards[0].id),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(1),[query,setQuery]=useState('');
 const [connection,setConnection]=useState<string|null>(null),[uploading,setUploading]=useState(false),[notice,setNotice]=useState(''),[area,setArea]=useState<Area|null>(null);
 const [connectorTool,setConnectorTool]=useState(false),[connectorSource,setConnectorSource]=useState<string|null>(null),[dropTarget,setDropTarget]=useState<string|null>(null);
 const [annotationShape,setAnnotationShape]=useState<ShapeKind>('arrow');
 const [annotationTool,setAnnotationTool]=useState<AnnotationTool>('select'),[annotationColor,setAnnotationColor]=useState('#d95d39'),[annotationThickness,setAnnotationThickness]=useState(3),[annotationFocus,setAnnotationFocus]=useState<string|null>(null);
 const [commentsDirty,setCommentsDirty]=useState(false),[commentsRequest,setCommentsRequest]=useState(0);
 const [commentCompose,setCommentCompose]=useState<{key:number;target:CommentTarget}>({key:0,target:{}});
 const [mediaStartCrop,setMediaStartCrop]=useState(false),[gesturing,setGesturing]=useState(false);
 function openMedia(id:string,crop=false){setMediaStartCrop(crop);setMediaId(id);}
 const [mediaId,setMediaId]=useState<string|null>(null),[mediaDirty,setMediaDirty]=useState(false);
 const [frameDirty,setFrameDirty]=useState(false),[frameEditorKey,setFrameEditorKey]=useState(0);
 const [styleDirty,setStyleDirty]=useState(false),[styleEditorKey,setStyleEditorKey]=useState(0);
 const [actionRequest,setActionRequest]=useState(0),[actionSection,setActionSection]=useState(''),[teamRequest,setTeamRequest]=useState(0),[accountRequest,setAccountRequest]=useState(0);
 const helpSection=useRequestedSection<HTMLDetailsElement>(actionSection==='help'?actionRequest:0);
 function openActions(section:string){setActionSection(section);setActionRequest(n=>n+1);}
 const [exporting,setExporting]=useState(false),[pdfRequest,setPdfRequest]=useState(0);
 const leaveBlocked=useRef(false);leaveBlocked.current=dirty||uploading||exporting||styleDirty||frameDirty||mediaDirty||commentsDirty;
 const past=useRef<Change[][]>([]),future=useRef<Change[][]>([]),drag=useRef<Drag|null>(null),resize=useRef<Resize|null>(null),viewport=useRef<HTMLDivElement>(null);
 const pendingCaptionFocus=useRef<string|null>(null);
 const [editingCard,setEditingCard]=useState<string|null>(null),[toolsTarget,setToolsTarget]=useState<HTMLDivElement|null>(null);
 const surfaceClick=useRef(false);
 const activeCard=selected.length===1?boardCard():undefined;
 function boardCard(){return state.boards.find(b=>b.id===boardId)?.cards.find(c=>c.id===selected[0]);}
 function backToTools(){insideGroup.current=null;setSelected([]);setConnection(null);setEditingCard(null);setAnnotationTool('select');(document.activeElement as HTMLElement|null)?.blur();}
 function editContent(id:string){if(!writable)return;if(mobile.phone)setPropertiesOpen(false);setEditingCard(id);requestAnimationFrame(()=>{const article=document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);const field=article?.querySelector<HTMLElement>('textarea,input:not([type=checkbox]),[contenteditable=true]');field?.focus();if(mobile.phone)field?.scrollIntoView({block:'center',inline:'nearest'});});}
 const mediaAspects=useRef(new Map<string,number>());
 const snapKey='boardroom.snap.'+('id' in repository?repository.id:'local');
 const frameVisibilityKey=snapKey.replace('snap.','frames.');
 const [framesVisible,setFramesVisible]=useState(()=>{try{return localStorage.getItem(frameVisibilityKey)!=='false';}catch{return true;}});
 function setFrameVisibility(value:boolean){setFramesVisible(value);try{localStorage.setItem(frameVisibilityKey,String(value));}catch{/* Personal visibility only. */}}
 const [snap,setSnap]=useState(()=>{try{return localStorage.getItem(snapKey)==='true';}catch{return false;}}),alt=useRef(false);
 function setSnapping(value:boolean){setSnap(value);try{localStorage.setItem(snapKey,String(value));}catch{setNotice('Grid snapping changed for this tab only.');}}
 const space=useRef(false),pan=useRef<{x:number;y:number;left:number;top:number}|null>(null),marquee=useRef<Area|null>(null);
 const importInput=useRef<HTMLInputElement>(null);
 const uploadInput=useRef<HTMLInputElement>(null),fileAccept=useRef('*'),uploadPlacement=useRef<{point:{x:number;y:number};boardId:string}|null>(null);
 const board=state.boards.find(b=>b.id===boardId)||state.boards[0],extent=canvasExtent(board);
 const displayBoard=resolveStyledBoard(state,board);
 const styleOwner=!(repository instanceof SharedRepository)&&(!(repository instanceof TeamRepository)||(live?.role??repository.role)==='owner');
 const teamId=repository instanceof TeamRepository||repository instanceof SharedRepository?repository.id:undefined;
 const selectedAnnotation=selected.length===1&&board.annotations?.some(a=>a.id===selected[0])?selected[0]:null;
 const insideGroup=useRef<string|null>(null);
 const activeAnnotation=board.annotations?.find(a=>a.id===selectedAnnotation);
 useEffect(()=>{const existing=new Set([...board.cards,...board.annotations??[]].map(o=>o.id));if(insideGroup.current&&!board.groups?.some(g=>g.id===insideGroup.current))insideGroup.current=null;setSelected(ids=>{const live=ids.filter(id=>existing.has(id)),next=insideGroup.current?live:expandGroups(board,live);return same(ids,next)?ids:next;});},[board.cards,board.annotations,board.groups]);
 const [paintSource,setPaintSource]=useState<CapturedFormat|null>(null);
 const paintTarget:PaintTarget|undefined=activeCard?{kind:'card',id:activeCard.id}:activeAnnotation?{kind:'annotation',id:activeAnnotation.id}:undefined;
 const copyable=writable&&paintTarget?captureFormatting(state,board.id,paintTarget):null;
 useEffect(()=>{setPaintSource(null);},[board.id,writable]);

 const coloredCards=displayBoard.cards.filter(c=>selected.includes(c.id)&&!['image','video'].includes(c.kind));
 useEffect(()=>{if(!(repository instanceof SharedRepository))return;let active=true,busy=false;const refresh=async()=>{if(busy)return;busy=true;try{const next=await repository.load();if(active){stateRef.current=next;setState(next);}}catch{if(active)exit();}finally{busy=false;}};const timer=setInterval(()=>void refresh(),5000);return()=>{active=false;clearInterval(timer);};},[repository]);
 useEffect(()=>{if(!(repository instanceof TeamRepository))return;return repository.start(view=>{stateRef.current=view.snapshot;setState(view.snapshot);setLive(view);});},[repository]);
 useEffect(()=>{if(!commentsDirty&&!mediaDirty&&!frameDirty&&!styleDirty&&(!(repository instanceof TeamRepository)||!dirty&&!uploading))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[repository,dirty,uploading,frameDirty,styleDirty,mediaDirty,commentsDirty]);
 useEffect(()=>{if(repository instanceof TeamRepository)repository.presence(board.id);},[repository,board.id]);
 useEffect(()=>{setMediaId(null);insideGroup.current=null;setSelected([]);setConnection(null);setQuery('');setAnnotationFocus(null);setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}},[board.id]);
 useEffect(()=>{if(!writable){setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);}},[writable]);
 const apply=(next:Workspace)=>{if(!writable)return;if(repository instanceof TeamRepository)repository.change(stateRef.current,next);else {stateRef.current=next;setState(next);}};
 const update=(next:Workspace)=>{if(!writable)return;if(!validWorkspace(next)){setNotice('This change exceeds supported card, label or column limits.');return;}const inverse=diffWorkspace(next,stateRef.current);if(!inverse.length)return;past.current.push(inverse);future.current=[];apply(next);};
 function changeCard(id:string,patch:Partial<Card>){update({...stateRef.current,boards:stateRef.current.boards.map(b=>{
  if(b.id!==board.id)return b;const card=b.cards.find(c=>c.id===id);const next={...b,cards:b.cards.map(c=>c.id===id?patchStyledCard(c,patch):c)};
  return card&&(patch.width!==undefined||patch.height!==undefined)?layoutColumns(next,card.kind==='column'?[id]:card.columnId?[card.columnId]:[],mediaAspects.current):next;
 })});}
 function saveImageEdit(id:string,edit:ImageEdit|undefined,expected:ImageEdit|undefined,assetId:string){
  if(!writable)throw Error('Image editing requires editor access.');const current=stateRef.current.boards.find(b=>b.id===board.id)?.cards.find(c=>c.id===id);if(!current||current.kind!=='image'||current.assetId!==assetId||!same(current.imageEdit,expected))throw Error('The source or image edits changed remotely. Reload the draft.');if(edit&&!validImageEdit(edit))throw Error('Invalid image adjustments.');
  const before=expected??originalImageEdit,after=edit??originalImageEdit,ratio=mediaAspects.current.get(id);let dimensions:Partial<Card>={};
  if(ratio&&(before.rotation!==after.rotation||!same(before.crop,after.crop))){const oriented=ratio*before.crop.height/before.crop.width,source=before.rotation%180?1/oriented:oriented,nextRatio=(after.rotation%180?1/source:source)*after.crop.width/after.crop.height;dimensions=resizeCard(current,cardWidth(current),cardHeight(current),nextRatio);mediaAspects.current.set(id,nextRatio);}
  update({...stateRef.current,boards:stateRef.current.boards.map(b=>{if(b.id!==board.id)return b;const next={...b,cards:b.cards.map(c=>{if(c.id!==id)return c;const next={...c,...dimensions};if(edit)next.imageEdit=structuredClone(edit);else delete next.imageEdit;return next;})};return current.columnId?layoutColumns(next,[current.columnId],mediaAspects.current):next;})});
 }
 function changeAnnotation(id:string,patch:Partial<Annotation>,expected?:Partial<Annotation>){
  const current=stateRef.current.boards.find(b=>b.id===board.id)?.annotations?.find(a=>a.id===id);if(!current||!writable)return;
  if(expected&&Object.entries(expected).some(([key,value])=>!same((current as unknown as Record<string,unknown>)[key],value))){setNotice('This annotation changed remotely. Try the move or resize again.');return;}
  const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,annotations:(b.annotations??[]).map(a=>a.id===id?patchStyledAnnotation(a,patch,displayBoard.annotations?.find(v=>v.id===id)):a)})};
  if(!validWorkspace(next)){setNotice('Annotation exceeds the supported size or formatting limits.');return;}update(next);
 }
 function addAnnotation(annotation:Annotation){
  if(!writable)return;const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,annotations:[...(b.annotations??[]),annotation.kind==='text'&&state.workspaceStyle?{...annotation,styleBinding:{role:'body' as const}}:annotation]})};
  if(!validWorkspace(next)){setNotice('Annotation limit reached. Strokes allow up to 4,096 points and a 10,000-unit span.');return;}update(next);setSelected([]);setConnection(null);setSelected([annotation.id]);
  setAnnotationTool('select');if(annotation.kind==='text')setAnnotationFocus(annotation.id);
 }
 function chooseAnnotationTool(tool:AnnotationTool){if(!writable)return;insideGroup.current=null;setPaintSource(null);setConnectorTool(false);setConnectorSource(null);creation.cancel();setAnnotationTool(tool);setSelected([]);setConnection(null);if(tool==='highlighter'){setAnnotationColor('#f5c542');setAnnotationThickness(18);}else if(tool==='pen'||tool==='shape'){setAnnotationColor('#d95d39');setAnnotationThickness(3);}}
 function selectAnnotation(id:string,shift=false){choose(id,shift);}
 function enterGroup(id:string){insideGroup.current=groupOf(board,id)?.id??null;setSelected([id]);}
 function groupItems(){if(!writable)return;const current=stateRef.current.boards.find(b=>b.id===board.id)!;const reason=groupReason(current,selected);if(reason){setNotice(reason);return;}insideGroup.current=null;update(groupSelection(stateRef.current,board.id,selected));}
 function ungroupItems(){if(!writable)return;insideGroup.current=null;update(ungroupSelection(stateRef.current,board.id,selected));}
 function location(){const view=viewport.current;return {x:Math.min(100000,Math.max(60,(view?.scrollLeft??0)/zoom+60+(board.cards.length%3)*300)),y:Math.min(100000,Math.max(70,(view?.scrollTop??0)/zoom+70+Math.floor(board.cards.length/3)*280))};}
 function add(kind:Kind,text?:string,point=location()){
  if(!writable)return;setConnectorTool(false);setConnectorSource(null);const id=crypto.randomUUID(),target=kind==='board'?crypto.randomUUID():undefined;
  const card:Card={id,kind,text:text??(kind==='board'?'Untitled board':kind==='column'?'New column':kind==='checklist'?'First task\nSecond task':kind==='link'?'https://example.com':'Write your idea…'),color:'#fff',...point};
  if(state.workspaceStyle)card.styleBinding={role:'body'};
  if(target)card.target=target;if(kind==='checklist')card.title='Untitled list';if(kind==='column'){card.width=320;card.height=520;card.color='#ebeee8';}
  const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,card]})};
  if(target)next.boards.push({id:target,parent:board.id,title:card.text,cards:[],...(state.workspaceStyle?{styleEnabled:true}:{})});const column=kind==='column'?undefined:columnAt(next.boards.find(b=>b.id===board.id)!,point,[id]);update(column?dropIntoColumn(next,board.id,[id],column.id,point.y,mediaAspects.current):next);setSelected([id]);
 }
 function history(direction:'undo'|'redo'){
  if(!writable)return;const from=direction==='undo'?past:future,to=direction==='undo'?future:past,changes=from.current.pop();
  if(changes){try{const next=applyChanges(stateRef.current,changes);to.current.push(diffWorkspace(next,stateRef.current));apply(next);setSelected([]);}catch{from.current.push(changes);setNotice('This field changed remotely. Undo would overwrite another edit.');}}
 }
 function remove(){if(connection){update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:(b.connectors??[]).filter(line=>line.id!==connection)})});setConnection(null);return;}const removed=deleteSelection(stateRef.current,board.id,selected);update({...removed,boards:removed.boards.map(b=>b.id===board.id?layoutColumns(b,board.cards.filter(c=>selected.includes(c.id)&&c.columnId).map(c=>c.columnId!),mediaAspects.current):b)});setSelected([]);}
 function choose(id:string,shift=false){
  setConnection(null);
  if(connectorTool&&writable){
   if(!connectorSource){setConnectorSource(id);setSelected([id]);return;}
   if(connectorSource===id)return;
   update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:[...(b.connectors??[]),{id:crypto.randomUUID(),from:connectorSource,to:id,color:'#789180'}]})});
   setConnectorSource(null);setConnectorTool(false);setSelected([]);return;
  }
  const group=groupOf(board,id);if(insideGroup.current&&insideGroup.current!==group?.id)insideGroup.current=null;
  const unit=insideGroup.current===group?.id?[id]:group?.members??[id];
  setSelected(current=>shift?(unit.every(id=>current.includes(id))?current.filter(value=>!unit.includes(value)):[...new Set([...current,...unit])]):current.includes(id)?current:[...unit]);
 }
 function expandedIds(ids=selected){return [...new Set([...ids,...board.cards.filter(c=>c.columnId&&ids.includes(c.columnId)).map(c=>c.id)])];}
 function duplicate(){if(!writable)return;const result=duplicateObjects(board,expandedIds(),selectedAnnotation?20:32);const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,...result.cards],connectors:[...(b.connectors??[]),...result.connectors],...(result.annotations.length?{annotations:[...b.annotations??[],...result.annotations]}:{}),...(result.groups.length?{groups:[...b.groups??[],...result.groups]}:{})})};update(reorderLayers(next,board.id,result.ids,'front'));insideGroup.current=null;setSelected(result.ids);setConnection(null);if(result.annotations.length===1&&result.ids.length===1&&result.annotations[0].kind==='text')setAnnotationFocus(result.annotations[0].id);if(selected.some(id=>board.cards.find(c=>c.id===id)?.kind==='board'))setNotice('Nested board tiles are not duplicated.');}
 function connectCards(){if(selected.length!==2||!selected.every(id=>board.cards.some(c=>c.id===id)))return;update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:[...(b.connectors??[]),{id:crypto.randomUUID(),from:selected[0],to:selected[1],color:'#789180'}]})});}
 function exportBoard(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='boardroom-backup.json';a.click();URL.revokeObjectURL(a.href);}
 async function files(files:File[],point=location(),destination=board.id){
  if(!files.length)return;if(!teamId){setNotice('Open a team workspace to upload private images, videos, or files.');return;}if(!writable||uploading)return;
  setUploading(true);setNotice('');
  try{for(const [index,file] of files.entries()){
   if(file.size>50*1024*1024)throw Error('Files and videos are limited to 50 MB; images to 10 MB.');
   const asset=await uploadAsset(teamId,file),id=crypto.randomUUID(),ratio=asset.kind==='file'?undefined:await mediaAspect(file,asset.kind);
   const card:Card={id,kind:asset.kind,assetId:asset.id,text:asset.kind==='file'?asset.name:'',...(asset.kind==='file'?{}:{captionVisible:false}),color:'#fff',x:Math.min(100000,point.x+index*40),y:Math.min(100000,point.y+index*40),width:320,height:asset.kind==='file'?180:300};
   if(ratio){Object.assign(card,resizeCard(card,320,300,ratio));mediaAspects.current.set(id,ratio);}
   if(!stateRef.current.boards.some(b=>b.id===destination))throw Error('Destination board was removed. The upload remains in private storage.');
   const next={...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==destination?b:{...b,cards:[...b.cards,card]})};const column=columnAt(next.boards.find(b=>b.id===destination)!,point,[id]);update(column?dropIntoColumn(next,destination,[id],column.id,point.y,mediaAspects.current):next);if(destination===boardId)setSelected([id]);
  }}catch(e){setNotice(e instanceof Error?e.message:'Upload failed');}finally{setUploading(false);}
 }
 function pickFiles(accept:string,point=location()){uploadPlacement.current={point,boardId:board.id};fileAccept.current=accept;if(uploadInput.current){uploadInput.current.accept=accept;uploadInput.current.click();}}
 function contentPoint(x:number,y:number){const view=viewport.current,rect=view?.getBoundingClientRect();return {x:(x-(rect?.left??0)+(view?.scrollLeft??0))/zoom,y:(y-(rect?.top??0)+(view?.scrollTop??0))/zoom};}
 const creation=useCreationPlacement({viewport,point:(x,y)=>snapPoint(contentPoint(x,y),snap&&!alt.current),enabled:writable&&!uploading,place:(kind,point)=>{if(['image','video','file'].includes(kind))pickFiles(kind==='image'?'image/png,image/jpeg,image/webp,image/gif':kind==='video'?'video/mp4,video/webm':'.pdf,.zip,.txt',point);else add(kind,undefined,point);},onArm:()=>{setPaintSource(null);backToTools();setConnectorTool(false);setConnectorSource(null);}});
 useEffect(()=>{creation.cancel();uploadPlacement.current=null;},[board.id]);
 const touch=useTouchCanvas({viewport,zoom,setZoom,resetKey:board.id,
  cancel:()=>{finishGesture(true);pan.current=null;marquee.current=null;setArea(null);creation.cancel();window.dispatchEvent(new Event('boardroom:cancel-touch-gesture'));},
  pass:target=>{if(creation.tool||annotationTool==='text')return false;if(writable&&annotationTool!=='select')return true;const item=target.closest('[data-card-id],[data-annotation-id]');return writable&&touchMode==='edit'&&!touchMulti&&!!item&&selected.includes(item.getAttribute('data-card-id')??item.getAttribute('data-annotation-id')??'');},
  tap:(target,x,y,double)=>{if(creation.tool){creation.commit(x,y);return;}if(annotationTool==='text'&&writable){const p=contentPoint(x,y);addAnnotation({id:crypto.randomUUID(),kind:'text',x:p.x,y:p.y,width:320,height:120,text:'',color:'auto',style:{...defaultTextStyle}});return;}
   const item=target.closest('[data-card-id],[data-annotation-id]'),id=item?.getAttribute('data-card-id')??item?.getAttribute('data-annotation-id');
   if(id){choose(id,touchMulti);if(double&&!touchMulti&&!connectorTool){const card=board.cards.find(c=>c.id===id);enterGroup(id);if(card?.kind==='board'){if(state.boards.some(b=>b.id===card.target))setBoardId(card.target!);}else if(card&&['image','video'].includes(card.kind)&&teamId)openMedia(id);else if(card)editContent(id);else if(writable&&board.annotations?.some(a=>a.id===id&&a.kind==='text'))setAnnotationFocus(id);}return;}
   const line=target.closest('[data-connector-id]');if(line){setSelected([]);setConnection(line.getAttribute('data-connector-id'));return;}backToTools();
  }});

 function startDrag(e:ReactPointerEvent<HTMLElement|SVGElement>,card:Card|Annotation){
  if(e.shiftKey&&annotationTool==='select'&&!connectorTool&&!space.current&&e.button===0&&!(editingCard===card.id&&editing(e.target))){e.preventDefault();e.stopPropagation();choose(card.id,true);surfaceClick.current=true;return;}
  if(!writable||connectorTool||annotationTool!=='select'||e.button!==0||space.current||e.shiftKey)return;
  const target=e.target as HTMLElement;if(!e.currentTarget.contains(target))return;
  if(target.closest('.resize-handle,.media-inspect,input[type=checkbox],a,.embed-play,iframe')||(editingCard===card.id&&target.closest('input,textarea,[contenteditable=true]')))return;
  const video=target.closest('video');if(video&&e.clientY>video.getBoundingClientRect().bottom-40*zoom)return;
  e.preventDefault();e.stopPropagation();setEditingCard(null);surfaceClick.current=false;
  const group=groupOf(board,card.id);if(insideGroup.current!==group?.id)insideGroup.current=null;const ids=selected.includes(card.id)?selected:insideGroup.current===group?.id?[card.id]:group?.members??[card.id];setSelected(ids);setGesturing(true);drag.current={id:card.id,ids:expandedIds(ids),x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,inverse:[],origin:{x:card.x,y:card.y}};
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
 function moveDrag(e:{clientX:number;clientY:number;altKey?:boolean},id:string){
  const moving=drag.current;if(moving?.id!==id)return;
  if(Math.hypot(e.clientX-moving.startX,e.clientY-moving.startY)>3)moving.moved=true;
  if(!moving.moved)return;
  const currentBoard=stateRef.current.boards.find(b=>b.id===board.id);const anchor=currentBoard&&[...currentBoard.cards,...currentBoard.annotations??[]].find(c=>c.id===moving.id);if(!anchor)return;const target=snapPoint({x:moving.origin.x+(e.clientX-moving.startX)/zoom,y:moving.origin.y+(e.clientY-moving.startY)/zoom},snap&&!e.altKey);const delta={x:target.x-anchor.x,y:target.y-anchor.y};
  previewGesture(moveSelection(stateRef.current,board.id,moving.ids,delta.x,delta.y));moving.x=e.clientX;moving.y=e.clientY;moving.point=contentPoint(e.clientX,e.clientY);
  const current=stateRef.current.boards.find(b=>b.id===board.id)!;
  setDropTarget(moving.ids.some(id=>groupOf(current,id)||current.annotations?.some(a=>a.id===id))||current.cards.find(c=>c.id===moving.id)?.kind==='column'?null:columnAt(current,moving.point,moving.ids)?.id??null);
 }
 function finishGesture(cancel=false){
  const gesture=drag.current??resize.current;if(!gesture)return;if(drag.current?.moved)surfaceClick.current=true;
  if(!cancel&&drag.current?.moved&&drag.current.point){
   const current=stateRef.current.boards.find(b=>b.id===board.id)!;
   const free=drag.current.ids.some(id=>groupOf(current,id)||current.annotations?.some(a=>a.id===id));const target=free?undefined:columnAt(current,drag.current.point,drag.current.ids);
   previewGesture(dropIntoColumn(stateRef.current,board.id,drag.current.ids,target?.id,drag.current.point.y,mediaAspects.current));
  }
  if(cancel){try{apply(applyChanges(stateRef.current,gesture.inverse));}catch{setNotice('A remote change prevented canceling this gesture.');}}
  else if(gesture.inverse.length){past.current.push(gesture.inverse);future.current=[];}
  drag.current=null;resize.current=null;setGesturing(false);setDropTarget(null);
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
   if(e.key==='Alt')alt.current=true;
   const modifier=e.metaKey||e.ctrlKey;
   if(modifier&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
   if(modifier&&e.key.toLowerCase()==='y'){e.preventDefault();history('redo');return;}
   if(e.key==='Escape'&&paintSource){setPaintSource(null);return;}
   if(e.key==='Escape'&&insideGroup.current){const group=board.groups?.find(g=>g.id===insideGroup.current);insideGroup.current=null;if(group){setSelected(group.members);setEditingCard(null);(document.activeElement as HTMLElement|null)?.blur();return;}}
   if(e.key==='Escape'){setEditingCard(null);setSelected([]);finishGesture(true);setAnnotationTool('select');setConnectorTool(false);setConnectorSource(null);setConnection(null);setNotice('');(document.activeElement as HTMLElement|null)?.blur();return;}
   if(editing(e.target))return;
   if(creation.tool&&e.key==='Enter'){e.preventDefault();const rect=viewport.current?.getBoundingClientRect();if(rect)creation.commit(rect.left+rect.width/2,rect.top+rect.height/2);return;}
   if(e.code==='Space'){space.current=true;e.preventDefault();}
   if(modifier&&e.key.toLowerCase()==='g'){e.preventDefault();if(writable)(e.shiftKey?ungroupItems:groupItems)();return;}
   if(modifier&&e.key.toLowerCase()==='a'){e.preventDefault();insideGroup.current=null;setSelected([...board.cards,...board.annotations??[]].map(c=>c.id));}
   if(modifier&&e.key.toLowerCase()==='d'){e.preventDefault();if(writable)duplicate();}
   if(['Delete','Backspace'].includes(e.key)&&(selected.length||connection||selectedAnnotation)){e.preventDefault();if(writable)remove();}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.length&&writable){e.preventDefault();const step=e.shiftKey?10:1;update(moveSelection(stateRef.current,board.id,selected,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));}
   if(modifier&&['+','=','-','0'].includes(e.key)){e.preventDefault();setZoom(z=>e.key==='0'?1:Math.max(.25,Math.min(2,z+(e.key==='-'?-.1:.1))));}
  }
  function up(e:KeyboardEvent){if(e.key==='Alt')alt.current=false;if(e.code==='Space')space.current=false;}
  function copy(e:ClipboardEvent){if(editing(e.target)||!selected.length)return;const ids=expandedIds();const copied=pruneGroups({...board,cards:board.cards.filter(c=>ids.includes(c.id)&&c.kind!=='board'),annotations:(board.annotations??[]).filter(a=>ids.includes(a.id)),groups:completeGroups(board,ids),connectors:(board.connectors??[]).filter(line=>ids.includes(line.from)&&ids.includes(line.to))});const payload={version:1,workspaceId:teamId,cards:copied.cards,annotations:copied.annotations,groups:copied.groups,connectors:copied.connectors};e.preventDefault();e.clipboardData?.setData('text/plain',clipboardPrefix+JSON.stringify(payload));if(e.type==='cut'&&writable)remove();}
  function paste(e:ClipboardEvent){
   if(e.clipboardData?.files.length){e.preventDefault();void files([...e.clipboardData.files]);return;}if(editing(e.target)||!writable)return;
   const text=e.clipboardData?.getData('text/plain')??'';if(!text)return;
   if(!text.startsWith(clipboardPrefix)){e.preventDefault();add(/^https?:\/\//.test(text)?'link':'note',text);return;}
   e.preventDefault();try{const payload=JSON.parse(text.slice(clipboardPrefix.length));const copied:Board={id:'clipboard',title:'Clipboard',cards:payload.cards,connectors:payload.connectors,...(payload.annotations?{annotations:payload.annotations}:{}),...(payload.groups?{groups:payload.groups}:{})};
    if(!validWorkspace({version:1,boards:[copied]}))throw Error('Clipboard does not contain valid cards');
    if(copied.cards.some(c=>c.assetId)&&payload.workspaceId!==teamId)throw Error('Private media can only be pasted within its source workspace. Download and upload it to move it.');
    const result=duplicateObjects(copied,[...copied.cards,...copied.annotations??[]].map(c=>c.id));update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:[...b.cards,...result.cards],connectors:[...(b.connectors??[]),...result.connectors],...(result.annotations.length?{annotations:[...b.annotations??[],...result.annotations]}:{}),...(result.groups.length?{groups:[...b.groups??[],...result.groups]}:{})})});insideGroup.current=null;setSelected(result.ids);
   }catch(e){setNotice(e instanceof Error?e.message:'Invalid clipboard');}
  }
  const resetModifiers=()=>{alt.current=false;space.current=false;};window.addEventListener('blur',resetModifiers);
  window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('copy',copy);window.addEventListener('cut',copy);window.addEventListener('paste',paste);
  return()=>{window.removeEventListener('blur',resetModifiers);window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('copy',copy);window.removeEventListener('cut',copy);window.removeEventListener('paste',paste);};
 });
 const selectedGroups=completeGroups(board,selected),selectedLine=board.connectors?.find(c=>c.id===connection);
 const quickBounds=selectedLine?selectionBounds(board,[selectedLine.from,selectedLine.to]):selectionBounds(board,selected);
 const commentTarget:CommentTarget|undefined=selectedLine?{connectorId:selectedLine.id}:selected.length===1?(activeCard?{cardId:activeCard.id}:activeAnnotation?{annotationId:activeAnnotation.id}:undefined):selectedGroups.length===1&&selectedGroups[0].members.length===selected.length?{groupId:selectedGroups[0].id}:undefined;
 const rectangle=area?{left:Math.min(area.x,area.endX)*zoom,top:Math.min(area.y,area.endY)*zoom,width:Math.abs(area.endX-area.x)*zoom,height:Math.abs(area.endY-area.y)*zoom}:undefined;
 return <div style={mobile.phone?{height:mobile.height}:undefined} className={'app'+((selected.length||selectedAnnotation||connection)&&!connectorTool?' contextual-sidebar':'')+(touch.used?' touch-device':'')+(propertiesOpen?' mobile-properties-open':'')}><header onKeyDown={e=>{if(e.key==='Escape'&&e.target instanceof HTMLElement){const details=e.target.closest('details');if(details){e.preventDefault();e.stopPropagation();details.open=false;details.querySelector('summary')?.focus();}}}}>
  <span className="brand" aria-label="Boardroom"><AppMark/><span>boardroom</span></span>
  {repository instanceof SharedRepository?<span className="shared-workspace-name">{repository.displayName} ? Read only</span>:<WorkspaceControls repository={repository} accountRequest={accountRequest} canLeave={()=>{if(leaveBlocked.current){setNotice('Wait for saving to finish, or export your edits before switching workspaces.');return false;}return true;}} open={open} exit={exit} onError={setNotice}/>}
  <span className="save" role="status" title={status}>{uploading?'Uploading...':status}</span>
  {teamId&&!(repository instanceof SharedRepository)&&<span className="presence" title={live?.members.map(m=>m.email).join(', ')}>{new Set(live?.members.map(m=>m.userId)).size} online</span>}
  {repository instanceof TeamRepository&&(live?.role??repository.role)==='owner'&&<Members repository={repository} openRequest={teamRequest}/>}
  <CommandMenu commands={[
   {id:'comments',group:'Sharing',label:'Open team comments',keywords:['feedback','reply','mention','unread','resolve'],run:()=>setCommentsRequest(n=>n+1),disabled:!(repository instanceof TeamRepository),disabledReason:'Comments require a team workspace.'},
   {id:'pdf',group:'Export',label:'Export current board to PDF',keywords:['download','print','document'],run:()=>setPdfRequest(n=>n+1)},
   {id:'export',group:'Export',label:'Export workspace backup (JSON)',keywords:['download','save','all boards'],description:'Save all boards and media references.',run:exportBoard},
   {id:'frames',group:'Export',label:'Manage export frames',keywords:['region','crop','page','presentation'],description:'Name, size and order PDF regions.',run:()=>openActions('frames')},
   {id:'styles',group:'Style',label:'Workspace style settings',keywords:['font','palette','defaults','theme','color'],description:styleOwner?'Preview and manage shared defaults.':'Inspect shared defaults and permitted board settings.',run:()=>openActions('styles')},
   {id:'reset-style',group:'Style',label:'Reset selected style overrides',keywords:['inherit','format','font','default'],description:'Restore each linked element to its own inherited role.',disabled:!writable||!state.workspaceStyle||!selected.some(id=>{const c=board.cards.find(c=>c.id===id),a=board.annotations?.find(a=>a.id===id),binding=c?.styleBinding??(a?.kind==='text'?a.styleBinding:undefined);return !!Object.keys(binding?.overrides??{}).length;}),disabledReason:!writable?'This workspace is read-only.':!state.workspaceStyle?'Enable workspace styles first.':!selected.length?'Select style-linked text elements first.':'The selection has no custom style overrides.',run:()=>{if(writable)update(resetElementOverrides(stateRef.current,board.id,selected));}},
   {id:'paint',group:'Style',label:'Copy selected formatting',keywords:['format painter','appearance','paste style'],description:'Preview formatting on a compatible target before applying.',disabled:!writable||!copyable,disabledReason:!writable?'This workspace is read-only.':'Select one text-bearing card or annotation. Media and connections are unsupported.',run:()=>{if(writable&&copyable)setPaintSource(copyable);}},
   {id:'group',group:'Selection',label:'Group selected elements',shortcut:'Ctrl/Cmd G',keywords:['combine','collection'],run:groupItems,disabled:!writable||!!groupReason(board,selected),disabledReason:!writable?'This workspace is read-only.':groupReason(board,selected)??undefined},
   {id:'ungroup',group:'Selection',label:'Ungroup selected elements',shortcut:'Ctrl/Cmd Shift G',run:ungroupItems,disabled:!writable||!completeGroups(board,selected).length,disabledReason:!writable?'This workspace is read-only.':'Select a complete group first.'},
   {id:'duplicate',group:'Selection',label:'Duplicate selection',shortcut:'Ctrl/Cmd D',keywords:['copy','clone'],run:duplicate,disabled:!writable||!selected.length,disabledReason:!writable?'This workspace is read-only.':'Select an element first.'},
   {id:'undo',group:'Selection',label:'Undo',shortcut:'Ctrl/Cmd Z',run:()=>history('undo'),disabled:!writable||!past.current.length,disabledReason:!writable?'This workspace is read-only.':'No local changes to undo.'},
   {id:'redo',group:'Selection',label:'Redo',shortcut:'Ctrl/Cmd Shift Z',run:()=>history('redo'),disabled:!writable||!future.current.length,disabledReason:!writable?'This workspace is read-only.':'No local changes to redo.'},
   ...([['note','Add note'],['checklist','Add checklist'],['link','Add link'],['board','Add nested board'],['column','Add column'],['image','Upload image'],['video','Upload video'],['file','Upload file']] as [CreationTool,string][]).map(([tool,label])=>({id:'create-'+tool,group:'Create',label,keywords:[tool,'place','insert',tool==='checklist'?'todo task list':tool==='image'?'photo picture':tool==='video'?'movie':'card'],description:'Choose where to place it on the canvas.',disabled:!writable||uploading||['image','video','file'].includes(tool)&&!teamId,disabledReason:!writable?'This workspace is read-only.':uploading?'Wait for the current upload to finish.':'Open a team workspace to upload private media.',run:()=>creation.arm(tool)})),
   ...([['text','Add text annotation'],['pen','Draw with pen'],['highlighter','Highlight drawing'],['shape','Draw shape']] as [AnnotationTool,string][]).map(([tool,label])=>({id:'annotate-'+tool,group:'Create',label,keywords:['annotation',tool],description:'Choose the position or draw on the canvas.',disabled:!writable,disabledReason:'This workspace is read-only.',run:()=>chooseAnnotationTool(tool)})),
   {id:'share',group:'Sharing',label:'Share workspace and manage team',keywords:['invite','client','viewer','email','member','link'],description:'Manage invitations and account-free client links.',disabled:!(repository instanceof TeamRepository)||!styleOwner,disabledReason:repository instanceof SharedRepository?'Client links cannot manage workspace sharing.':!(repository instanceof TeamRepository)?'Open a team workspace to share it.':'Only the workspace owner can manage sharing.',run:()=>{if(repository instanceof TeamRepository&&styleOwner)setTeamRequest(n=>n+1);}},
   {id:'account',group:'Navigation',label:'Account and appearance settings',keywords:['dark','light','system','sign out','login','preferences'],disabled:repository instanceof SharedRepository,disabledReason:'Open your own workspace to manage your account.',run:()=>{if(!(repository instanceof SharedRepository))setAccountRequest(n=>n+1);}},
   {id:'actions',group:'Navigation',label:'Board actions',keywords:['import','settings','backup'],run:()=>openActions('')},
   {id:'help',group:'Navigation',label:'Keyboard shortcuts',keywords:['help','hotkeys','keys'],run:()=>openActions('help')},
   {id:'inspect-media',group:'View',label:'Inspect selected media',keywords:['fullscreen','image','video','viewer'],disabled:!teamId||!activeCard||!['image','video'].includes(activeCard.kind),disabledReason:!teamId?'Open the source team workspace to inspect private media.':'Select one image or video.',run:()=>{if(teamId&&activeCard&&['image','video'].includes(activeCard.kind))openMedia(activeCard.id);}},
   {id:'tools',group:'View',label:'Back to creation tools',keywords:['sidebar','deselect','clear selection'],run:backToTools},
   {id:'snap',group:'View',label:snap?'Disable grid snapping':'Enable grid snapping',keywords:['align','placement'],run:()=>setSnapping(!snap),disabled:!writable,disabledReason:'This workspace is read-only.'},
   {id:'zoom',group:'View',label:'Reset zoom to 100%',keywords:['scale','normal size'],run:()=>setZoom(1)}
  ]}/><SettingsDialog label="Board actions" title="Board actions" dirty={styleDirty||frameDirty} onDiscard={()=>{setStyleDirty(false);setFrameDirty(false);setStyleEditorKey(k=>k+1);setFrameEditorKey(k=>k+1);}} busy={exporting} openRequest={pdfRequest+actionRequest}><div className="action-sections"><ExportSection pdfRequest={pdfRequest} board={displayBoard} exportJson={exportBoard} onBusy={setExporting} access={{check:async()=>{if(repository instanceof TeamRepository)await api(`/workspaces/${repository.id}`);else if(repository instanceof SharedRepository)await api(`/viewer/${repository.linkId}/workspace`);},assetBase:repository instanceof SharedRepository?`/api/viewer/${repository.linkId}/assets`:repository instanceof TeamRepository?`/api/workspaces/${repository.id}/assets`:undefined}}/><FrameSettings openRequest={actionSection==='frames'?actionRequest:0} key={board.id+':'+frameEditorKey} board={board} current={()=>stateRef.current} change={update} writable={writable} onDirty={setFrameDirty} visible={framesVisible} setVisible={setFrameVisibility} hasSelection={selected.length>0} region={()=>{const bounds=selectionBounds(board,selected);if(bounds)return {x:Math.max(0,bounds.left-24),y:Math.max(0,bounds.top-24),width:bounds.width+48,height:bounds.height+48};const view=viewport.current;return {x:Math.round((view?.scrollLeft??0)/zoom+60),y:Math.round((view?.scrollTop??0)/zoom+60),width:Math.min(960,Math.max(240,((view?.clientWidth??800)-120)/zoom)),height:Math.min(640,Math.max(180,((view?.clientHeight??600)-120)/zoom))};}}/><WorkspaceStyles openRequest={actionSection==='styles'?actionRequest:0} key={styleEditorKey} workspace={state} board={board} owner={styleOwner} writable={writable} change={update} onDirty={setStyleDirty}/><section className="dialog-section"><h3>Import backup</h3><p>Restore a JSON backup. This replaces the current workspace content.</p>
  <div className="import"><button disabled={!writable} onClick={()=>importInput.current?.click()}>Import</button><input ref={importInput} aria-label="Import backup" type="file" disabled={!writable} accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(file){try{const value:unknown=JSON.parse(await file.text());if(!validWorkspace(value))throw Error('Invalid backup');if(!styleOwner&&!same(value.workspaceStyle,stateRef.current.workspaceStyle))throw Error('Only the workspace owner can import a backup that changes workspace styles.');update(value);setBoardId(value.boards[0].id);setSelected([]);}catch(e){setNotice(e instanceof Error?e.message:'Invalid backup');}}e.target.value='';}}/></div></section>
  <details ref={helpSection} className="dialog-help"><summary>Keyboard shortcuts</summary><div><strong>Canvas shortcuts</strong><p>Shift-click or drag empty space: select elements<br/>Space-drag or middle drag: pan<br/>Arrows / Shift-arrows: move 1 / 10 px<br/>Ctrl/⌘ A: select all · D: duplicate<br/>Ctrl/⌘ C/X/V: copy, cut, paste<br/>Ctrl/⌘ G / Shift-G: group / ungroup<br/>Ctrl/⌘ Z / Shift-Z: undo / redo<br/>Delete: remove · Escape: clear selection<br/>Ctrl/⌘ +/−/0: zoom</p></div></details>
 </div></SettingsDialog></header>
 <aside aria-label="Left sidebar">{(selected.length||selectedAnnotation||connection)&&!connectorTool?<div className="mobile-properties-header"><button className="properties-toggle" aria-expanded={propertiesOpen} aria-controls="object-tools" onClick={()=>setPropertiesOpen(value=>!value)}>{propertiesOpen?'Hide properties':'Properties'}</button><button onClick={()=>{setPropertiesOpen(false);backToTools();}}>Tools</button></div>:null}{(selected.length||selectedAnnotation||connection)&&!connectorTool?<div id="object-tools" className="object-sidebar" role="region" aria-label="Object tools">
  <button className="back-tools" aria-label="Back to tools" onClick={backToTools}><Icon name="back" size={16}/> Back to tools</button>
  <h2>{connection?'Connection':selectedAnnotation?(activeAnnotation?.kind==='shape'?activeAnnotation.shape:activeAnnotation?.kind==='text'?'Text annotation':activeAnnotation?.kind??'Annotation'):selected.length>1?`${selected.length} items`:activeCard?.kind==='checklist'?'List':activeCard?.kind??'Item'}</h2>
  {!writable&&<p className="view-only">View only</p>}
  {writable&&(paintSource?<FormatPainter key={paintTarget?.kind+':'+paintTarget?.id} workspace={state} boardId={board.id} target={paintTarget} source={paintSource} current={()=>stateRef.current} apply={update} cancel={()=>setPaintSource(null)}/>:copyable&&<button className="format-copy" onClick={()=>setPaintSource(copyable)}>Copy formatting</button>)}
  <ModifierPanel key={activeCard?.kind??activeAnnotation?.kind??(connection?'connection':'selection')} kind={activeCard?.kind??activeAnnotation?.kind??(connection?'connection':'selection')}>
  {selected.length>1&&board.cards.some(c=>selected.includes(c.id))&&<MultiSelectionStyle workspace={state} board={board} ids={selected} writable={writable} current={()=>stateRef.current} change={update}/>}
  {state.workspaceStyle&&(activeCard&&!['image','video','file'].includes(activeCard.kind)||activeAnnotation?.kind==='text')&&<ModifierSection title="Style"><ElementStyle workspace={state} board={board} id={activeCard?.id??activeAnnotation!.id} binding={activeCard?.styleBinding??(activeAnnotation?.kind==='text'?activeAnnotation.styleBinding:undefined)} card={!!activeCard} writable={writable} change={update}/></ModifierSection>}
  {activeCard&&(writable||['link','board','image','video','file'].includes(activeCard.kind))&&<ModifierSection title={activeCard.kind==='checklist'?'Tasks':['image','video','file'].includes(activeCard.kind)?'Media':'Content'}>
  {activeCard&&writable&&!['board','image','video'].includes(activeCard.kind)&&<button onClick={()=>editContent(activeCard.id)}>Edit content</button>}
  <div className="object-content-tools" ref={setToolsTarget} onClick={()=>{if(activeCard)setEditingCard(activeCard.id);}}/>
  {activeCard?.kind==='link'&&/^https?:\/\//.test(activeCard.text)&&<a className="object-link" href={activeCard.text} target="_blank" rel="noreferrer">Open reference ↗</a>}
  {activeCard?.kind==='board'&&<button onClick={()=>{if(state.boards.some(b=>b.id===activeCard.target))setBoardId(activeCard.target!);}}>Open board</button>}
  </ModifierSection>}
  {activeCard?.kind==='note'&&(writable||!!activeCard.labels?.length)&&<ModifierSection title="Labels"><NoteLabels key={activeCard.id} labels={activeCard.labels} editable={writable} change={labels=>changeCard(activeCard.id,{labels})}/></ModifierSection>}
  {activeCard&&writable&&<ModifierSection title="Size"><div className="object-dimensions"><label>Width (px)<input aria-label="Item width" type="number" min={160} max={4000} value={Math.round(cardWidth(activeCard))} onChange={e=>{const value=e.currentTarget.valueAsNumber;if(Number.isFinite(value))update(resizeInColumns(stateRef.current,board.id,activeCard.id,value,cardHeight(activeCard),mediaAspects.current.get(activeCard.id),mediaAspects.current));}}/></label>{!['image','video'].includes(activeCard.kind)&&<label>Height (px)<input aria-label="Item height" type="number" min={100} max={10000} value={Math.round(cardHeight(activeCard))} onChange={e=>{const value=e.currentTarget.valueAsNumber;if(Number.isFinite(value))update(resizeInColumns(stateRef.current,board.id,activeCard.id,cardWidth(activeCard),value,undefined,mediaAspects.current));}}/></label>}</div></ModifierSection>}
  {selectedAnnotation&&<AnnotationToolbar contextual shape={annotationShape} setShape={setAnnotationShape} tool="select" setTool={setAnnotationTool} writable={writable} color={annotationColor} setColor={setAnnotationColor} thickness={annotationThickness} setThickness={setAnnotationThickness} selected={displayBoard.annotations?.find(a=>a.id===selectedAnnotation)} change={changeAnnotation} remove={remove}/>}
  {coloredCards.length>0&&writable&&<ModifierSection title="Appearance"><fieldset><legend>Background color</legend>{selected.length>1&&<><p className="mixed-selection-help">Background applies to {coloredCards.length} of {selected.length} selected cards. {selectionStyles(state,board.id,selected).status('cardColor')}.</p>{selectionStyles(state,board.id,selected).canReset('cardColor')&&<button onClick={()=>update(resetSelectionStyle(stateRef.current,board.id,selected,'cardColor'))}>Reset selection background</button>}</>}<div className="object-colors">{(state.workspaceStyle?.palette??['#fff','#fff4c9','#e3efe9','#e7e8f7','#f7dfdc']).map(color=><button className="swatch" key={color} aria-label={'Set color '+color} style={{background:color}} onClick={()=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(c=>selected.includes(c.id)&&!['image','video'].includes(c.kind)?patchStyledCard(c,{color}):c)})})}/>)}</div><ColorPicker key={selected.join(',')} name="Item background color" label="Custom background" value={sharedValue(coloredCards.map(c=>c.color))} change={color=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,cards:b.cards.map(c=>selected.includes(c.id)&&!['image','video'].includes(c.kind)?patchStyledCard(c,{color}):c)})})}/></fieldset></ModifierSection>}
  {selected.length>0&&!selected.some(id=>groupOf(board,id))&&writable&&board.cards.some(c=>c.kind==='column'&&!selected.includes(c.id))&&<ModifierSection title="Placement">{board.cards.some(c=>c.kind==='column')&&<label>Column<select aria-label="Move selection to column" value="" onChange={e=>update(dropIntoColumn(stateRef.current,board.id,selected,e.target.value,Infinity,mediaAspects.current))}><option value="">Move to column…</option>{board.cards.filter(c=>c.kind==='column'&&!selected.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.text}</option>)}</select></label>}</ModifierSection>}
  {(selected.length>0||selectedAnnotation)&&writable&&<ModifierSection title="Layers"><LayerControls change={action=>update(reorderLayers(stateRef.current,board.id,selectedAnnotation?[selectedAnnotation]:selected,action))}/></ModifierSection>}
  {connection&&writable&&<ModifierSection title="Appearance"><ColorPicker name="Connection color" value={board.connectors?.find(line=>line.id===connection)?.color} change={color=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id!==board.id?b:{...b,connectors:(b.connectors??[]).map(line=>line.id===connection?{...line,color}:line)})})}/></ModifierSection>}
  {writable&&selected.length===2&&selected.every(id=>board.cards.some(c=>c.id===id))&&<ModifierSection title="Actions"><button onClick={connectCards}>Connect cards</button></ModifierSection>}
  </ModifierPanel>
  <ObjectActions writable={writable} canDuplicate={!!(selected.length||selectedAnnotation)} duplicateLabel={selectedAnnotation?'Duplicate annotation':'Duplicate'} deleteLabel={selectedAnnotation?'Delete annotation':connection?'Delete connection':selected.length===1?'Delete card':'Delete cards'} duplicate={duplicate} remove={remove} undo={()=>history('undo')} redo={()=>history('redo')}/>
 </div>:<><div className="tools">{([['note','▤','Note'],['link','↗','Link'],['checklist','☑','To-do'],['board','▦','Board'],['column','▥','Column']] as [Kind,string,string][]).map(([kind,_icon,label])=><button key={kind} aria-label={label} disabled={!writable} style={{touchAction:'none'}} aria-pressed={creation.tool===kind} onPointerDown={e=>creation.start(e,kind)} onClick={()=>creation.arm(kind)}><span aria-hidden="true"><Icon name={kind} size={24}/></span>{label}</button>)}
  <button aria-label="Connect items" title="Line tool: connect two items" aria-pressed={connectorTool} disabled={!writable} onClick={()=>{creation.cancel();setConnectorTool(!connectorTool);setConnectorSource(null);setAnnotationTool('select');setSelected([]);setConnection(null);}}><span aria-hidden="true"><Icon name="connection" size={24}/></span>Line</button>
  {([['Image','▧','image/png,image/jpeg,image/webp,image/gif'],['Video','▷','video/mp4,video/webm'],['File','⇧','.pdf,.zip,.txt']] as const).map(([label,_icon,accept])=><button key={label} aria-label={'Upload '+label.toLowerCase()} disabled={!writable||!teamId||uploading} title={!teamId?'Uploads require a team workspace':undefined} style={{touchAction:'none'}} aria-pressed={creation.tool===label.toLowerCase()} onPointerDown={e=>creation.start(e,label.toLowerCase() as CreationTool)} onClick={()=>creation.arm(label.toLowerCase() as CreationTool)}><span aria-hidden="true"><Icon name={label.toLowerCase()} size={24}/></span>{label}</button>)}
 </div><div className="aside-bottom"><button disabled={!writable} onClick={()=>history('undo')} aria-label="Undo"><Icon name="undo" size={22}/><small>Undo</small></button><button disabled={!writable} onClick={()=>history('redo')} aria-label="Redo"><Icon name="redo" size={22}/><small>Redo</small></button></div></>}</aside>
 <input ref={uploadInput} className="upload-input" type="file" multiple aria-label="Upload media files" onChange={e=>{const destination=uploadPlacement.current;uploadPlacement.current=null;void files([...e.target.files??[]],destination?.point,destination?.boardId);e.target.value='';}}/>
 <main><BoardAppearance snap={snap} onSnap={setSnapping} background={displayBoard.background} pattern={displayBoard.pattern} writable={writable} change={patch=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id===board.id?{...b,...patch,...('background' in patch&&patch.background===undefined&&b.styleEnabled?{styleEnabled:false,pattern:b.pattern??displayBoard.pattern}:{})}:b)})}/><div className="board-heading"><div className="board-identity"><nav className="breadcrumbs" aria-label="Board breadcrumbs">{(()=>{const chain:Board[]=[];let current:Board|undefined=board;const seen=new Set<string>();while(current&&!seen.has(current.id)){chain.unshift(current);seen.add(current.id);current=state.boards.find(b=>b.id===current?.parent);}return chain.map((ancestor,index)=><span key={ancestor.id}>{index>0&&<span className="crumb-separator" aria-hidden="true">/</span>}{ancestor.id===board.id?<span aria-current="page">{ancestor.title}</span>:<button onClick={()=>setBoardId(ancestor.id)}>{ancestor.title}</button>}</span>);})()}</nav><h1 aria-label={board.title}><input aria-label="Board title" readOnly={!writable} value={board.title} onChange={e=>update({...stateRef.current,boards:stateRef.current.boards.map(b=>b.id===board.id?{...b,title:e.target.value}:b)})}/></h1><span className="workspace-mode">{teamId?`${live?.role??(repository as TeamRepository).role} access`:'Browser-local | No team sync'}</span></div>{repository instanceof TeamRepository&&<Comments workspaceId={repository.id} board={board} boards={state.boards} selectedCard={activeCard?.id} writable={writable} openRequest={commentsRequest} composeRequest={commentCompose} onDirty={setCommentsDirty}/>}<input className="search" placeholder="Find on this board…" aria-label="Search cards" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {notice&&<div className="notice" role="alert">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div>}
  <div className="viewport" style={boardCanvasStyle(displayBoard.background,displayBoard.pattern)} ref={viewport} role="region" aria-label="Board canvas" tabIndex={0}
   onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();void files([...e.dataTransfer.files],contentPoint(e.clientX,e.clientY));}}
   onPointerDownCapture={e=>{if(touch.down(e))return;if(creation.tool&&e.button===0&&!space.current){e.preventDefault();e.stopPropagation();creation.commit(e.clientX,e.clientY);}}}
   onPointerMoveCapture={e=>{touch.move(e);if(e.pointerType!=='touch'&&creation.tool&&!pan.current)creation.move(e.clientX,e.clientY);}} onPointerLeave={()=>creation.move(-1,-1)} onPointerUpCapture={e=>touch.up(e)} onPointerCancelCapture={e=>touch.up(e,true)} onClickCapture={e=>{if(touch.suppressClick()){e.preventDefault();e.stopPropagation();}}}
   onPointerDown={e=>{if(e.button===1||space.current){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pan.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};return;}if(!(e.target instanceof HTMLElement)||!['viewport','canvas','plane'].some(name=>(e.target as HTMLElement).classList.contains(name)))return;insideGroup.current=null;const point=contentPoint(e.clientX,e.clientY);const next={...point,endX:point.x,endY:point.y,before:e.shiftKey?selected:[]};marquee.current=next;setArea(next);setSelected(next.before);setConnection(null);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(pan.current){e.currentTarget.scrollLeft=pan.current.left-(e.clientX-pan.current.x);e.currentTarget.scrollTop=pan.current.top-(e.clientY-pan.current.y);}else if(marquee.current){const point=contentPoint(e.clientX,e.clientY),next={...marquee.current,endX:point.x,endY:point.y};setArea(next);const left=Math.min(next.x,next.endX),right=Math.max(next.x,next.endX),top=Math.min(next.y,next.endY),bottom=Math.max(next.y,next.endY);if(right-left>3||bottom-top>3){const ids=marqueeSelection(board,{left,right,top,bottom});setSelected([...new Set([...next.before,...ids])]);}}}}
   onPointerUp={()=>{pan.current=null;marquee.current=null;setArea(null);}} onPointerCancel={()=>{pan.current=null;marquee.current=null;setArea(null);}}
  ><div className="canvas" style={{width:extent.width*zoom,height:extent.height*zoom}}><div className={'plane'+(connectorTool?' connecting':'')} style={{width:extent.width,height:extent.height,transform:`scale(${zoom})`}}>

   {framesVisible&&board.frames?.length?<FrameOverlay frames={board.frames}/>:null}
   {displayBoard.cards.filter(c=>c.kind==='column'||[c.text,c.title,...(c.labels??[]).map(l=>l.text)].join(' ').toLowerCase().includes(query.toLowerCase())).map(c=><article key={c.id} data-card-id={c.id} className={'card '+c.kind+(c.styleBinding?' workspace-styled':'')+(!['image','video'].includes(c.kind)&&labelInk(normalizeHex(c.color)??'#ffffff')==='#ffffff'?' dark-background':'')+(selected.includes(c.id)?' selected':'')+(editingCard===c.id?' editing':'')+(dropTarget===c.id?' drop-target':'')} style={{zIndex:cardLayer(board,c),left:c.x,top:c.y,background:['image','video'].includes(c.kind)?'transparent':c.color,color:!['image','video'].includes(c.kind)&&labelInk(normalizeHex(c.color)??'#ffffff')==='#ffffff'?'#ffffff':undefined,width:cardWidth(c),height:cardHeight(c),...cardStyleCss(c)}} role="group" aria-label={`${c.kind} card: ${c.text.slice(0,60)}`} tabIndex={0} onPointerDownCapture={e=>{if(connectorTool&&!space.current){e.preventDefault();e.stopPropagation();}else startDrag(e,c);}} onPointerMove={e=>moveDrag(e,c.id)} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)} onFocusCapture={e=>{if(touch.suppressClick()&&editingCard!==c.id){(e.target as HTMLElement).blur();return;}if(writable&&e.currentTarget.contains(e.target as Node)&&editing(e.target)&&!(e.target as HTMLElement).matches('[type=checkbox]')){setEditingCard(c.id);choose(c.id);}}} onDoubleClick={e=>{if(!e.currentTarget.contains(e.target as Node))return;if(['image','video'].includes(c.kind)&&teamId){enterGroup(c.id);setMediaId(c.id);return;}if(c.kind!=='board'){enterGroup(c.id);setEditingCard(c.id);const target=e.target as HTMLElement;if(target.matches('input,textarea,[contenteditable=true]'))target.focus();else editContent(c.id);}}} onClickCapture={e=>{if(connectorTool){e.preventDefault();e.stopPropagation();choose(c.id);}}} onClick={e=>{if(surfaceClick.current){surfaceClick.current=false;return;}choose(c.id,e.shiftKey);}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();choose(c.id,e.shiftKey);if(e.key==='Enter'){enterGroup(c.id);editContent(c.id);}}}}>

    {c.kind==='board'?<button className="board-tile" onDoubleClick={()=>{if(state.boards.some(b=>b.id===c.target))setBoardId(c.target!);}}><div className="folder">▦</div><strong>{state.boards.find(b=>b.id===c.target)?.title||c.text}</strong></button>
    :c.kind==='column'?<><input className="column-title" aria-label="Column title" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/><div className="column-summary" aria-live="polite">{columnSummary(board,c.id)}</div></>
    :['image','video','file'].includes(c.kind)?<><MediaCard inspect={()=>openMedia(c.id)} card={c} assetBase={repository instanceof SharedRepository?`/api/viewer/${repository.linkId}/assets`:undefined} workspaceId={teamId} toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} editable={writable} toggleCaption={()=>{const visible=c.captionVisible===false;if(visible){pendingCaptionFocus.current=c.id;setEditingCard(c.id);}changeCard(c.id,{captionVisible:visible,height:Math.min(10000,Math.max(100,cardHeight(c)+(visible?28:-28)))});}} onAspect={ratio=>{if(Number.isFinite(ratio)&&ratio>0)mediaAspects.current.set(c.id,ratio);}}/>{(c.kind==='file'||c.captionVisible!==false)&&<input className="media-caption" placeholder={c.kind==='file'?undefined:'Write a subtitle...'} ref={input=>{if(input&&pendingCaptionFocus.current===c.id){pendingCaptionFocus.current=null;input.focus();input.setSelectionRange(input.value.length,input.value.length);}}} aria-label="Media caption" readOnly={!writable} value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/>}</>
    :c.kind==='note'?<><div className="note-body"><RichNote toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} text={c.text} document={c.richText} editable={writable} change={(text,richText)=>changeCard(c.id,{text,richText})}/></div><NoteLabels labels={c.labels} editable={false} change={labels=>changeCard(c.id,{labels})}/></>
    :c.kind==='checklist'?<Checklist toolsTarget={selected.length===1&&selected[0]===c.id?toolsTarget:null} card={c} editable={writable} change={patch=>changeCard(c.id,patch)}/>
    :<><div className="link-card-icon"><UrlIcon/></div><textarea readOnly={!writable} aria-label="Link address" value={c.text} onChange={e=>changeCard(c.id,{text:e.target.value})}/><VideoLink url={c.text}/></>}
    {writable&&selected.length===1&&selected.includes(c.id)&&<div className="resize-handle" style={['image','video'].includes(c.kind)?{bottom:mediaFooterHeight(c)}:undefined} role="slider" tabIndex={0} aria-label={`Resize ${c.kind} card`} aria-valuemin={160} aria-valuemax={4000} aria-valuenow={cardWidth(c)} title={['image','video'].includes(c.kind)?'Drag or use arrows to resize proportionally':'Drag to resize; arrows change width, Shift-arrows change height'} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.key==='ArrowLeft'||e.key==='ArrowDown'?-10:10;update(resizeInColumns(stateRef.current,board.id,c.id,cardWidth(c)+(e.shiftKey&&!['image','video'].includes(c.kind)?0:step),cardHeight(c)+(e.shiftKey?step:0),mediaAspects.current.get(c.id),mediaAspects.current));}}
     onPointerDown={e=>{e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setGesturing(true);resize.current={id:c.id,x:e.clientX,y:e.clientY,width:cardWidth(c),height:cardHeight(c),inverse:[]};}}
     onPointerMove={e=>{const gesture=resize.current;if(gesture?.id===c.id){const delta=screenDelta(e.clientX-gesture.x,e.clientY-gesture.y,zoom);previewGesture(resizeInColumns(stateRef.current,board.id,c.id,gesture.width+delta.x,gesture.height+delta.y,mediaAspects.current.get(c.id),mediaAspects.current));}}} onPointerUp={()=>finishGesture()} onPointerCancel={()=>finishGesture(true)}/>
    }
   </article>)}
   <ConnectorLayer board={board} width={extent.width} height={extent.height} selected={connection} interactive={annotationTool==='select'&&!connectorTool} select={id=>{setConnection(id);setSelected([]);}}/>
   {paintSource&&!selected.length&&!selectedAnnotation&&!connection&&<div className="format-hint" role="status">Format Painter: select a compatible target. <button onClick={()=>setPaintSource(null)}>Cancel</button></div>}
  {creation.tool&&<div className="creation-placement" aria-hidden="true" style={{width:extent.width,height:extent.height}} onPointerMove={e=>creation.move(e.clientX,e.clientY)} onPointerLeave={()=>creation.move(-1,-1)} onPointerDown={e=>{if(e.button===1||space.current)return;if(e.button!==0)return;e.preventDefault();e.stopPropagation();creation.commit(e.clientX,e.clientY);}}/>}
   {creation.preview&&<div className="creation-preview" aria-hidden="true" style={{left:creation.preview.x,top:creation.preview.y,width:['image','video','file','column'].includes(creation.preview.tool)?320:240,height:creation.preview.tool==='column'?520:['image','video'].includes(creation.preview.tool)?300:180}}>{creation.preview.tool}</div>}
   <AnnotationLayer canvasBackground={displayBoard.background} key={board.id} shape={annotationShape} annotations={displayBoard.annotations??[]} tool={annotationTool} writable={writable} selectedId={selectedAnnotation} selectedIds={selected} onSelect={selectAnnotation} onEnter={enterGroup} startMove={startDrag} add={addAnnotation} change={changeAnnotation} point={contentPoint} panActive={()=>space.current} width={extent.width} height={extent.height} color={annotationColor} thickness={annotationThickness} focusId={annotationFocus} focused={()=>setAnnotationFocus(null)}/>
  </div>{rectangle&&<div className="marquee" style={rectangle}/>}</div>{board.cards.length===0&&<div className="empty">A fresh board.<br/><small>Add a note or drop an image to start.</small></div>}</div>


  {paintSource&&!selected.length&&!selectedAnnotation&&!connection&&<div className="format-hint" role="status">Format Painter: select a compatible target. <button onClick={()=>setPaintSource(null)}>Cancel</button></div>}
  {!creation.tool&&annotationTool==='select'&&!connectorTool&&<SelectionOverlay board={board} ids={selected} zoom={zoom} viewport={viewport} writable={writable} group={groupItems} ungroup={ungroupItems}/>}
  {creation.tool&&<div className="creation-instructions" role="status">Place {creation.tool}: click or tap the canvas, or press Enter to place in view. Escape cancels.</div>}
  <AnnotationToolbar shape={annotationShape} setShape={setAnnotationShape} tool={annotationTool} setTool={chooseAnnotationTool} writable={writable} color={annotationColor} setColor={setAnnotationColor} thickness={annotationThickness} setThickness={setAnnotationThickness} change={changeAnnotation} remove={remove}/>
  {connectorTool&&<div className="connector-hint" role="status">{connectorSource?'Choose the destination item':'Choose the first item to connect'}<button onClick={()=>{creation.cancel();setConnectorTool(false);setConnectorSource(null);setSelected([]);}}>Cancel</button></div>}
  <div className="zoom"><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><button onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2,z+.1))}>+</button></div>

  {quickBounds&&!editingCard&&!area&&!gesturing&&annotationTool==='select'&&!connectorTool&&<ElementToolbar bounds={quickBounds} viewport={viewport} zoom={zoom} duplicate={writable&&!connection&&selected.some(id=>board.cards.some(c=>c.id===id&&c.kind!=='board')||board.annotations?.some(a=>a.id===id))?duplicate:undefined} remove={writable?remove:undefined} comment={commentTarget&&!(repository instanceof SharedRepository)?()=>{if(repository instanceof TeamRepository&&writable)setCommentCompose(prev=>({key:prev.key+1,target:commentTarget}));}:undefined} commentReason={!writable?'Viewers can read comments but cannot post.':!(repository instanceof TeamRepository)?'Open a team workspace to comment.':undefined} crop={writable&&teamId&&activeCard?.kind==='image'?()=>openMedia(activeCard.id,true):undefined} color={displayBoard.cards.find(c=>c.id===activeCard?.id)?.color} changeColor={writable&&activeCard?.kind==='note'?color=>changeCard(activeCard.id,{color}):undefined}/>}
  {teamId&&board.cards.some(c=>c.id===mediaId&&['image','video'].includes(c.kind))&&<MediaViewer key={mediaId} card={board.cards.find(c=>c.id===mediaId)!} media={board.cards.filter(c=>['image','video'].includes(c.kind))} assetBase={repository instanceof SharedRepository?`/api/viewer/${repository.linkId}/assets`:`/api/workspaces/${teamId}/assets`} writable={writable} check={async()=>{if(repository instanceof SharedRepository)await api(`/viewer/${repository.linkId}/workspace`);else await api(`/workspaces/${teamId}`);}} save={(edit,expected,assetId)=>saveImageEdit(mediaId!,edit,expected,assetId)} startCrop={mediaStartCrop} navigate={openMedia} close={()=>setMediaId(null)} onDirty={setMediaDirty}/>}
  <div className="touch-navigation" role="toolbar" aria-label="Touch navigation"><button aria-pressed={touchMode==='pan'} onClick={()=>{setTouchMode('pan');setAnnotationTool('select');setConnectorTool(false);}}>Pan</button>{writable&&<button aria-pressed={touchMode==='edit'} onClick={()=>{setTouchMode('edit');setAnnotationTool('select');setConnectorTool(false);}}>Move items</button>}<button aria-pressed={touchMulti} onClick={()=>setTouchMulti(value=>!value)}>Multi-select</button></div>
  <footer>{teamId?`${live?.role??(repository as TeamRepository).role} | Live team workspace | ${new Set(live?.members.map(m=>m.userId)).size} online`:'Browser-local canvas | No team sync'} · Space-drag to pan · Shift-click to select</footer>
 </main></div>;
}
