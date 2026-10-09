import {validWorkspace, seed, type Workspace} from './model';
import {LiveRepository,type Role} from './liveRepository';
export interface WorkspaceReader {load():Promise<Workspace>}
export type WorkspaceRepository=LocalRepository|TeamRepository;
export class LocalRepository implements WorkspaceReader {
 async load(){try{const value:unknown=JSON.parse(localStorage.getItem('boardroom.v1')??'null');return validWorkspace(value)?value:seed;}catch{return seed;}}
 async save(snapshot:Workspace){localStorage.setItem('boardroom.v1',JSON.stringify(snapshot));}
}
let csrf='';
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'x-csrf-token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){const result=await response.json().catch(()=>({error:'Request failed'}));throw new Error(result.error??'Request failed');}
 if(response.status===204)return undefined as T;
 const result=await response.json();if(result.csrf)csrf=result.csrf;return result as T;
}
export class TeamRepository extends LiveRepository implements WorkspaceReader {
 constructor(id:string,public displayName='Team workspace'){super(id,()=>csrf);}
 async load(){const result=await api<{snapshot:Workspace;revision:number;role:Role}>(`/workspaces/${this.id}`);if(!validWorkspace(result.snapshot))throw Error('Invalid server snapshot');this.initialize(result.snapshot,result.revision,result.role);return result.snapshot;}
}

export async function uploadAsset(workspaceId:string,file:File){
 const response=await fetch(`/api/workspaces/${workspaceId}/assets?name=${encodeURIComponent(file.name)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','x-csrf-token':csrf},body:file});
 if(!response.ok){const result=await response.json().catch(()=>({error:'Upload failed'}));throw Error(result.error);}
 return await response.json() as {id:string;name:string;mime:string;size_bytes:number;kind:'image'|'video'|'file'};
}
