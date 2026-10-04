import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,hatchSeconds,cocoonSeconds,growth} from '../app/engine.ts';
import {SAVE_KEY,SaveError,readSavedPet,applySavedAction} from '../app/storage.ts';

const start=new Date('2026-10-04T02:00:00Z');
const adopt={type:'adopt',egg:0,name:'Remy',timezone:'Australia/Brisbane',commitments:defaults};
function memory(initial=null) {
  let raw=initial;
  return {getItem(key){assert.equal(key,SAVE_KEY);return raw;},setItem(key,value){assert.equal(key,SAVE_KEY);raw=value;}};
}
const nextDay=days=>new Date(+start+days*86400000+60000);

test('first visit has no pet and reading does not write demo progress',()=>{
  const storage=memory();
  assert.deepEqual(readSavedPet(storage),{pet:null,revision:0});
  assert.equal(storage.getItem(SAVE_KEY),null);
});

test('adoption, chores and food survive a new read from browser storage',()=>{
  const storage=memory();
  const first=applySavedAction(storage,adopt,start);
  assert.equal(first.revision,1);
  assert.equal(hatchSeconds(readSavedPet(storage).pet,start),60);
  applySavedAction(storage,{type:'checkin',done:['shoes','teeth']},nextDay(0));
  applySavedAction(storage,{type:'feed',food:'meal'},nextDay(1));
  const reload=readSavedPet(storage);
  assert.equal(reload.revision,3);
  assert.deepEqual(reload.pet.checkins['2026-10-04'].items.filter(item=>item.done).map(item=>item.id),['shoes','teeth']);
  assert.equal(reload.pet.food.level,2);
});

test('cocoon countdown resumes after closing the page',()=>{
  const storage=memory();
  applySavedAction(storage,adopt,start);
  const entered=applySavedAction(storage,{type:'evolve'},nextDay(1));
  const halfWay=new Date(+nextDay(1)+30000);
  assert.equal(cocoonSeconds(readSavedPet(storage).pet,halfWay),30);
  const emerged=applySavedAction(storage,{type:'emerge'},new Date(+nextDay(1)+60000));
  assert.equal(emerged.pet.revealedStage,1);
  assert.equal(emerged.pet.forms.length,entered.pet.forms.length+1);
  assert.equal(readSavedPet(storage).pet.cocoon,null);
});

test('each action reads the newest persisted pet, preserving changes from another tab',()=>{
  const storage=memory();
  const staleView=applySavedAction(storage,adopt,start);
  applySavedAction(storage,{type:'checkin',done:['shoes']},nextDay(0));
  const current=applySavedAction(storage,{type:'pet'},nextDay(0));
  assert.equal(Object.keys(staleView.pet.checkins).length,0);
  assert.equal(current.pet.checkins['2026-10-04'].items[0].done,true);
  assert.equal(current.pet.pettedDate,'2026-10-04');
  assert.equal(current.revision,3);
});

test('another tab cannot adopt over an existing companion',()=>{
  const storage=memory();
  applySavedAction(storage,adopt,start);
  const original=storage.getItem(SAVE_KEY);
  assert.throws(()=>applySavedAction(storage,{...adopt,name:'Replacement'},start),/already have a companion/);
  assert.equal(storage.getItem(SAVE_KEY),original);
});

test('malformed and unsupported saves remain untouched and block replacement',()=>{
  for(const original of ['{bad json',JSON.stringify({version:2,pet:{name:'Keep me'}}),JSON.stringify({version:1,revision:1,pet:{egg:98}})]) {
    const storage=memory(original);
    assert.throws(()=>readSavedPet(storage),SaveError);
    assert.throws(()=>applySavedAction(storage,adopt,start),SaveError);
    assert.equal(storage.getItem(SAVE_KEY),original);
  }
});

test('invalid nested state cannot crash the UI or silently erase the save',()=>{
  const good=memory();
  applySavedAction(good,adopt,start);
  for(const mutate of [
    p=>{p.timezone='not/a/timezone';},p=>{p.food.level=-1;},p=>{p.bornDate='2026-02-30';},
    p=>{p.bornAt='yesterday';},p=>{p.commitments[0].kind='unknown';},
    p=>{p.forms=[];},p=>{p.highestStage=-1;},p=>{p.revealedStage=2;},
    p=>{p.playCount=-1;},p=>{p.playCount=0.5;},p=>{p.playCount=Number.MAX_SAFE_INTEGER+1;},p=>{p.lastPlayedAt='yesterday';},
    p=>{p.cocoon={startedAt:start.toISOString(),endsAt:start.toISOString(),targetStage:1,trait:'heart'};},
  ]) {
    const value=JSON.parse(good.getItem(SAVE_KEY));mutate(value.pet);
    const original=JSON.stringify(value);const storage=memory(original);
    assert.throws(()=>readSavedPet(storage),error=>error instanceof SaveError&&error.code==='invalid');
    assert.throws(()=>applySavedAction(storage,adopt,start),SaveError);
    assert.equal(storage.getItem(SAVE_KEY),original);
  }
});

