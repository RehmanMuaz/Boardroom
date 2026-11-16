export type CommentMember={id:string;email:string;role:'owner'|'editor'|'viewer'};
export type CommentMessage={id:string;body:string;author:string|null;version:number;created_at:string;mentions:string[]};
export type CommentThread={id:string;board_id:string;card_id:string|null;resolved:boolean;version:number;updated_at:string;unread:boolean;mentioned:boolean;preview:string;count:number};
export type CommentOverview={threads:CommentThread[];members:CommentMember[];unread:number;mentions:number;total:number};
export type CommentDetail={thread:CommentThread;messages:CommentMessage[];targetMissing:boolean};

/** Mentions are plain text; only exact, current workspace-member emails become recipients. */
export function mentionedMembers(body:string,members:CommentMember[]){
 const emails=new Set([...body.matchAll(/(?:^|[\s([{])@([^\s<>()[\]{},;:!?]+)/g)].map(m=>m[1].replace(/\.+$/,'').toLowerCase()));
 return members.filter(m=>emails.has(m.email.toLowerCase())).map(m=>m.id);
}
