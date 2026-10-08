import test from 'node:test';
import assert from 'node:assert/strict';
import {coverCrop, photoDimensions, containRect, captureCameraPhoto, createPhotoPreviewSession, canSharePhoto, sharePhoto} from '../app/camera-photo.ts';

test('landscape camera crop matches a square cover preview',()=>{
  assert.deepEqual(coverCrop(1920,1080,400,400),{x:420,y:0,width:1080,height:1080});
});
test('portrait preview takes the middle of a landscape camera frame',()=>{
  assert.deepEqual(coverCrop(1280,960,300,400),{x:280,y:0,width:720,height:960});
});
test('wide preview crops the top and bottom of a portrait camera frame',()=>{
  assert.deepEqual(coverCrop(960,1280,400,300),{x:0,y:280,width:960,height:720});
});
test('camera geometry rejects zero and non-finite dimensions',()=>{
  for(const values of [[0,1080,400,300],[1280,960,NaN,300],[1280,960,300,-1],[1280,Infinity,400,300]]){
    assert.throws(()=>coverCrop(...values),/not ready/);
  }
});
test('photo size preserves aspect ratio while limiting memory and never upscales',()=>{
  assert.deepEqual(photoDimensions(3840,2160),{width:1600,height:900});
  assert.deepEqual(photoDimensions(720,960),{width:720,height:960});
  assert.deepEqual(containRect(200,100,140),{x:-70,y:-35,width:140,height:70});
});

function fixture(overrides={}){
  const calls=[],releases=[];
  const context={drawImage(...args){calls.push(['draw',...args]);},scale(...args){calls.push(['scale',...args]);},save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...args){calls.push(['translate',...args]);},transform(...args){calls.push(['transform',...args]);},imageSmoothingEnabled:true};
  const canvas={width:0,height:0,getContext:()=>context};
  const platform={createCanvas:()=>canvas,loadFeature:async svg=>({image:svg,release:()=>releases.push(svg)}),encode:async()=>new Blob(['png'],{type:'image/png'}),...overrides};
  const scene={frame:'camera frame',sourceWidth:1280,sourceHeight:960,viewWidth:300,viewHeight:400,creatures:[
    {image:'main',naturalWidth:226,naturalHeight:226,x:150,y:200,size:140,featureSvg:'tuft'},
    {image:'guest 1',naturalWidth:226,naturalHeight:226,x:75,y:300,size:100},
    {image:'guest 2',naturalWidth:226,naturalHeight:226,x:225,y:300,size:110,featureSvg:'crest',transform:{a:1,b:0,c:0,d:1,e:0,f:-7}},
  ]};
  return {calls,releases,context,canvas,platform,scene};
}

test('photo freezes its camera frame before awaiting features and draws every positioned creature',async()=>{
  const f=fixture(),controller=new AbortController();
  const capture=captureCameraPhoto(f.scene,controller.signal,f.platform);
  assert.deepEqual(f.calls[0],['draw','camera frame',280,0,720,960,0,0,720,960]);
  const photo=await capture;
  assert.deepEqual({width:photo.width,height:photo.height},{width:720,height:960});
  assert.equal(photo.blob.type,'image/png');
  assert.deepEqual(f.calls.filter(call=>call[0]==='translate'),[['translate',150,200],['translate',75,300],['translate',225,300]]);
  assert.deepEqual(f.calls.filter(call=>call[0]==='draw').map(call=>call[1]),['camera frame','main','tuft','guest 1','guest 2','crest']);
  assert.deepEqual(f.calls.find(call=>call[0]==='draw'&&call[1]==='main'),['draw','main',-70,-70,140,140]);
  assert.deepEqual(f.calls.find(call=>call[0]==='draw'&&call[1]==='crest'),['draw','crest',-55,-55,110,110]);
  assert.deepEqual(f.calls.find(call=>call[0]==='transform'),['transform',1,0,0,1,0,-7]);
  assert.deepEqual(f.releases,['tuft','crest']);
  assert.equal(f.context.imageSmoothingEnabled,false);
  assert.deepEqual([f.canvas.width,f.canvas.height],[0,0]);
});

test('cancelling while a feature loads releases its resource and never encodes a photo',async()=>{
  let resolve,encoded=false,released=false;
  const pending=new Promise(done=>{resolve=done;});
  const f=fixture({loadFeature:()=>pending,encode:async()=>{encoded=true;return new Blob();}});
  const controller=new AbortController();
  const capture=captureCameraPhoto(f.scene,controller.signal,f.platform);
  controller.abort();
  resolve({image:'late feature',release:()=>{released=true;}});
  await assert.rejects(capture,{name:'AbortError'});
  assert.equal(released,true);
  assert.equal(encoded,false);
  assert.deepEqual([f.canvas.width,f.canvas.height],[0,0]);
});