test('blocked storage reports a readable error',()=>{
  const storage={getItem(){throw new Error('SecurityError');},setItem(){assert.fail('Must not write');}};
  assert.throws(()=>readSavedPet(storage),error=>error.code==='unavailable'&&/Allow website storage/.test(error.message));
  assert.throws(()=>applySavedAction(storage,adopt,start),error=>error.code==='unavailable');
});

test('a full browser store does not report a successful save or change previous progress',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const original=storage.getItem(SAVE_KEY);
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>applySavedAction(full,{type:'pet'},nextDay(0)),error=>error.code==='unavailable'&&/not saved/.test(error.message));
  assert.equal(storage.getItem(SAVE_KEY),original);
});

test('a save changed during an update is detected and kept',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const before=storage.getItem(SAVE_KEY);
  applySavedAction(storage,{type:'checkin',done:['teeth']},nextDay(0));
  const after=storage.getItem(SAVE_KEY);
  let reads=0;
  const interrupted={getItem(){return ++reads===1?before:after;},setItem(){assert.fail('Must not overwrite another tab');}};
  assert.throws(()=>applySavedAction(interrupted,{type:'pet'},nextDay(0)),error=>error.code==='conflict');
  assert.equal(storage.getItem(SAVE_KEY),after);
});

test('completed games persist across reloads and retain other care',()=>{
  const storage=memory();
  applySavedAction(storage,adopt,start);
  applySavedAction(storage,{type:'checkin',done:['shoes']},nextDay(0));
  applySavedAction(storage,{type:'play'},nextDay(0));
  let reload=readSavedPet(storage);
  assert.equal(reload.pet.playCount,1);
  assert.equal(reload.pet.lastPlayedAt,nextDay(0).toISOString());
  assert.equal(reload.pet.checkins['2026-10-04'].items[0].done,true);
  assert.equal(reload.pet.checkins['2026-10-04'].items[1].done,false);
  applySavedAction(storage,{type:'play'},new Date(+nextDay(0)+1000));
  reload=readSavedPet(storage);
  assert.equal(reload.pet.playCount,2);
  assert.equal(reload.revision,4);
  assert.equal(reload.pet.food.level,3);
});

test('old v1 saves gain play fields without losing their pet or evolution history',()=>{
  const old=memory();applySavedAction(old,adopt,start);
  const packet=JSON.parse(old.getItem(SAVE_KEY));
  delete packet.pet.playCount;delete packet.pet.lastPlayedAt;
  packet.pet.highestStage=1;packet.pet.revealedStage=1;
  packet.pet.forms.push({stage:1,trait:'mind',at:'2026-10-09'});
  packet.pet.checkins['2026-10-09']={items:defaults.map(c=>({...c,done:c.id==='lunchbox'})),savedAt:nextDay(5).toISOString()};
  const original=JSON.stringify(packet);const storage=memory(original);
  const loaded=readSavedPet(storage);
  assert.equal(storage.getItem(SAVE_KEY),original,'reading must not silently rewrite the old save');
  assert.equal(loaded.pet.playCount,undefined);
  assert.equal(growth(loaded.pet,nextDay(6)).stage,6,'old pets use the new daily cadence');
  const played=applySavedAction(storage,{type:'play'},nextDay(6));
  assert.equal(played.pet.playCount,1);
  assert.equal(played.pet.lastPlayedAt,nextDay(6).toISOString());
  assert.equal(played.pet.revealedStage,1,'catching up must still require the cocoon');
  assert.deepEqual(played.pet.forms,packet.pet.forms);
  assert.deepEqual(played.pet.checkins,packet.pet.checkins);
  assert.equal(played.pet.bornAt,packet.pet.bornAt);
  const cocoon=applySavedAction(storage,{type:'evolve'},nextDay(6));
  assert.equal(cocoon.pet.cocoon.targetStage,6);
  const emerged=applySavedAction(storage,{type:'emerge'},new Date(+nextDay(6)+60000));
  assert.equal(emerged.pet.revealedStage,6);
  assert.deepEqual(emerged.pet.forms.slice(0,2),packet.pet.forms);
});

test('rejected play during egg, cocoon or nap does not rewrite progress',()=>{
  for(const state of ['egg','cocoon','nap']) {
    const storage=memory();applySavedAction(storage,adopt,start);
    const now=state==='egg'?start:nextDay(1);
    if(state==='cocoon')applySavedAction(storage,{type:'evolve'},now);
    if(state==='nap')applySavedAction(storage,{type:'nap'},now);
    const original=storage.getItem(SAVE_KEY);
    assert.throws(()=>applySavedAction(storage,{type:'play'},now));
    assert.equal(storage.getItem(SAVE_KEY),original);
  }
});
