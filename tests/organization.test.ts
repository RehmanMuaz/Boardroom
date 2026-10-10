import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,validWorkspace,type Workspace} from '../src/model';
import {makeShape} from '../src/annotations';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
import {cardWidth,cardHeight,moveSelection} from '../src/features/canvas/domain';
import {columnMembers,columnSummary,dropIntoColumn,resizeInColumns,reorderLayers,cardLayer,columnAt} from '../src/features/canvas/organization';

function fixture():Workspace{
 const state=structuredClone(seed);state.boards[0].cards.push({id:'column',kind:'column',x:1000,y:40,width:320,height:520,text:'Production',color:'#ebeee8'},{id:'other-column',kind:'column',x:1500,y:40,text:'Review',color:'#fff'});return state;
}
test('column drops fit media, reorder without changing canvas layer order, resize/reflow and transfer membership atomically',()=>{
 const state=fixture();state.boards[0].cards.push({id:'image',kind:'image',assetId:'00000000-0000-4000-8000-000000000001',captionVisible:false,x:400,y:500,width:640,height:480,text:'',color:'#fff'});
 let next=dropIntoColumn(state,'home',['welcome','image'],'column');
 let board=next.boards[0],image=board.cards.find(c=>c.id==='image')!;
 assert.equal(image.width,288);assert.equal(image.height,216);assert.equal(columnSummary(board,'column'),'2 cards');
 assert.deepEqual(columnMembers(board,'column').map(c=>c.id),['welcome','image']);
 const originalOrder=board.cards.map(c=>c.id);
 next=dropIntoColumn(next,'home',['image'],'column',40);board=next.boards[0];
 assert.deepEqual(columnMembers(board,'column').map(c=>c.id),['image','welcome']);assert.deepEqual(board.cards.map(c=>c.id),originalOrder);
 next=resizeInColumns(next,'home','image',800,800,4/3);assert.equal(next.boards[0].cards.find(c=>c.id==='image')!.width,288);
 next=resizeInColumns(next,'home','image',200,800,4/3);board=next.boards[0];image=board.cards.find(c=>c.id==='image')!;
 assert.equal(image.height,150);assert.equal(board.cards.find(c=>c.id==='welcome')!.y,image.y+150+20);
 next=resizeInColumns(next,'home','column',100,100);board=next.boards[0];assert.equal(board.cards.find(c=>c.id==='column')!.width,192);
 for(const c of columnMembers(board,'column'))assert.ok(c.x+cardWidth(c)<=board.cards.find(c=>c.id==='column')!.x+192-16);
 next=dropIntoColumn(next,'home',['image'],'other-column');assert.equal(columnSummary(next.boards[0],'column'),'1 card');assert.equal(columnSummary(next.boards[0],'other-column'),'1 card');
 next=dropIntoColumn(next,'home',['image']);assert.equal(next.boards[0].cards.find(c=>c.id==='image')!.columnId,undefined);
 assert.ok(validWorkspace(next));assert.deepEqual(applyChanges(state,diffWorkspace(state,next)),next);assert.deepEqual(applyChanges(next,diffWorkspace(next,state)),state);
 const moved=moveSelection(next,'home',['column'],100,20);const child=next.boards[0].cards.find(c=>c.id==='welcome')!;
 assert.equal(moved.boards[0].cards.find(c=>c.id==='welcome')!.x,child.x+100);
 assert.equal(columnAt(moved.boards[0],{x:1200,y:120})?.id,'column');
});
test('column summaries count direct files/boards separately and treat image/video as cards',()=>{
 const state=fixture(),board=state.boards[0];
 board.cards.push({id:'video',kind:'video',assetId:'00000000-0000-4000-8000-000000000001',x:100,y:100,text:'',color:'#fff'},{id:'file',kind:'file',assetId:'00000000-0000-4000-8000-000000000002',x:100,y:100,text:'Brief',color:'#fff'});
 const grouped=dropIntoColumn(state,'home',['welcome','todo','video','file','project'],'column');
 assert.equal(columnSummary(grouped.boards[0],'column'),'3 cards, 1 file, 1 board');assert.equal(columnSummary(board,'other-column'),'0 cards');
 const column=grouped.boards[0].cards.find(c=>c.id==='column')!;
 for(const c of columnMembers(grouped.boards[0],'column'))assert.ok(c.y+cardHeight(c)<column.y+cardHeight(column));
});
test('layers order cards and annotations together, keep column children visible, survive undo and detect competing edits',()=>{
 const state=dropIntoColumn(fixture(),'home',['welcome'],'column');state.boards[0].annotations=[makeShape('shape','rectangle',[70,70],[200,200],'#abc',2)];
 const front=reorderLayers(state,'home',['column'],'front'),board=front.boards[0];
 const column=board.cards.find(c=>c.id==='column')!,child=board.cards.find(c=>c.id==='welcome')!;
 assert.ok(cardLayer(board,child)>cardLayer(board,column));assert.ok(column.layer!>board.annotations![0].layer!);
 const back=reorderLayers(front,'home',['shape'],'back');assert.ok(back.boards[0].annotations![0].layer!<back.boards[0].cards.find(c=>c.id==='brief')!.layer!);
 const forward=reorderLayers(back,'home',['shape'],'forward');assert.ok(forward.boards[0].annotations![0].layer!>back.boards[0].annotations![0].layer!);
 assert.deepEqual(applyChanges(state,diffWorkspace(state,front)),front);assert.deepEqual(applyChanges(front,diffWorkspace(front,state)),state);
 const remote=structuredClone(front);remote.boards[0].cards.find(c=>c.id==='column')!.layer=19000;assert.throws(()=>applyChanges(remote,diffWorkspace(front,state)),OperationConflict);
});
test('checklist titles and note labels are validated, preserved in backups/copies, and merge independently with text',()=>{
 const state=structuredClone(seed),next=structuredClone(seed);next.boards[0].cards[2].title='Deliverables';next.boards[0].cards[0].labels=[{id:'review',text:'Client review',color:'#123456'}];
 assert.ok(validWorkspace(next));assert.deepEqual(applyChanges(state,diffWorkspace(state,next)),next);
 const remote=structuredClone(state);remote.boards[0].cards[0].text='Other teammate changed this';const merged=applyChanges(remote,diffWorkspace(state,next));assert.equal(merged.boards[0].cards[0].text,remote.boards[0].cards[0].text);
 assert.ok(validWorkspace(JSON.parse(JSON.stringify(next))));
 for(const patch of [{labels:[{id:'x',text:'',color:'#123456'}]},{labels:[{id:'x',text:'Review',color:'url(evil)'}]},{labels:Array.from({length:21},(_,i)=>({id:String(i),text:'Review',color:'#123456'}))},{layer:-1},{layer:20001}]){
  const invalid=structuredClone(next);Object.assign(invalid.boards[0].cards[0],patch);assert.equal(validWorkspace(invalid),false);
 }
 const invalid=structuredClone(next);invalid.boards[0].cards[0].title='Only lists have this title';assert.equal(validWorkspace(invalid),false);
});
