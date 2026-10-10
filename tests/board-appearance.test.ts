import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,validWorkspace} from '../src/model';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
test('board appearance validates safe colors/patterns, merges unrelated edits and supports conflict-safe undo',()=>{
 const colored=structuredClone(seed);colored.boards[0].background='#123456';const patterned=structuredClone(seed);patterned.boards[0].pattern='grid';
 const colorChanges=diffWorkspace(seed,colored),patternChanges=diffWorkspace(seed,patterned),merged=applyChanges(colored,patternChanges);
 assert.equal(merged.boards[0].background,'#123456');assert.equal(merged.boards[0].pattern,'grid');assert.equal(merged.boards[1].background,undefined);
 const reverted=applyChanges(merged,colorChanges.map(c=>({...c,before:c.after,after:c.before})));assert.equal(reverted.boards[0].background,undefined);assert.equal(reverted.boards[0].pattern,'grid');
 const competing=structuredClone(seed);competing.boards[0].background='#ffffff';assert.throws(()=>applyChanges(colored,diffWorkspace(seed,competing)),OperationConflict);
 for(const value of ['red','url(https://example.com)','var(--ink)','#12345',null]){const bad=structuredClone(seed) as unknown as {boards:{background:unknown}[]};bad.boards[0].background=value;assert.equal(validWorkspace(bad),false);}
 for(const value of ['paper',null,{}]){const bad=structuredClone(seed) as unknown as {boards:{pattern:unknown}[]};bad.boards[0].pattern=value;assert.equal(validWorkspace(bad),false);}
 assert.throws(()=>applyChanges(seed,[{boardId:'home',cardId:'welcome',field:'background',before:null,after:'#ffffff'}]));
 assert.equal(validWorkspace(seed),true);
});
