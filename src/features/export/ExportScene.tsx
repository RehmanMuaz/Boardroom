import {cardStyleCss} from '../../workspaceStyles';
import {type Board,type RichRun} from '../../model';
import {automaticTextColor} from '../../annotations';
import {cardWidth,cardHeight,mediaFooterHeight} from '../canvas/domain';
import {cardLayer,columnSummary} from '../canvas/organization';
import {NoteLabels} from '../content/NoteLabels';
import {AnnotationLayer} from '../annotations/AnnotationLayer';
import {ConnectorLayer} from '../canvas/ConnectorLayer';
import {boardCanvasStyle} from '../../boardAppearance';
import {type Rect} from './pdf-layout';
const nothing=()=>{};
function runText(run:RichRun,index:number){return <span key={index} style={{fontWeight:run.bold?700:undefined,fontStyle:run.italic?'italic':undefined,textDecoration:run.underline?'underline':undefined}}>{run.text}</span>;}
export function ExportScene({board,region,scale,width,height,images={}}:{board:Board;region:Rect;scale:number;width:number;height:number;images?:Record<string,string>}){
 const canvasWidth=Math.max(region.x+region.width,...board.cards.map(c=>c.x+cardWidth(c))),canvasHeight=Math.max(region.y+region.height,...board.cards.map(c=>c.y+cardHeight(c)));
 return <div className="pdf-page-scene" style={{width,height,overflow:'hidden',position:'relative',background:board.background??'var(--canvas)'}}><div className="pdf-world" style={{position:'absolute',width:canvasWidth,height:canvasHeight,transformOrigin:'0 0',transform:`scale(${scale}) translate(${-region.x}px,${-region.y}px)`,isolation:'isolate',...boardCanvasStyle(board.background,board.pattern)}}>
  {board.cards.filter(c=>c.x+cardWidth(c)>=region.x&&c.x<=region.x+region.width&&c.y+cardHeight(c)>=region.y&&c.y<=region.y+region.height).map(c=><article key={c.id} className={'card pdf-card '+c.kind+(c.styleBinding?' workspace-styled':'')} style={{left:c.x,top:c.y,width:cardWidth(c),height:cardHeight(c),background:c.color,color:automaticTextColor(c.color),zIndex:cardLayer(board,c),overflow:'hidden',padding:['image','video'].includes(c.kind)?0:16,...cardStyleCss(c)}}>
   {c.kind==='note'?<><NoteLabels labels={c.labels} editable={false} change={nothing}/>{c.richText?<div className="rich-note">{c.richText.blocks.map((block,index)=>block.type==='heading'?<h3 key={index}>{block.runs.map(runText)}</h3>:block.type==='quote'?<blockquote key={index}>{block.runs.map(runText)}</blockquote>:<div key={index} className={block.type==='bullet'?'rich-bullet':undefined} style={{minHeight:'1em',marginBottom:8}}>{block.runs.map(runText)}</div>)}</div>:<div style={{whiteSpace:'pre-wrap',lineHeight:1.65}}>{c.text}</div>}</>:
    c.kind==='image'?<><div style={{height:cardHeight(c)-mediaFooterHeight(c),display:'grid',placeItems:'center',background:'var(--surface)'}}>{images[c.assetId!]?<img alt="" src={images[c.assetId!]} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span>Image</span>}</div>{c.captionVisible!==false&&<div className="pdf-caption">{c.text}</div>}</>:
    c.kind==='checklist'?<><strong>{c.title||'Untitled list'}</strong>{c.text.split('\n').map((line,i)=><div key={i} style={{display:'flex',gap:10,marginTop:12}}><span>{line.startsWith('[x] ')?'☑':'☐'}</span><span style={{textDecoration:line.startsWith('[x] ')?'line-through':undefined}}>{line.replace(/^\[x\] /,'')}</span></div>)}</>:
    c.kind==='column'?<><strong>{c.text}</strong><p className="column-summary">{columnSummary(board,c.id)}</p></>:
    c.kind==='video'||c.kind==='file'?<div className="pdf-media-label"><strong>{c.kind==='video'?'▶ Video':'File'}</strong><span>{c.text||'Uploaded '+c.kind}</span><small>Open the workspace to {c.kind==='video'?'play':'download'} this {c.kind}.</small></div>:
    c.kind==='board'?<div className="pdf-media-label"><strong>Board</strong><span>{c.text}</span><small>Nested board content is not included.</small></div>:<div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.text}</div>}
  </article>)}
  <ConnectorLayer board={board} width={canvasWidth} height={canvasHeight} selected={null} select={nothing} interactive={false}/>
  <AnnotationLayer annotations={board.annotations??[]} canvasBackground={board.background} shape="arrow" tool="select" writable={false} selectedId={null} selectedIds={[]} onEnter={()=>{}} startMove={()=>{}} onSelect={nothing} add={nothing} change={nothing} point={()=>({x:0,y:0})} panActive={()=>false} width={canvasWidth} height={canvasHeight} color="#000000" thickness={3} focusId={null} focused={nothing}/>
 </div></div>;
}
