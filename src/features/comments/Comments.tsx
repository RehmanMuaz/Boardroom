import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api,ApiError} from '../../repository';
import {type Board} from '../../model';
import {type CommentDetail,type CommentOverview} from '../../comments';
import {containDialogKeys} from '../dialogFocus';
import './comments.css';

export function Comments({workspaceId,board,boards,selectedCard,writable,openRequest=0,onDirty}:{workspaceId:string;board:Board;boards:Board[];selectedCard?:string;writable:boolean;openRequest?:number;onDirty:(dirty:boolean)=>void}){
 const [open,setOpen]=useState(false),[overview,setOverview]=useState<CommentOverview|null>(null),[detail,setDetail]=useState<CommentDetail|null>(null),[threadId,setThreadId]=useState<string|null>(null),[creating,setCreating]=useState(false),[body,setBody]=useState(''),[target,setTarget]=useState(''),[filter,setFilter]=useState('open'),[scope,setScope]=useState('board'),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unavailable,setUnavailable]=useState(false),[discard,setDiscard]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),textarea=useRef<HTMLTextAreaElement>(null),retry=useRef<{key:string;id:string}|null>(null),sending=useRef(false),pending=useRef<()=>void>(()=>{}),mounted=useRef(true),listGeneration=useRef(0),detailGeneration=useRef(0),activeThread=useRef(threadId);activeThread.current=threadId;
 const queryContext=useRef({workspaceId,boardId:board.id,filter,offset,scope});queryContext.current={workspaceId,boardId:board.id,filter,offset,scope};
 const draft=body.trim().length>0;
 useEffect(()=>{onDirty(draft||busy);return()=>onDirty(false);},[draft,busy,onDirty]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;listGeneration.current++;detailGeneration.current++;};},[]);
 function failure(e:unknown){if(!mounted.current)return;setError(e instanceof Error?e.message:'Comments unavailable');if(e instanceof ApiError&&[401,403,404].includes(e.status)){setUnavailable(true);setOverview(null);setDetail(null);}}
 async function refresh(){const generation=++listGeneration.current,q=queryContext.current;try{const value=await api<CommentOverview>(`/workspaces/${q.workspaceId}/comments?boardId=${encodeURIComponent(q.boardId)}&filter=${q.filter}&offset=${q.offset}&scope=${q.scope}`);if(mounted.current&&generation===listGeneration.current){setOverview(value);setUnavailable(false);}}catch(e){if(generation===listGeneration.current)failure(e);}}
 async function load(id:string){const generation=++detailGeneration.current;try{const value=await api<CommentDetail>(`/workspaces/${workspaceId}/comments/${id}`);if(!mounted.current||generation!==detailGeneration.current||activeThread.current!==id)return;setDetail(value);await api(`/workspaces/${workspaceId}/comments/${id}/read`,'POST',{version:value.thread.version});await refresh();}catch(e){if(generation===detailGeneration.current)failure(e);}}
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},open?5000:15000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);listGeneration.current++;};},[workspaceId,board.id,filter,offset,scope,open]);
 useEffect(()=>{if(open){dialog.current?.showModal();}else if(dialog.current?.open){dialog.current.close();trigger.current?.focus();}},[open]);
 useEffect(()=>{if(openRequest>0){setOpen(true);setError('');}},[openRequest]);
 useEffect(()=>{if(!open||!threadId)return;void load(threadId);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(threadId);},5000);return()=>{clearInterval(timer);detailGeneration.current++;};},[open,threadId]);
 useEffect(()=>{if(creating&&open)textarea.current?.focus();},[creating,open]);
 function request(action:()=>void){if(busy)return;if(draft){pending.current=action;setDiscard(true);}else action();}
 function choose(id:string){request(()=>{setBody('');setCreating(false);setDetail(null);activeThread.current=id;setThreadId(id);setError('');if(threadId===id)void load(id);});}
 function newThread(){request(()=>{setThreadId(null);activeThread.current=null;detailGeneration.current++;setDetail(null);setCreating(true);setBody('');setTarget(selectedCard&&board.cards.some(c=>c.id===selectedCard)?selectedCard:'');setError('');requestAnimationFrame(()=>textarea.current?.focus());});}
 async function send(){if(!body.trim()||!writable||unavailable||sending.current)return;sending.current=true;setBusy(true);setError('');try{
  const key=JSON.stringify({threadId,creating,body,target,board:board.id});if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};const id=retry.current.id;
  if(creating){await api(`/workspaces/${workspaceId}/comments`,'POST',{id,body,boardId:board.id,...(target?{cardId:target}:{})});activeThread.current=id;setThreadId(id);setCreating(false);setBody('');await load(id);}
  else if(threadId){await api(`/workspaces/${workspaceId}/comments/${threadId}/messages`,'POST',{id,body});setBody('');await load(threadId);}
  retry.current=null;await refresh();
 }catch(e){failure(e);}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 async function resolve(){if(!detail||!writable||busy)return;setBusy(true);setError('');try{await api(`/workspaces/${workspaceId}/comments/${detail.thread.id}`,'PATCH',{resolved:!detail.thread.resolved,expectedVersion:detail.thread.version});await load(detail.thread.id);await refresh();}catch(e){failure(e);if(detail)await load(detail.thread.id);}finally{if(mounted.current)setBusy(false);}}
 function close(){request(()=>{setOpen(false);setCreating(false);setThreadId(null);activeThread.current=null;setDetail(null);setBody('');});}
 const cardTitle=(id:string|null)=>id?(board.cards.find(c=>c.id===id)?.text.trim().slice(0,60)||'Card'): 'Board discussion';
 return <><button ref={trigger} className="board-comments-trigger" aria-haspopup="dialog" aria-label={`Comments${overview?.unread?`, ${overview.unread} unread`:''}`} onClick={()=>{setOpen(true);setError('');}}>Comments{overview?.unread?<span className="comment-count">{overview.unread}</span>:null}{overview?.mentions?<span className="comment-count" title="Unread mentions">@{overview.mentions}</span>:null}</button>{createPortal(<dialog ref={dialog} className="comments-dialog settings-dialog" aria-labelledby="comments-heading" onKeyDown={containDialogKeys} onCancel={e=>{e.preventDefault();close();}}>
  <div className="settings-dialog-header"><div><h2 id="comments-heading">Comments</h2><p>{board.title}</p></div><button onClick={close} disabled={busy} aria-label="Close comments">Close</button></div>
  {discard?<div role="alert"><h3>Discard your comment draft?</h3><p>Your message has not been posted.</p><button onClick={()=>setDiscard(false)}>Keep writing</button><button onClick={()=>{setBody('');setDiscard(false);pending.current();}}>Discard draft</button></div>:<div className="comments-content">
   <div className="comments-status">Team discussions are private. Client links do not include comments.{!writable&&' You have read-only access.'}<button className="comments-unread" onClick={()=>{setScope('workspace');setFilter('unread');setOffset(0);}} aria-live="polite">{overview?.unread??0} unread across workspace{overview?.mentions?` / ${overview.mentions} mentions`:''}</button></div>
   {error&&<div className="comments-error" role="alert">{error}<button onClick={()=>{setError('');void refresh();if(threadId)void load(threadId);}}>Retry</button></div>}
   {!unavailable&&<div className={'comments-columns'+(creating||threadId?' has-thread':'')}>
    <section className="comment-list" aria-label="Comment threads"><label className="comments-scope">Discussion location<select aria-label="Discussion location" value={scope} onChange={e=>{setScope(e.target.value);setOffset(0);}}><option value="board">This board</option><option value="workspace">All boards</option></select></label><div className="comment-list-tools"><label>Show<select value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}}><option value="open">Open</option><option value="unread">Unread</option><option value="resolved">Resolved</option><option value="all">All threads</option></select></label><button disabled={!writable||busy} onClick={newThread}>New thread</button></div>
     {!overview?<p role="status">Loading comments...</p>:!overview.threads.length?<p>No {filter==='all'?'':filter+' '}threads in this view.</p>:overview.threads.map(t=><button key={t.id} className={'comment-thread'+(threadId===t.id?' active':'')} aria-current={threadId===t.id?'true':undefined} onClick={()=>choose(t.id)}><strong>{t.board_id===board.id?cardTitle(t.card_id):(boards.find(b=>b.id===t.board_id)?.title??'Removed board')+(t.card_id?' / Card':' / Board discussion')}</strong><span>{t.preview}</span><small>{t.resolved?'Resolved':t.unread?'Unread':'Read'}{t.mentioned?' / Mentioned':''} / {t.count} {t.count===1?'message':'messages'}</small></button>)}
     {overview&&overview.total>30&&<nav aria-label="Comment pages"><button disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-30))}>Previous</button><span>{offset+1}-{Math.min(offset+30,overview.total)} of {overview.total}</span><button disabled={offset+30>=overview.total} onClick={()=>setOffset(n=>n+30)}>Next</button></nav>}
    </section>
    <section className="comment-conversation" aria-label="Conversation">
     {creating||threadId?<button className="comments-back" onClick={()=>request(()=>{setCreating(false);setThreadId(null);activeThread.current=null;setDetail(null);setBody('');})}>Back to threads</button>:null}
     {!creating&&!threadId?<div className="comments-empty"><h3>Feedback in context</h3><p>Choose a thread, or start one for this board or a selected card.</p></div>:creating?<h3>New discussion</h3>:!detail?<p role="status">Loading thread...</p>:<>
      <div className="comment-conversation-heading"><h3>{detail.thread.board_id===board.id?cardTitle(detail.thread.card_id):(boards.find(b=>b.id===detail.thread.board_id)?.title??'Removed board')+(detail.thread.card_id?' / Card':'')}</h3><button disabled={!writable||busy||draft} onClick={()=>void resolve()}>{detail.thread.resolved?'Reopen thread':'Resolve thread'}</button></div>
      {detail.targetMissing&&<p className="comments-orphan">The original card or board was removed. This discussion is preserved.</p>}
      <ol className="comment-messages">{detail.messages.map(m=><li key={m.id}><div><strong>{m.author??'Former member'}</strong><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time></div><p>{m.body}</p>{m.mentions.length>0&&<small>Mentions: {m.mentions.join(', ')}</small>}</li>)}</ol>
      {detail.thread.resolved&&<p className="comments-orphan">Resolved. Reopen this thread to add a reply.</p>}
     </>}
     {(creating||detail&&!detail.thread.resolved)&&writable&&<form className="comment-composer" onSubmit={e=>{e.preventDefault();void send();}}>
      {creating&&<label>Attach to<select aria-label="Comment target" value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">This board</option>{board.cards.map(c=><option key={c.id} value={c.id}>{cardTitle(c.id)}</option>)}</select></label>}
      <label>{creating?'Comment':'Reply'}<textarea ref={textarea} aria-label={creating?'Comment':'Reply'} value={body} maxLength={4000} rows={4} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Share feedback. Add a teammate mention below."/></label>
      <div className="comment-composer-tools"><label className="comment-mention-label">Mention teammate<select aria-label="Mention teammate" value="" disabled={busy} onChange={e=>{if(e.target.value){setBody(s=>(s+(s&&!/\s$/.test(s)?' ':'')+'@'+e.target.value+' ').slice(0,4000));requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.setSelectionRange(4000,4000);});}}}><option value="">Add @mention</option>{overview?.members.map(m=><option key={m.id} value={m.email}>{m.email}</option>)}</select></label><span>{body.length}/4000</span><button className="button-primary" type="submit" disabled={busy||!body.trim()}>{busy?'Posting...':creating?'Post comment':'Post reply'}</button></div>
     </form>}
    </section>
   </div>}
  </div>}
 </dialog>,document.body)}</>;
}