test('failed feature load clears its canvas and returns a recoverable error',async()=>{
  const f=fixture({loadFeature:async()=>{throw new Error('Feature unavailable');}});
  await assert.rejects(captureCameraPhoto(f.scene,new AbortController().signal,f.platform),/Feature unavailable/);
  assert.deepEqual([f.canvas.width,f.canvas.height],[0,0]);
});

test('closing during PNG encoding rejects the late result',async()=>{
  let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const f=fixture({encode:()=>pending});
  f.scene.creatures=[];
  const controller=new AbortController();
  const capture=captureCameraPhoto(f.scene,controller.signal,f.platform);
  controller.abort();
  resolve(new Blob(['late png'],{type:'image/png'}));
  await assert.rejects(capture,{name:'AbortError'});
  assert.deepEqual([f.canvas.width,f.canvas.height],[0,0]);
});

test('retake revokes a preview once and prevents a pending capture from publishing',()=>{
  let created=0;const revoked=[];
  const owner=createPhotoPreviewSession({createURL:()=>`blob:${++created}`,revokeURL:url=>revoked.push(url)});
  const request=owner.begin();
  assert.equal(owner.publish(request,new Blob()),'blob:1');
  const next=owner.begin();
  owner.clear();
  assert.equal(next.signal.aborted,true);
  assert.equal(owner.publish(next,new Blob()),null);
  owner.dispose();
  assert.deepEqual(revoked,['blob:1']);
  assert.equal(created,1);
});

test('a newer photo request supersedes an old one and disposal blocks late publication',()=>{
  let created=0;const revoked=[];
  const owner=createPhotoPreviewSession({createURL:()=>`blob:${++created}`,revokeURL:url=>revoked.push(url)});
  const old=owner.begin(),current=owner.begin();
  assert.equal(old.signal.aborted,true);
  assert.equal(owner.publish(old,new Blob()),null);
  assert.equal(owner.publish(current,new Blob()),'blob:1');
  const late=owner.begin();
  owner.dispose();
  assert.equal(late.signal.aborted,true);
  assert.equal(owner.publish(late,new Blob()),null);
  assert.equal(owner.begin(),null);
  assert.deepEqual(revoked,['blob:1']);
});

test('background cancellation preserves an already captured preview for returning from share',()=>{
  const revoked=[];
  const owner=createPhotoPreviewSession({createURL:()=> 'blob:photo',revokeURL:url=>revoked.push(url)});
  owner.publish(owner.begin(),new Blob());
  owner.cancelPending();
  assert.deepEqual(revoked,[]);
  owner.dispose();
  assert.deepEqual(revoked,['blob:photo']);
});

const file=new File(['png'],'remybot.png',{type:'image/png'});
test('share capability checks the prepared PNG file, not generic URL sharing',()=>{
  const target={canShare(data){assert.deepEqual(data,{files:[file]});return true;},share:async()=>{}};
  assert.equal(canSharePhoto(file,target),true);
  assert.equal(canSharePhoto(file,{share:async()=>{}}),false);
  assert.equal(canSharePhoto(file,{canShare:()=>{throw new Error('Denied');},share:async()=>{}}),false);
});
test('native share is invoked synchronously in the button activation turn',async()=>{
  let called=false;
  const result=sharePhoto(file,{canShare:()=>true,share(data){called=true;assert.deepEqual(data.files,[file]);return Promise.resolve();}});
  assert.equal(called,true);
  assert.equal(await result,'opened');
});
test('cancelled sharing is recoverable and unsupported sharing never opens a share menu',async()=>{
  const cancelled=await sharePhoto(file,{canShare:()=>true,share:async()=>{throw new DOMException('Cancelled','AbortError');}});
  assert.equal(cancelled,'cancelled');
  let called=false;
  assert.equal(await sharePhoto(file,{canShare:()=>false,share:async()=>{called=true;}}),'unavailable');
  assert.equal(called,false);
});
test('blocked sharing reports failure so the photo can still be downloaded',async()=>{
  await assert.rejects(sharePhoto(file,{canShare:()=>true,share:async()=>{throw new DOMException('Blocked','NotAllowedError');}}),{name:'NotAllowedError'});
});
test('synchronous share cancellation also keeps the preview available',async()=>{
  assert.equal(await sharePhoto(file,{canShare:()=>true,share:()=>{throw new DOMException('Cancelled','AbortError');}}),'cancelled');
});
test('unavailable canvas support fails without retaining its temporary pixel buffer',async()=>{
  const f=fixture();
  f.canvas.getContext=()=>null;
  await assert.rejects(captureCameraPhoto(f.scene,new AbortController().signal,f.platform),/cannot make the photo/);
  assert.deepEqual([f.canvas.width,f.canvas.height],[0,0]);
});
