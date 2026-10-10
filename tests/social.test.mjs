import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILY_COUNT,transition,defaults,availablePlaymateIds,adventureProgress,hatchSeconds} from '../app/engine.ts';
import {applySavedAction,readSavedPet,SAVE_KEY} from '../app/storage.ts';

const start=new Date('2026-10-08T00:00:00Z');
const adoption={type:'adopt',egg:0,name:'Mossy',timezone:'Australia/Brisbane',commitments:defaults};
const later=days=>new Date(+start+60000+days*86400000);
const adopt=()=>transition(null,adoption,start);
function memory(initial=null){let raw=initial;return {getItem:()=>raw,setItem:(_,value)=>{raw=value;}};}
function evolve(p,days){const time=later(days);return transition(transition(p,{type:'evolve'},time),{type:'emerge'},new Date(+time+60000));}

test('two visitors can join after hatching without replacing or caring for the active pet',()=>{
  const before=adopt();
  assert.equal(availablePlaymateIds(before).length,FAMILY_COUNT-1);
  assert.ok(!availablePlaymateIds(before).includes('guest-0'));
  assert.throws(()=>transition(before,{type:'invite',ids:['guest-1']},start),/hatch/);
  const after=transition(before,{type:'invite',ids:['guest-1','guest-7']},later(0));
  assert.deepEqual(after.playmates,['guest-1','guest-7']);
  for(const key of ['name','bornAt','forms','food','care','checkins','gameWins','adventure'])assert.deepEqual(after[key],before[key]);
  assert.equal(before.playmates,undefined);
  assert.deepEqual(transition(after,{type:'invite',ids:[]},later(0)).playmates,[]);
});

test('visitor invitations reject duplicates, unknown IDs, the current hatchling and too many guests',()=>{
  const pet=adopt();
  for(const ids of [['guest-1','guest-1'],['guest-0'],[`guest-${FAMILY_COUNT}`],['ancestor-1'],['guest-1','guest-2','guest-3'],['guest-01'],[{}],null])assert.throws(()=>transition(pet,{type:'invite',ids},later(0)),/two different friends/);
});

test('completed snake games have an independent saved level and earn the adventure play step',()=>{
  const old=transition(adopt(),{type:'play',game:'stars'},later(0));
  assert.deepEqual(old.gameWins,{stars:1,moves:0});
  const pet=transition(old,{type:'play',game:'snake'},later(0));
  assert.deepEqual(pet.gameWins,{stars:1,moves:0,snake:1});
  assert.equal(pet.playCount,2);
  assert.equal(adventureProgress(pet,later(0)).playDone,true);
  assert.deepEqual(pet.checkins,{});
  assert.equal(pet.food.level,3);
  const resting=transition(pet,{type:'nap'},later(0));
  assert.throws(()=>transition(resting,{type:'play',game:'snake'},later(0)),/napping/);
});

test('old saves remain unchanged on read; invitations and snake survive reload',()=>{
  const store=memory();applySavedAction(store,adoption,start);
  const legacy=store.getItem(SAVE_KEY);
  assert.equal(readSavedPet(store).pet.playmates,undefined);
  assert.equal(readSavedPet(store).pet.gameWins,undefined);
  assert.equal(store.getItem(SAVE_KEY),legacy);
  applySavedAction(store,{type:'invite',ids:['guest-2','guest-3']},later(0));
  applySavedAction(store,{type:'play',game:'snake'},later(0));
  const reloaded=readSavedPet(store).pet;
  assert.deepEqual(reloaded.playmates,['guest-2','guest-3']);
  assert.deepEqual(reloaded.gameWins,{stars:0,moves:0,snake:1});
  assert.equal(reloaded.adventure.play,true);
});

test('new generations can invite their actual ancestors and keep archived visits intact',()=>{
  let p=transition(adopt(),{type:'invite',ids:['guest-1']},later(0));
  p=transition(p,{type:'play',game:'snake'},later(0));
  p=evolve(evolve(p,1),2);
  const child=transition(p,{type:'lineage',egg:7,name:'Pebble',expectedBornAt:p.bornAt},later(7));
  assert.deepEqual(child.lineage.ancestors[0].pet.playmates,['guest-1']);
  assert.equal(child.playmates,undefined);
  assert.equal(child.gameWins.snake,1);
  assert.equal(hatchSeconds(child,later(7)),60);
  assert.ok(availablePlaymateIds(child).includes('ancestor-1'));
  const invited=transition(child,{type:'invite',ids:['ancestor-1','guest-0']},later(8));
  assert.deepEqual(invited.playmates,['ancestor-1','guest-0']);
  const packet={version:1,revision:1,savedAt:later(8).toISOString(),pet:invited};
  assert.deepEqual(readSavedPet(memory(JSON.stringify(packet))).pet.playmates,invited.playmates);
});

test('invalid visitor references and impossible snake totals never overwrite saves',()=>{
  const good=memory();applySavedAction(good,adoption,start);
  for(const mutate of [
    p=>{p.playmates=['ancestor-1'];},p=>{p.playmates=['guest-0'];},p=>{p.playmates=[`guest-${FAMILY_COUNT}`];},
    p=>{p.playmates=['guest-1','guest-1'];},p=>{p.playmates=['guest-1','guest-2','guest-3'];},
    p=>{p.gameWins={stars:0,moves:0,snake:-1};},p=>{p.gameWins={stars:0,moves:0,snake:1};p.playCount=0;},
  ]){
    const data=JSON.parse(good.getItem(SAVE_KEY));mutate(data.pet);
    const raw=JSON.stringify(data),store=memory(raw);
    assert.throws(()=>readSavedPet(store),error=>error.code==='invalid');
    assert.equal(store.getItem(SAVE_KEY),raw);
  }
});

test('failed visitor and snake writes leave the last saved pet intact',()=>{
  const store=memory();applySavedAction(store,adoption,start);
  const raw=store.getItem(SAVE_KEY);
  const full={getItem:store.getItem,setItem(){throw new Error('QuotaExceededError');}};
  for(const action of [{type:'invite',ids:['guest-1']},{type:'play',game:'snake'}]){
    assert.throws(()=>applySavedAction(full,action,later(0)),error=>error.code==='unavailable');
    assert.equal(store.getItem(SAVE_KEY),raw);
  }
});
