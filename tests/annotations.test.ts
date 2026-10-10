import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultTextStyle,makeStroke,validAnnotation,automaticTextColor,type TextAnnotation} from '../src/annotations';
import {seed,validWorkspace} from '../src/model';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
import {canvasExtent} from '../src/features/canvas/domain';

const text:TextAnnotation={id:'annotation-text',kind:'text',x:40,y:20,width:320,height:100,text:'A styled heading',color:'auto',style:{...defaultTextStyle}};
test('annotation validation bounds strokes, fonts and styles without breaking legacy workspaces',()=>{
 assert.ok(validWorkspace(seed));const stroke=makeStroke('stroke','pen',[[40,50],[45,60],[80,65]],'#d95d39',3);assert.ok(validAnnotation(stroke));assert.deepEqual(stroke.points,[[0,0],[5,10],[40,15]]);assert.ok(validAnnotation(text));
 for(const value of [{...stroke,points:[[NaN,0]]},{...stroke,points:[[0,99999]]},{...stroke,points:Array(4097).fill([0,0])},{...stroke,thickness:61},{...stroke,assetId:'foreign'}, {...text,color:'url(https://evil)'},{...text,style:{...text.style,fontFamily:'url(evil)'}},{...text,style:{...text.style,fontSize:1000}},{...text,style:{...text.style,background:'red;position:fixed'}},{...text,style:{...text.style,borderWidth:-1}},{...text,style:{...text.style,italic:'yes'}}])assert.equal(validAnnotation(value),false);
 const state=structuredClone(seed);state.boards[0].annotations=[text,stroke];assert.ok(validWorkspace(state));state.boards[1].annotations=[text];assert.equal(validWorkspace(state),false);delete state.boards[1].annotations;state.boards[0].annotations[0]={...text,id:state.boards[0].cards[0].id};assert.equal(validWorkspace(state),false);
 assert.equal(automaticTextColor('transparent'),'var(--ink)');assert.equal(automaticTextColor('#fff'),'#242b27');assert.equal(automaticTextColor('#000'),'#f5f7f5');
});
test('annotation operations merge independent entities and fields, preserve order and protect undo from competing edits',()=>{
 const base=structuredClone(seed);base.boards[0].annotations=[text,makeStroke('stroke','highlighter',[[1,2],[20,10]],'#f5c542',18)];
 const left=structuredClone(base),right=structuredClone(base);left.boards[0].annotations![0].x=90;right.boards[0].annotations![1].color='#00ff00';
 const merged=applyChanges(applyChanges(base,diffWorkspace(base,left)),diffWorkspace(base,right));assert.equal(merged.boards[0].annotations![0].x,90);assert.equal(merged.boards[0].annotations![1].color,'#00ff00');
 const styled=structuredClone(base);(styled.boards[0].annotations![0] as TextAnnotation).style.fontWeight=700;assert.equal((applyChanges(merged,diffWorkspace(base,styled)).boards[0].annotations![0] as TextAnnotation).style.fontWeight,700);
 const competing=structuredClone(base);competing.boards[0].annotations![0].x=200;assert.throws(()=>applyChanges(merged,diffWorkspace(base,competing)),OperationConflict);
 const undo=diffWorkspace(left,base),restored=applyChanges(merged,undo);assert.equal(restored.boards[0].annotations![0].x,40);assert.equal(restored.boards[0].annotations![1].color,'#00ff00');
 const deletion=structuredClone(base);deletion.boards[0].annotations=[];assert.throws(()=>applyChanges(merged,diffWorkspace(base,deletion)),OperationConflict);
 const reversed=structuredClone(base);reversed.boards[0].annotations!.reverse();assert.deepEqual(applyChanges(base,diffWorkspace(base,reversed)),reversed);
 assert.deepEqual(applyChanges(seed,diffWorkspace(seed,base)),base);assert.deepEqual(applyChanges(base,diffWorkspace(base,seed)),seed);
 const far=structuredClone(base);far.boards[0].annotations![0].x=5000;assert.ok(canvasExtent(far.boards[0]).width>5000);
 assert.throws(()=>applyChanges(base,[{boardId:'home',cardId:'welcome',annotationId:text.id,field:'x',before:40,after:50}]));
 assert.throws(()=>applyChanges(base,[{boardId:'home',annotationId:text.id,field:'assetId',before:null,after:'foreign'}]));
});
