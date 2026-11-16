export type CanvasCommand={id:string;label:string;group?:string;keywords?:string[];description?:string;shortcut?:string;run:()=>void;disabled?:boolean;disabledReason?:string};
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function searchCommands(commands:CanvasCommand[],query:string){
 const normalized=normalize(query),words=normalized.split(/\s+/).filter(Boolean);
 return commands.map((command,index)=>{const label=normalize(command.label),keywords=normalize([command.group,...command.keywords??[],command.description].filter(Boolean).join(' ')),text=label+' '+keywords;
  if(!words.every(word=>text.includes(word)))return null;
  const score=!normalized?0:label===normalized?0:label.startsWith(normalized)?1:words.every(word=>label.includes(word))?2:3;
  return {command,index,score};
 }).filter((entry):entry is NonNullable<typeof entry>=>entry!==null).sort((a,b)=>a.score-b.score||a.index-b.index).map(entry=>entry.command);
}
export function groupCommands(commands:CanvasCommand[]){const groups=new Map<string,CanvasCommand[]>();for(const command of commands){const name=command.group??'Other actions';if(!groups.has(name))groups.set(name,[]);groups.get(name)!.push(command);}return [...groups].map(([name,commands])=>({name,commands}));}
