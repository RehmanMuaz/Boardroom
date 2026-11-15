import {api} from './repository';
import {validWorkspace,type Workspace} from './model';
export class SharedRepository{
 role='viewer' as const;id='';displayName='Shared workspace';
 constructor(public linkId:string){}
 async load(){const result=await api<{id:string;name:string;snapshot:Workspace}>(`/viewer/${this.linkId}/workspace`);if(!validWorkspace(result.snapshot))throw Error('Invalid shared workspace');this.id=result.id;this.displayName=result.name;return result.snapshot;}
 async save(_snapshot:Workspace):Promise<void>{throw Error('Shared links are read-only');}
}
