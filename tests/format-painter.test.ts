import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,validWorkspace} from '../src/model';
import {defaultWorkspaceStyle} from '../src/style-schema';
import {defaultTextStyle,type TextAnnotation} from '../src/annotations';
import {captureFormatting,paintFormatting,formattingSignature,paintCompatibility} from '../src/formatPainter';
import {applyChanges,diffWorkspace,OperationConflict} from '../src/operations';
import {resolveStyledBoard} from '../src/workspaceStyles';
test('fixed painter preserves legacy content and geometry, supports one-step undo and detects competing formatting',()=>{
 const w=structuredClone(seed),b=w.boards[0],source={kind:'card' as const,id:b.cards[0].id};b.cards[0].color='#123456';b.cards.push({...b.cards[0],id:'target',text:'Keep my text',x:900,color:'#ffffff'});const target={kind:'card' as const,id:'target'},snapshot=structuredClone(w),format=captureFormatting(w,b.id,source)!;
 const next=paintFormatting(w,b.id,target,format,'fixed');assert.ok(validWorkspace(next));assert.deepEqual(w,snapshot);assert.deepEqual(next.boards[0].cards.at(-1),{...b.cards.at(-1),color:'#123456'});assert.equal(next.workspaceStyle,undefined);
 const inverse=diffWorkspace(next,w),moved=structuredClone(next);moved.boards[0].cards.at(-1)!.x=1000;assert.equal(applyChanges(moved,inverse).boards[0].cards.at(-1)!.x,1000);
 const signature=formattingSignature(w,b.id,target);const edited=structuredClone(w);edited.boards[0].cards.at(-1)!.text='Remote text';edited.boards[0].cards.at(-1)!.x=1200;assert.deepEqual(formattingSignature(edited,b.id,target),signature);edited.boards[0].cards.at(-1)!.color='#abcdef';assert.notDeepEqual(formattingSignature(edited,b.id,target),signature);assert.throws(()=>applyChanges(edited,diffWorkspace(w,next)),OperationConflict);
});
test('linked roles omit source overrides, fixed formatting freezes appearance and target text survives',()=>{
 const w=structuredClone(seed);w.workspaceStyle=structuredClone(defaultWorkspaceStyle);const b=w.boards[0];b.cards[0].styleBinding={role:'heading',overrides:{fontSize:55}};const target:TextAnnotation={id:'target',kind:'text',x:500,y:300,width:300,height:90,text:'Preserved',color:'auto',style:{...defaultTextStyle}};b.annotations=[target];
 const source=captureFormatting(w,b.id,{kind:'card',id:b.cards[0].id})!,t={kind:'annotation' as const,id:'target'};assert.ok(paintCompatibility(w,b.id,t,source,'fixed'));
 const linked=paintFormatting(w,b.id,t,source,'linked');assert.deepEqual(linked.boards[0].annotations![0],{...target,styleBinding:{role:'heading'}});assert.equal((resolveStyledBoard(linked,linked.boards[0]).annotations![0] as TextAnnotation).style.fontSize,w.workspaceStyle.roles.heading.fontSize);
 const textSource=captureFormatting(linked,b.id,t)!;linked.boards[0].annotations!.push({...target,id:'second'});const fixed=paintFormatting(linked,b.id,{kind:'annotation',id:'second'},textSource,'fixed');fixed.workspaceStyle!.roles.heading.fontSize=70;assert.equal((resolveStyledBoard(fixed,fixed.boards[0]).annotations![1] as TextAnnotation).style.fontSize,40);assert.ok(validWorkspace(fixed));
});
test('shape paint retains target geometry, rejects media, source and cross-board targets',()=>{
 const w=structuredClone(seed),b=w.boards[0];b.annotations=[{id:'s',kind:'shape',shape:'rectangle',x:0,y:0,width:100,height:100,color:'#123456',thickness:8,fill:'#ffffff',points:[[0,0],[100,100]]},{id:'t',kind:'shape',shape:'arrow',x:300,y:400,width:200,height:100,color:'#000000',thickness:2,fill:'transparent',points:[[0,0],[200,100]]}];const source=captureFormatting(w,b.id,{kind:'annotation',id:'s'})!;
 const next=paintFormatting(w,b.id,{kind:'annotation',id:'t'},source,'fixed');assert.deepEqual(next.boards[0].annotations![1],{...b.annotations[1],color:'#123456',thickness:8});assert.ok(validWorkspace(next));assert.ok(paintCompatibility(w,'other',{kind:'annotation',id:'t'},source,'fixed'));assert.ok(paintCompatibility(w,b.id,source.source,source,'fixed'));b.cards.push({...b.cards[0],id:'media',kind:'image'});assert.equal(captureFormatting(w,b.id,{kind:'card',id:'media'}),null);
});
