import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/model';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';

test('field operations merge unrelated changes and reject same-field conflicts',()=>{
 const note=structuredClone(seed);note.boards[0].cards[0].text='Updated text';
 const color=structuredClone(seed);color.boards[0].cards[0].color='#e3efe9';
 const merged=applyChanges(applyChanges(seed,diffWorkspace(seed,note)),diffWorkspace(seed,color));
 assert.equal(merged.boards[0].cards[0].text,'Updated text');assert.equal(merged.boards[0].cards[0].color,'#e3efe9');
 const other=structuredClone(seed);other.boards[0].cards[0].text='Conflicting text';
 assert.throws(()=>applyChanges(merged,diffWorkspace(seed,other)),OperationConflict);
 assert.deepEqual(applyChanges(note,diffWorkspace(seed,note)),note); // same outcome is safe
 assert.deepEqual(seed.boards[0].cards[0].color,'#fff');
});
test('operation round trips additions/deletions, optional fields, and rejects invalid graphs',()=>{
 const next=structuredClone(seed);next.boards.push({id:'new-board',parent:'home',title:'New',cards:[]});next.boards[0].cards.push({id:'new-tile',kind:'board',target:'new-board',text:'New',color:'#fff',x:100,y:200});
 assert.deepEqual(applyChanges(seed,diffWorkspace(seed,next)),next);
 assert.deepEqual(applyChanges(next,diffWorkspace(next,seed)),seed);
 const invalid=structuredClone(seed);invalid.boards[0].parent='film';assert.throws(()=>applyChanges(seed,diffWorkspace(seed,invalid)),/invalid workspace/);
 assert.throws(()=>applyChanges(seed,[{boardId:'home',field:'text',before:null,after:'Invalid board field'}]),/Invalid field/);
 const removed=structuredClone(seed);removed.boards[0].cards=removed.boards[0].cards.filter(c=>c.id!=='welcome');
 const remote=structuredClone(seed);remote.boards[0].cards[0].text='Remote edit';assert.throws(()=>applyChanges(remote,diffWorkspace(seed,removed)),OperationConflict);
});
test('undo preserves unrelated remote work and refuses to overwrite the same field',()=>{
 const edited=structuredClone(seed);edited.boards[0].cards[0].text='My edit';const inverse=diffWorkspace(edited,seed);
 const remote=structuredClone(edited);remote.boards[0].cards[1].text='Their edit';
 const undone=applyChanges(remote,inverse);assert.equal(undone.boards[0].cards[0].text,seed.boards[0].cards[0].text);assert.equal(undone.boards[0].cards[1].text,'Their edit');
 remote.boards[0].cards[0].text='Their newer edit';assert.throws(()=>applyChanges(remote,inverse),OperationConflict);
});
test('document operations preserve imported board and card ordering',()=>{
 const reordered=structuredClone(seed);reordered.boards[0].cards.reverse();reordered.boards.reverse();
 assert.deepEqual(applyChanges(seed,diffWorkspace(seed,reordered)),reordered);
 assert.deepEqual(applyChanges(reordered,diffWorkspace(reordered,seed)),seed);
});
