import {type Workspace,validWorkspace} from './model';
import {diffWorkspace,applyChanges,type Operation} from './operations';

export type Role='owner'|'editor'|'viewer';
export type Presence={connectionId:string;userId:string;email:string;boardId?:string};
export type LiveView={snapshot:Workspace;role:Role;status:string;dirty:boolean;blocked:boolean;members:Presence[];external:boolean};
type SnapshotMessage={snapshot:Workspace;revision:number;role?:Role;operationId?:string};

// A single local optimistic writer overlays pending operations on server snapshots.
// Pending operations stay in this tab, never in the browser-local workspace.
export class LiveRepository {
 revision=0;role:Role='viewer';
 private canonical!:Workspace;
 private optimistic!:Workspace;
 private pending:Operation[]=[];
 private socket?:WebSocket;
 private listener?:(view:LiveView)=>void;
 private members:Presence[]=[];
 private connected=false;
 private stopped=true;
 private blocked=false;
 private failure='';
 private retry?:ReturnType<typeof setTimeout>;
 private ackTimeout?:ReturnType<typeof setTimeout>;
 private inflight?:string;
 private backoff=500;
 private boardId?:string;
 private sentBoardId?:string;
 constructor(public id:string,private token:()=>string){}
 initialize(snapshot:Workspace,revision:number,role:Role){this.canonical=structuredClone(snapshot);this.optimistic=structuredClone(snapshot);this.revision=revision;this.role=role;}
 start(listener:(view:LiveView)=>void){this.listener=listener;this.stopped=false;this.connect();window.addEventListener('online',this.online);this.emit();return()=>this.stop();}
 private online=()=>{if(!this.connected&&!this.blocked&&!this.stopped){clearTimeout(this.retry);this.connect();}};
 private stop(){this.stopped=true;clearTimeout(this.retry);clearTimeout(this.ackTimeout);window.removeEventListener('online',this.online);this.socket?.close();this.listener=undefined;}
 private emit(external=false){this.listener?.({snapshot:this.optimistic,role:this.role,status:this.failure||(this.connected?(this.pending.length?'Saving...':'Saved to team database | Live'):(this.pending.length?'Offline | Edits queued in this tab':'Offline | Reconnecting...')),dirty:this.pending.length>0,blocked:this.blocked,members:this.members,external});}
 private connect(){
  if(this.stopped||this.blocked)return;
  if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/live`);this.socket=ws;
  ws.onopen=()=>ws.send(JSON.stringify({type:'subscribe',workspaceId:this.id,csrf:this.token()}));
  ws.onmessage=event=>{
   if(ws!==this.socket||this.stopped)return;
   try{
    const message=JSON.parse(event.data);
    if(message.type==='snapshot'||message.type==='ack'){
     if(!validWorkspace(message.snapshot)||!Number.isInteger(message.revision)||message.revision<0)throw Error('Invalid live snapshot');
     if(typeof message.name==='string'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('boardroom:workspace-name',{detail:{id:this.id,name:message.name}}));
     const own=this.pending.some(op=>op.id===message.operationId);
     if(message.type==='ack'){
      if(message.operationId!==this.pending[0]?.id)throw Error('Unexpected acknowledgement');
      this.pending.shift();clearTimeout(this.ackTimeout);this.inflight=undefined;
     }
     this.connected=true;this.backoff=500;
     this.receive(message,message.type==='snapshot'&&!own);
     this.flush();if(this.boardId)this.presence(this.boardId);
    }else if(message.type==='presence'){this.members=message.members;this.emit();}
    else if(message.type==='role'){if(message.role!==this.role){this.role=message.role;if(this.role==='viewer'&&this.pending.length){this.blocked=true;this.failure='Write permission removed. Export queued edits.';}this.emit();}}
    else if(message.type==='revoked'){this.blocked=true;this.role='viewer';this.failure=message.error+' Export any unsaved edits.';this.members=[];this.emit();ws.close();}
    else if(message.type==='error'){
     if(message.status>=500){ws.close();return;}
     this.blocked=true;this.failure=message.error+' Export your edits before reloading.';clearTimeout(this.ackTimeout);this.emit();
    }
   }catch(e){this.blocked=true;this.failure=e instanceof Error?e.message:'Invalid server message';this.emit();ws.close();}
  };
  ws.onclose=()=>{if(ws!==this.socket)return;this.connected=false;this.inflight=undefined;this.sentBoardId=undefined;this.members=[];clearTimeout(this.ackTimeout);this.emit();if(!this.stopped&&!this.blocked){this.retry=setTimeout(()=>this.connect(),this.backoff);this.backoff=Math.min(10000,this.backoff*2);}};
  ws.onerror=()=>ws.close();
 }
 private receive(message:SnapshotMessage,external:boolean){
  const changed=message.revision>this.revision;
  if(message.revision>=this.revision){this.revision=message.revision;this.canonical=structuredClone(message.snapshot);if(message.role)this.role=message.role;}
  if(!this.blocked){try{let next=this.canonical;for(const op of this.pending)next=applyChanges(next,op.changes,false);this.optimistic=next;}catch{this.blocked=true;this.failure='A board or card changed while you were editing. Export your edits before reloading.';}}
  this.emit(external&&changed);
 }
 change(before:Workspace,after:Workspace){
  if(this.blocked||this.role==='viewer')return;
  const changes=diffWorkspace(before,after);if(!changes.length)return;
  this.pending.push({id:crypto.randomUUID(),baseRevision:this.revision,changes});this.optimistic=after;this.emit();this.flush();
 }
 private flush(){
  if(!this.connected||this.blocked||this.inflight||!this.pending.length||this.socket?.readyState!==WebSocket.OPEN)return;
  const operation=this.pending[0];this.inflight=operation.id;this.socket.send(JSON.stringify({type:'operation',operation}));
  this.ackTimeout=setTimeout(()=>this.socket?.close(),5000);
 }
 presence(boardId:string){this.boardId=boardId;const active=this.canonical.boards.some(board=>board.id===boardId)?boardId:this.canonical.boards[0].id;if(this.connected&&!this.blocked&&this.socket?.readyState===WebSocket.OPEN&&this.sentBoardId!==active){this.sentBoardId=active;this.socket.send(JSON.stringify({type:'presence',boardId:active}));}}
}
