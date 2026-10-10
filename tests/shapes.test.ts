import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeShape,resizeShape,shapePath,validAnnotation} from '../src/annotations';
import {seed,validWorkspace} from '../src/model';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
test('shapes preserve arrow direction, bound geometry and resize without invalid endpoints',()=>{
 for(const kind of ['line','arrow','rectangle','circle'] as const)for(const end of [[100,80],[10,80],[100,10],[10,10]] as [number,number][]){const shape=makeShape('shape',kind,[50,40],end,'#d95d39',3);assert.equal(validAnnotation(shape),true);assert.equal(validAnnotation(resizeShape(shape,300,200)),true);assert.ok(shapePath(shape));}
 const arrow=makeShape('arrow','arrow',[100,80],[10,20],'#abc',3);assert.deepEqual(arrow.points,[[90,60],[0,0]]);assert.match(shapePath(arrow),/^M 90 60 L 0 0/);
 for(const bad of [{...arrow,shape:'triangle'},{...arrow,fill:'url(evil)'},{...arrow,thickness:100},{...arrow,points:[[0,0],[200,400]]},{...arrow,points:[]},{...arrow,width:Infinity},{...arrow,assetId:'foreign'}])assert.equal(validAnnotation(bad),false);
 assert.equal(validAnnotation(makeShape('horizontal','line',[10,10],[50,10],'#abc',2)),true);
});
test('shape operations preserve unrelated edits, protect resize and support undo/redo and backups',()=>{
 const initial=structuredClone(seed),shape=makeShape('shape','rectangle',[20,20],[120,100],'#64786c',3);initial.boards[0].annotations=[shape];
 const resized=structuredClone(initial);resized.boards[0].annotations=[resizeShape(shape,200,160)];const filled=structuredClone(initial);filled.boards[0].annotations=[{...shape,fill:'#fff4c9'}];
 const merged=applyChanges(resized,diffWorkspace(initial,filled));assert.equal(validWorkspace(JSON.parse(JSON.stringify(merged))),true);
 const changes=diffWorkspace(initial,resized);assert.deepEqual(applyChanges(merged,changes.map(c=>({...c,before:c.after,after:c.before}))),filled);
 const competing=structuredClone(initial);competing.boards[0].annotations=[resizeShape(shape,300,200)];assert.throws(()=>applyChanges(resized,diffWorkspace(initial,competing)),OperationConflict);
 assert.deepEqual(applyChanges(seed,diffWorkspace(seed,initial)),initial);
});
