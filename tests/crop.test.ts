import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragCrop,type CropHandle} from '../src/crop';
import {originalImageEdit,validImageEdit,rotateImage} from '../src/image-edit';
test('visual crop handles preserve opposite edges, clamp moves and retain valid normalized bounds at every edge',()=>{
 const crop={x:.17,y:.23,width:.5,height:.6};
 for(const handle of ['move','n','s','e','w','nw','ne','sw','se'] as CropHandle[])for(const dx of [-10,-.5,0,.001,.5,10])for(const dy of [-10,0,.5,10]){
  const next=dragCrop(crop,handle,dx,dy);assert.ok(validImageEdit({...originalImageEdit,crop:next}),JSON.stringify({handle,dx,dy,next}));if(handle==='move'){assert.equal(next.width,crop.width);assert.equal(next.height,crop.height);}if(handle.includes('w'))assert.ok(Math.abs(next.x+next.width-crop.x-crop.width)<1e-9);
 }
 assert.deepEqual(dragCrop(crop,'move',NaN,0),crop);const rotated=rotateImage({...originalImageEdit,crop});assert.ok(validImageEdit({...rotated,crop:dragCrop(rotated.crop,'se',.2,.2)}));
});
