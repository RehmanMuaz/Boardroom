import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapPoint} from '../src/features/canvas/snap';
import {seed,validWorkspace} from '../src/model';
test('grid snapping is explicit, bounded, independent of zoom and does not migrate legacy workspace data',()=>{const legacy=JSON.stringify(seed);assert.equal(validWorkspace(JSON.parse(legacy)),true);assert.deepEqual(snapPoint({x:73,y:87},false),{x:73,y:87});assert.deepEqual(snapPoint({x:73,y:87},true),{x:80,y:80});assert.deepEqual(snapPoint({x:-14,y:100010},true),{x:0,y:100000});assert.equal(JSON.stringify(seed),legacy);});
