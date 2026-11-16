import express,{type Express,type Request} from 'express';
import {randomBytes} from 'node:crypto';
import {type Pool} from 'pg';
import {z} from 'zod';
import {type FlowSettings} from './flow-integration';
import {type RealtimeHooks} from './realtime';
import {approveFlowEdit,flowEditHash} from './flow-edit-store';
import {operationSchema} from './operations';
import {type Workspace} from '../src/model';
import {HttpError} from './workspace-store';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function flowEditReview(app:Express,pool:Pool,settings:FlowSettings,actor:(req:Request)=>Promise<string>){
 app.use('/flow-edit-review',app.locals.sessionMiddleware,express.urlencoded({extended:false,limit:'2kb'}));
 app.get('/flow-edit-review/:id',async(req,res)=>{
  const userId=await actor(req),id=z.string().uuid().parse(req.params.id);
  const item=(await pool.query('SELECT e.*,w.name,w.revision,w.snapshot AS current_snapshot,m.role FROM flow_edits e JOIN team_workspaces w ON w.id=e.workspace_id JOIN memberships m ON m.workspace_id=e.workspace_id AND m.user_id=e.user_id WHERE e.id=$1 AND e.user_id=$2',[id,userId])).rows[0];
  if(!item||!settings.workspaceIds?.includes(item.workspace_id))throw new HttpError(404,'Edit review not found');
  if(item.role==='viewer')throw new HttpError(403,'Current edit permission required');
  const operation=operationSchema.parse(item.operation);
  if(flowEditHash(operation)!==item.payload_hash)throw new HttpError(409,'Review content changed');
  const applied=item.applied_revision!==null;
  if(!applied&&new Date(item.expires_at).getTime()<=Date.now())throw new HttpError(410,'Review expired. Prepare a new review.');
  if(!applied&&item.revision!==operation.baseRevision)throw new HttpError(409,'Workspace changed. Prepare a new review.');
  req.session.csrf??=randomBytes(32).toString('hex');
  const changes=operation.changes.map((change,index)=>{
   const board=(item.current_snapshot as Workspace).boards.find(b=>b.id===change.boardId);
   const card=board?.cards.find(c=>c.id===change.cardId);
   const object=card?(card.title||card.text||card.id).slice(0,100):change.annotationId??change.cardId??'board';
   return '<section><h2>Change '+(index+1)+': '+escape(change.field)+'</h2><p>Board: '+escape(board?.title??change.boardId)+' ('+escape(change.boardId)+'); object: '+escape(object)+'</p><h3>Before</h3><pre>'+escape(JSON.stringify(change.before,null,2))+'</pre><h3>After</h3><pre>'+escape(JSON.stringify(change.after,null,2))+'</pre></section>';
  }).join('');
  res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Review Flow edits</title><main><h1>Review edits to '+escape(item.name)+'</h1><p>Account: '+escape(settings.email)+'. Review every change below. Existing unrelated content is preserved.</p>'+changes+(applied?'<p>Changes already applied. <a href="/">Open Boardroom</a>.</p>':'<form method="post"><input type="hidden" name="csrf" value="'+escape(req.session.csrf)+'"><button type="submit">Apply reviewed changes</button></form>')+'</main></html>');
 });
 app.post('/flow-edit-review/:id',async(req,res)=>{
  const userId=await actor(req),id=z.string().uuid().parse(req.params.id);
  if(req.get('origin')!==settings.origin||!req.session.csrf||req.body?.csrf!==req.session.csrf)throw new HttpError(403,'Invalid origin or CSRF token');
  // The form never accepts replacement content. Only the persisted exact intent
  // may be applied, with authorization and revision checked inside its transaction.
  if(Object.keys(req.body).some(key=>key!=='csrf'))throw new HttpError(400,'Unexpected approval fields');
  const result=await approveFlowEdit(pool,settings,id,{id:userId,version:req.session.authVersion??0});
  try{await (app.locals.realtime as RealtimeHooks|undefined)?.publish(result.workspaceId,result.operationId);}catch{
   // A committed change must not be presented as failed if live notification fails.
   app.locals.logger?.({event:'flow_edit_publish_failed',level:'error'});
  }
  res.redirect(303,'/flow-edit-review/'+id);
 });
}
