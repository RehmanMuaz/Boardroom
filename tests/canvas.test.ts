import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,validWorkspace,richPlainText} from '../src/model';
import {moveSelection,deleteSelection,putInColumn,duplicateCards,canvasExtent,screenDelta,resizeCard} from '../src/features/canvas/domain';
import {applyChanges,diffWorkspace} from '../src/operations';
import {videoEmbed} from '../src/features/content/MediaCard';

test('media resizing preserves original proportions and bounds both dimensions',()=>{
 const card={id:'media',kind:'image' as const,x:0,y:0,text:'',color:'#fff',width:320,height:300};
 assert.deepEqual(resizeCard(card,400,900,4/3),{width:400,height:328});
 assert.deepEqual(resizeCard({...card,captionVisible:false},400,900,4/3),{width:400,height:300});
 assert.ok(resizeCard({...card,captionVisible:false},160,100,100000).height>=100);
 const tall=resizeCard(card,9000,9000,.1);assert.equal(tall.height,10000);assert.ok(tall.width<=4000);
 const small=resizeCard(card,-100,-100,4/3);assert.equal(small.width,160);assert.ok(small.height>=100);
 for(const ratio of [.00001,100000]){const size=resizeCard(card,400,300,ratio);assert.ok(size.width>=160&&size.width<=4000);assert.ok(size.height>=100&&size.height<=10000);}
 assert.deepEqual(resizeCard({...card,kind:'note'},400,900),{width:400,height:900});
});

test('group movement clamps consistently, columns carry members, deletion removes references',()=>{
 const state=structuredClone(seed);const board=state.boards[0];board.cards.push({id:'column',kind:'column',x:1000,y:100,text:'Ideas',color:'#fff',width:320,height:520});
 const grouped=putInColumn(state,'home',['welcome','brief'],'column');assert.equal(grouped.boards[0].cards[0].columnId,'column');
 const moved=moveSelection(grouped,'home',['column'],100,50);assert.equal(moved.boards[0].cards[0].x,grouped.boards[0].cards[0].x+100);assert.equal(moved.boards[0].cards[0].y,grouped.boards[0].cards[0].y+50);
 const clamp=moveSelection(state,'home',['welcome','brief'],-1000,0);assert.equal(clamp.boards[0].cards[0].x,0);assert.equal(clamp.boards[0].cards[1].x-clamp.boards[0].cards[0].x,285);
 const upper=moveSelection(state,'home',['welcome','brief'],200000,0);assert.equal(upper.boards[0].cards[1].x,100000);assert.equal(upper.boards[0].cards[1].x-upper.boards[0].cards[0].x,285);
 grouped.boards[0].connectors=[{id:'line',from:'welcome',to:'brief',color:'#fff'}];const removed=deleteSelection(grouped,'home',['welcome','column']);assert.equal(removed.boards[0].connectors!.length,0);assert.equal(removed.boards[0].cards.find(c=>c.id==='brief')!.columnId,undefined);assert.ok(validWorkspace(removed));
});
test('new canvas content round trips through field operations and copies remap references',()=>{
 const next=structuredClone(seed);next.boards[0].cards[0].richText={blocks:[{type:'heading',runs:[{text:'Formatted',bold:true}]}]};next.boards[0].cards[0].text=richPlainText(next.boards[0].cards[0].richText!);next.boards[0].cards[0].width=360;next.boards[0].connectors=[{id:'line',from:'welcome',to:'brief',color:'#789180'}];
 assert.ok(validWorkspace(next));assert.deepEqual(applyChanges(seed,diffWorkspace(seed,next)),next);
 const copied=duplicateCards(next.boards[0],['welcome','brief']);assert.notEqual(copied.cards[0].id,'welcome');assert.equal(copied.connectors[0].from,copied.cards[0].id);assert.equal(copied.connectors[0].to,copied.cards[1].id);
 next.boards[0].cards[0].x=3500;next.boards[0].cards[0].y=2200;assert.ok(canvasExtent(next.boards[0]).width>4000);assert.ok(canvasExtent(next.boards[0]).height>2500);assert.deepEqual(screenDelta(100,50,.5),{x:200,y:100});
 const invalid=structuredClone(next);invalid.boards[0].cards[0].width=0;assert.equal(validWorkspace(invalid),false);invalid.boards[0].cards[0].width=300;invalid.boards[0].cards[0].columnId='absent';assert.equal(validWorkspace(invalid),false);
});
test('embeds permit only known HTTPS providers and never fetch arbitrary preview URLs',()=>{
 assert.equal(videoEmbed('https://youtu.be/dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');assert.equal(videoEmbed('https://vimeo.com/123456'),'https://player.vimeo.com/video/123456');
 for(const value of ['javascript:alert(1)','http://youtu.be/dQw4w9WgXcQ','https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ','http://127.0.0.1/private','https://unknown.example/video'])assert.equal(videoEmbed(value),undefined);
});
