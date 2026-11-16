import {Router,type Request} from 'express';
import {type Pool,type PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError} from './workspace-store';
import {type Workspace} from '../src/model';
import {mentionedMembers,type CommentMember} from '../src/comments';

const uuid=z.string().uuid(),anchor=z.string().min(1).max(128);
const message=z.object({id:uuid,body:z.string().trim().min(1).max(4000)}).strict();
export function commentsRouter(pool:Pool){
 const router=Router({mergeParams:true});
 async function transaction<T>(req:Request,write:boolean,run:(db:PoolClient,id:string)=>Promise<T>){
  const id=uuid.parse(req.params.id),db=await pool.connect();
  try{await db.query('BEGIN');
   // Match canvas lock ordering, so deletion/import and membership revocation serialize with writes.
   if(write)await db.query('SELECT id FROM team_workspaces WHERE id=$1 FOR UPDATE',[id]);
   const role=(await db.query('SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',[id,req.session.userId])).rows[0]?.role;
   if(!role)throw new HttpError(404,'Workspace not found');if(write&&role==='viewer')throw new HttpError(403,'Viewers can read comments, but cannot post or resolve them');
   const result=await run(db,id);await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new HttpError(409,'Comment ID already used');throw e;}finally{db.release();}
 }
 async function thread(db:PoolClient,id:string,threadId:unknown){const row=(await db.query('SELECT * FROM comment_threads WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[id,uuid.parse(threadId)])).rows[0];if(!row)throw new HttpError(404,'Comment thread not found');return row;}
 async function members(db:PoolClient,id:string){return (await db.query('SELECT a.id,a.email,m.role FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE m.workspace_id=$1 ORDER BY a.email',[id])).rows as CommentMember[];}
 async function insert(db:PoolClient,id:string,t:{id:string;version:number},userId:string,body:z.infer<typeof message>){
  await db.query('INSERT INTO comment_messages(id,thread_id,author_id,body,version) VALUES ($1,$2,$3,$4,$5)',[body.id,t.id,userId,body.body,t.version]);
  for(const user of mentionedMembers(body.body,await members(db,id)))if(user!==userId)await db.query('INSERT INTO comment_mentions(message_id,user_id) VALUES ($1,$2)',[body.id,user]);
  await read(db,t.id,userId,t.version);
 }
 async function read(db:PoolClient,id:string,user:string,version:number){await db.query('INSERT INTO comment_reads(thread_id,user_id,version) VALUES ($1,$2,$3) ON CONFLICT(thread_id,user_id) DO UPDATE SET version=GREATEST(comment_reads.version,EXCLUDED.version)',[id,user,version]);}
 const unread="t.version>COALESCE(r.version,0)";
 const mentioned="EXISTS(SELECT 1 FROM comment_messages mm JOIN comment_mentions mn ON mn.message_id=mm.id WHERE mm.thread_id=t.id AND mn.user_id=$2 AND mm.version>COALESCE(r.version,0))";
 const columns=`t.id,t.board_id,t.card_id,t.resolved,t.version,t.updated_at,${unread} AS unread,${mentioned} AS mentioned,(SELECT left(body,160) FROM comment_messages WHERE thread_id=t.id ORDER BY version DESC LIMIT 1) AS preview,(SELECT count(*)::int FROM comment_messages WHERE thread_id=t.id) AS count`;
 router.get('/',async(req,res)=>{
  const q=z.object({boardId:anchor,offset:z.coerce.number().int().min(0).max(100000).default(0),filter:z.enum(['open','resolved','unread','all']).default('open'),scope:z.enum(['board','workspace']).default('board')}).strict().parse(req.query);
  res.json(await transaction(req,false,async(db,id)=>{
   const where=q.filter==='all'?'true':q.filter==='unread'?unread:q.filter==='resolved'?'t.resolved':'NOT t.resolved';
   const scope=q.scope==='workspace'?'($3::text IS NOT NULL)':'t.board_id=$3';
   const args=[id,req.session.userId,q.boardId],from=`FROM comment_threads t LEFT JOIN comment_reads r ON r.thread_id=t.id AND r.user_id=$2 WHERE t.workspace_id=$1`;
   const threads=await db.query(`SELECT ${columns} ${from} AND ${scope} AND ${where} ORDER BY t.updated_at DESC,t.id LIMIT 30 OFFSET $4`,[...args,q.offset]);
   const total=await db.query(`SELECT count(*)::int AS total ${from} AND ${scope} AND ${where}`,args);
   const counts=await db.query(`SELECT count(*) FILTER(WHERE ${unread})::int AS unread,count(*) FILTER(WHERE ${mentioned})::int AS mentions ${from}`,[id,req.session.userId]);
   return {threads:threads.rows,members:await members(db,id),total:total.rows[0].total,...counts.rows[0]};
  }));
 });
 router.get('/:threadId',async(req,res)=>res.json(await transaction(req,false,async(db,id)=>{
  const t=await thread(db,id,req.params.threadId),snapshot=(await db.query('SELECT snapshot FROM team_workspaces WHERE id=$1',[id])).rows[0].snapshot as Workspace,board=snapshot.boards.find(b=>b.id===t.board_id);
  const messages=await db.query('SELECT m.id,m.body,m.version,m.created_at,a.email AS author,ARRAY(SELECT a2.email FROM comment_mentions mn JOIN accounts a2 ON a2.id=mn.user_id JOIN memberships mb ON mb.user_id=mn.user_id AND mb.workspace_id=$2 WHERE mn.message_id=m.id) AS mentions FROM comment_messages m LEFT JOIN accounts a ON a.id=m.author_id WHERE m.thread_id=$1 ORDER BY m.version',[t.id,id]);
  const summary=(await db.query(`SELECT ${columns} FROM comment_threads t LEFT JOIN comment_reads r ON r.thread_id=t.id AND r.user_id=$2 WHERE t.id=$1`,[t.id,req.session.userId])).rows[0];
  return {thread:summary,messages:messages.rows,targetMissing:!board||!!t.card_id&&!board.cards.some(c=>c.id===t.card_id)};
 })));
 router.post('/',async(req,res)=>{
  const body=message.extend({boardId:anchor,cardId:anchor.optional()}).strict().parse(req.body);
  res.status(201).json(await transaction(req,true,async(db,id)=>{
   const prior=(await db.query('SELECT t.*,m.body,m.author_id FROM comment_threads t JOIN comment_messages m ON m.thread_id=t.id AND m.version=1 WHERE t.id=$1',[body.id])).rows[0];
   if(prior){if(prior.workspace_id!==id||prior.author_id!==req.session.userId||prior.board_id!==body.boardId||prior.card_id!==(body.cardId??null)||prior.body!==body.body)throw new HttpError(409,'Comment ID already used');return {id:prior.id};}
   const snapshot=(await db.query('SELECT snapshot FROM team_workspaces WHERE id=$1',[id])).rows[0].snapshot as Workspace,board=snapshot.boards.find(b=>b.id===body.boardId);
   if(!board||body.cardId&&!board.cards.some(c=>c.id===body.cardId))throw new HttpError(404,'Comment target not found');
   await db.query('INSERT INTO comment_threads(id,workspace_id,board_id,card_id) VALUES ($1,$2,$3,$4)',[body.id,id,body.boardId,body.cardId??null]);
   await insert(db,id,{id:body.id,version:1},req.session.userId!,body);return {id:body.id};
  }));
 });
 router.post('/:threadId/messages',async(req,res)=>{
  const body=message.parse(req.body);res.status(201).json(await transaction(req,true,async(db,id)=>{
   const t=await thread(db,id,req.params.threadId),prior=(await db.query('SELECT * FROM comment_messages WHERE id=$1',[body.id])).rows[0];
   if(prior){if(prior.thread_id!==t.id||prior.author_id!==req.session.userId||prior.body!==body.body)throw new HttpError(409,'Comment ID already used');return {id:body.id};}
   if(t.resolved)throw new HttpError(409,'Reopen this thread before replying');
   if(Number((await db.query('SELECT count(*) FROM comment_messages WHERE thread_id=$1',[t.id])).rows[0].count)>=200)throw new HttpError(409,'Thread is full. Start a new thread.');
   t.version++;await db.query('UPDATE comment_threads SET version=$2,updated_at=now() WHERE id=$1',[t.id,t.version]);await insert(db,id,t,req.session.userId!,body);return {id:body.id};
  }));
 });
 router.patch('/:threadId',async(req,res)=>{
  const body=z.object({resolved:z.boolean(),expectedVersion:z.number().int().positive()}).strict().parse(req.body);
  res.json(await transaction(req,true,async(db,id)=>{const t=await thread(db,id,req.params.threadId);if(t.version!==body.expectedVersion)throw new HttpError(409,'Thread changed. Review the latest replies before resolving.');await db.query('UPDATE comment_threads SET resolved=$2,version=version+1,updated_at=now() WHERE id=$1',[t.id,body.resolved]);await read(db,t.id,req.session.userId!,t.version+1);return {id:t.id};}));
 });
 router.post('/:threadId/read',async(req,res)=>{
  const {version}=z.object({version:z.number().int().positive()}).strict().parse(req.body);
  // Read receipts are personal, including for viewers; they do not grant canvas write access.
  await transaction(req,false,async(db,id)=>{const t=await thread(db,id,req.params.threadId);if(version>t.version)throw new HttpError(400,'Invalid read version');await read(db,t.id,req.session.userId!,version);});res.sendStatus(204);
 });
 return router;
}
