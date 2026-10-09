import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,moveCard,validWorkspace} from '../src/model.ts';
test('move clamps coordinates, preserves other cards, and does not mutate history',()=>{const original=structuredClone(seed);const next=moveCard(original,'home','welcome',-30,200);assert.equal(next.boards[0].cards[0].x,0);assert.equal(next.boards[0].cards[0].y,200);assert.equal(original.boards[0].cards[0].y,70);assert.deepEqual(next.boards[1],original.boards[1]);});
test('backup validation rejects malformed data and accepts JSON round trips',()=>{assert.ok(validWorkspace(JSON.parse(JSON.stringify(seed))));for(const bad of [null,{}, {version:1,boards:[]},{version:1,boards:[{id:'a',title:'b',cards:[{id:'c',kind:'script',x:0,y:0,text:'x',color:'#fff'}]}]}])assert.equal(validWorkspace(bad),false);});
test('backup validation rejects duplicate IDs, cycles, dangling targets and invalid coordinates',()=>{
 const duplicate=structuredClone(seed);duplicate.boards[1].id=duplicate.boards[0].id;assert.equal(validWorkspace(duplicate),false);
 const duplicateCard=structuredClone(seed);duplicateCard.boards[1].cards[0].id=duplicateCard.boards[0].cards[0].id;assert.equal(validWorkspace(duplicateCard),false);
 const cycle=structuredClone(seed);cycle.boards[0].parent='film';assert.equal(validWorkspace(cycle),false);
 const dangling=structuredClone(seed);dangling.boards[0].cards[3].target='absent';assert.equal(validWorkspace(dangling),false);
 const negative=structuredClone(seed);negative.boards[0].cards[0].x=-1;assert.equal(validWorkspace(negative),false);
});
