import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraSession} from '../app/camera-session.ts';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fakeStream(){const tracks=[{stops:0,stop(){this.stops++;}},{stops:0,stop(){this.stops++;}}];return {getTracks:()=>tracks};}
function harness(request){const streams=[],statuses=[],errors=[];const session=createCameraSession({request,onStream:stream=>streams.push(stream),onStatus:status=>statuses.push(status),onError:error=>errors.push(error)});return {session,streams,statuses,errors};}

test('camera session does not request permission until started',()=>{
  let requests=0;
  const {session}=harness(async()=>{requests++;return fakeStream();});
  assert.equal(requests,0);
  session.dispose();
  assert.equal(requests,0);
});

test('stopping an active camera releases every track',async()=>{
  const stream=fakeStream();
  const {session,streams,statuses}=harness(async()=>stream);
  await session.start();
  assert.equal(streams.at(-1),stream);
  assert.equal(statuses.at(-1),'live');
  session.stop();
  assert.equal(streams.at(-1),null);
  assert.equal(statuses.at(-1),'idle');
  assert.deepEqual(stream.getTracks().map(t=>t.stops),[1,1]);
  session.dispose();
  assert.deepEqual(stream.getTracks().map(t=>t.stops),[1,1]);
});

test('permission resolving after cancel stops the late stream',async()=>{
  const pending=deferred(),stream=fakeStream();
  const {session,streams,statuses}=harness(()=>pending.promise);
  const request=session.start();
  session.stop();
  pending.resolve(stream);
  await request;
  assert.equal(streams.includes(stream),false);
  assert.equal(statuses.at(-1),'idle');
  assert.deepEqual(stream.getTracks().map(t=>t.stops),[1,1]);
});

test('closing the view while permission is pending prevents callbacks and releases late tracks',async()=>{
  const pending=deferred(),stream=fakeStream();
  const {session,streams,statuses}=harness(()=>pending.promise);
  const request=session.start();
  session.dispose();
  const before={streams:streams.length,statuses:statuses.length};
  pending.resolve(stream);
  await request;
  assert.deepEqual({streams:streams.length,statuses:statuses.length},before);
  assert.deepEqual(stream.getTracks().map(t=>t.stops),[1,1]);
});

test('denied camera access can be retried successfully',async()=>{
  const stream=fakeStream();let attempts=0;
  const {session,statuses,errors}=harness(async()=>{if(++attempts===1)throw new Error('Denied');return stream;});
  await session.start();
  assert.equal(statuses.at(-1),'error');
  assert.equal(errors.length,1);
  await session.start();
  assert.equal(statuses.at(-1),'live');
  session.dispose();
  assert.deepEqual(stream.getTracks().map(t=>t.stops),[1,1]);
});

test('starting another camera request invalidates the previous request',async()=>{
  const first=deferred(),second=deferred(),oldStream=fakeStream(),newStream=fakeStream();let attempts=0;
  const {session,streams,statuses}=harness(()=>++attempts===1?first.promise:second.promise);
  const oldRequest=session.start(),newRequest=session.start();
  second.resolve(newStream);await newRequest;
  first.resolve(oldStream);await oldRequest;
  assert.equal(streams.at(-1),newStream);
  assert.equal(streams.includes(oldStream),false);
  assert.equal(statuses.at(-1),'live');
  assert.deepEqual(oldStream.getTracks().map(t=>t.stops),[1,1]);
  session.dispose();
  assert.deepEqual(newStream.getTracks().map(t=>t.stops),[1,1]);
});

test('stale request rejection cannot replace the current camera state',async()=>{
  const old=deferred(),stream=fakeStream();let attempts=0;
  const {session,statuses,errors}=harness(()=>++attempts===1?old.promise:Promise.resolve(stream));
  const oldRequest=session.start();
  await session.start();
  old.reject(new Error('Old denial'));await oldRequest;
  assert.equal(statuses.at(-1),'live');
  assert.equal(errors.length,0);
  session.dispose();
});

test('replacing a live camera releases its tracks and disposal blocks new requests',async()=>{
  const first=fakeStream(),second=fakeStream();let attempts=0;
  const {session}=harness(async()=>++attempts===1?first:second);
  await session.start();await session.start();
  assert.deepEqual(first.getTracks().map(t=>t.stops),[1,1]);
  session.dispose();await session.start();
  assert.equal(attempts,2);
  assert.deepEqual(second.getTracks().map(t=>t.stops),[1,1]);
});
