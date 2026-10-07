import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,hatchSeconds,cocoonSeconds,growth,petSpriteStage,petStageName} from '../app/engine.ts';
import {SAVE_KEY,SaveError,readSavedPet,applySavedAction,resetSavedPet} from '../app/storage.ts';

const start=new Date('2026-10-04T02:00:00Z');
const adopt={type:'adopt',egg:0,name:'Remy',timezone:'Australia/Brisbane',commitments:defaults};
function memory(initial=null) {
  let raw=initial;
  return {getItem(key){assert.equal(key,SAVE_KEY);return raw;},setItem(key,value){assert.equal(key,SAVE_KEY);raw=value;}};
}
const nextDay=days=>new Date(+start+days*86400000+60000);

test('explicit reset clears the pet and permits a fresh egg without losing revision history',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const before=applySavedAction(storage,{type:'play',game:'stars'},nextDay(0));
  const reset=resetSavedPet(storage,before,nextDay(0));
  assert.deepEqual(readSavedPet(storage),{pet:null,revision:before.revision+1});
  const fresh=applySavedAction(storage,{...adopt,egg:5,name:'New friend'},nextDay(0));
  assert.equal(fresh.revision,reset.revision+1);
  assert.equal(fresh.pet.egg,5);
  assert.equal(fresh.pet.gameWins,undefined);
  assert.deepEqual(fresh.pet.checkins,{});
});

test('reset refuses stale confirmations and leaves failed writes untouched',()=>{
  const storage=memory();const stale=applySavedAction(storage,adopt,start);
  const current=applySavedAction(storage,{type:'play',game:'stars'},nextDay(0));
  const raw=storage.getItem(SAVE_KEY);
  assert.throws(()=>resetSavedPet(storage,stale),error=>error.code==='conflict');
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>resetSavedPet(full,current),error=>error.code==='unavailable');
  assert.equal(storage.getItem(SAVE_KEY),raw);
  resetSavedPet(storage,current);
  const empty=storage.getItem(SAVE_KEY);
  assert.throws(()=>resetSavedPet(storage,current),error=>error.code==='conflict');
  assert.equal(storage.getItem(SAVE_KEY),empty);
});

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

test('game progression persists independently and preserves earlier play totals',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  applySavedAction(storage,{type:'play'},nextDay(0));
  const legacy=storage.getItem(SAVE_KEY);
  assert.equal(readSavedPet(storage).pet.gameWins,undefined);
  assert.equal(storage.getItem(SAVE_KEY),legacy);
  applySavedAction(storage,{type:'play',game:'stars'},nextDay(0));
  applySavedAction(storage,{type:'play',game:'moves'},nextDay(0));
  applySavedAction(storage,{type:'play',game:'stars'},nextDay(0));
  const reloaded=readSavedPet(storage).pet;
  assert.deepEqual(reloaded.gameWins,{stars:2,moves:1});
  assert.equal(reloaded.playCount,4);
  assert.deepEqual(reloaded.checkins,{});
  assert.equal(reloaded.food.level,3);
});

test('failed or invalid game completions cannot advance a saved level',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const previous=storage.getItem(SAVE_KEY);
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>applySavedAction(full,{type:'play',game:'stars'},nextDay(0)),/not saved/);
  assert.throws(()=>applySavedAction(storage,{type:'play',game:'unknown'},nextDay(0)),/Choose one/);
  assert.equal(storage.getItem(SAVE_KEY),previous);
  for(const wins of [{stars:-1,moves:0},{stars:1},{stars:1,moves:0},{stars:0.5,moves:0}]){
    const broken=JSON.parse(previous);broken.pet.gameWins=wins;
    const saved=memory(JSON.stringify(broken));
    assert.throws(()=>readSavedPet(saved),SaveError);
  }
});

test('old saves gain daily care without a migration write and cross-tab repeats do not duplicate mastery',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const old=storage.getItem(SAVE_KEY);
  assert.equal(readSavedPet(storage).pet.care,undefined);
  assert.equal(storage.getItem(SAVE_KEY),old);
  applySavedAction(storage,{type:'care',activity:'brush'},nextDay(0));
  applySavedAction(storage,{type:'care',activity:'brush'},nextDay(0));
  applySavedAction(storage,{type:'care',activity:'wash'},nextDay(0));
  const reloaded=readSavedPet(storage).pet;
  assert.equal(reloaded.care.xp,2);
  assert.deepEqual(reloaded.care.completed,{brush:'2026-10-04',wash:'2026-10-04'});
  assert.deepEqual(reloaded.checkins,{});
  assert.equal(reloaded.food.level,3);
  applySavedAction(storage,{type:'care',activity:'wash'},nextDay(1));
  assert.equal(readSavedPet(storage).pet.care.xp,3);
});

test('failed care and bedtime writes preserve the previous save',()=>{
  const storage=memory();applySavedAction(storage,adopt,start);
  const before=storage.getItem(SAVE_KEY);
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  for(const action of [{type:'care',activity:'wash'},{type:'bedtime'}]) {
    assert.throws(()=>applySavedAction(full,action,nextDay(0)),error=>error.code==='unavailable');
    assert.equal(storage.getItem(SAVE_KEY),before);
  }
  applySavedAction(storage,{type:'bedtime'},nextDay(0));
  const sleeping=readSavedPet(storage).pet;
  assert.equal(sleeping.restMode,'bedtime');
  assert.equal(Date.parse(sleeping.restUntil)-(+nextDay(0)),8*3600000);
  applySavedAction(storage,{type:'wake'},new Date(+nextDay(0)+1000));
  assert.equal(readSavedPet(storage).pet.restMode,undefined);
});

function saveReadyFamily(storage) {
  applySavedAction(storage,adopt,start);
  applySavedAction(storage,{type:'care',activity:'pat'},nextDay(0));
  applySavedAction(storage,{type:'play',game:'moves'},nextDay(0));
  for(const day of [1,2]) {
    applySavedAction(storage,{type:'evolve'},nextDay(day));
    applySavedAction(storage,{type:'emerge'},new Date(+nextDay(day)+60000));
  }
  return readSavedPet(storage).pet;
}

test('lineage archive, inherited mastery and the fresh egg all survive storage reload',()=>{
  const storage=memory(),parent=saveReadyFamily(storage);
  applySavedAction(storage,{type:'lineage',name:'Remy II',expectedBornAt:parent.bornAt},nextDay(7));
  const child=readSavedPet(storage).pet;
  assert.equal(child.lineage.generation,2);
  assert.equal(child.lineage.variant,1);
  assert.equal(child.lineage.ancestors.length,1);
  assert.deepEqual(child.lineage.ancestors[0].pet.forms,parent.forms);
  assert.equal(child.lineage.ancestors[0].pet.care.xp,1);
  assert.equal(child.lineage.ancestors[0].pet.gameWins.moves,1);
  assert.equal(child.gameWins.moves,1);
  assert.equal(child.care.xp,1);
  assert.deepEqual(child.care.completed,{});
  assert.equal(hatchSeconds(child,nextDay(7)),60);
  const raw=storage.getItem(SAVE_KEY);
  readSavedPet(storage);
  assert.equal(storage.getItem(SAVE_KEY),raw,'reading the album must not alter the saved family');
});

test('failed lineage saves and stale confirmations cannot remove or archive a different pet',()=>{
  const storage=memory(),parent=saveReadyFamily(storage);
  const before=storage.getItem(SAVE_KEY),action={type:'lineage',name:'Remy II',expectedBornAt:parent.bornAt};
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>applySavedAction(full,action,nextDay(7)),error=>error.code==='unavailable');
  assert.equal(storage.getItem(SAVE_KEY),before);
  applySavedAction(storage,action,nextDay(7));
  const after=storage.getItem(SAVE_KEY);
  assert.throws(()=>applySavedAction(storage,action,nextDay(8)),/companion changed/);
  assert.equal(storage.getItem(SAVE_KEY),after);
});

test('malformed care, bedtime and ancestral snapshots are rejected without changing stored history',()=>{
  const good=memory(),parent=saveReadyFamily(good);
  applySavedAction(good,{type:'lineage',name:'Remy II',expectedBornAt:parent.bornAt},nextDay(7));
  for(const mutate of [
    p=>{p.care.xp=-1;},p=>{p.care.xp=0.5;},p=>{p.care.completed.wash='2026-02-30';},
    p=>{p.care.completed.wash='2026-10-20';},p=>{p.care.completed.feed='2026-10-11';},
    p=>{p.care.lastCompletedAt='yesterday';},p=>{p.timezone='broken';p.care.completed.wash='2026-10-11';},
    p=>{p.restMode='bedtime';p.restUntil=nextDay(8).toISOString();},
    p=>{p.lineage.generation=3;},p=>{p.lineage.variant=0;},p=>{p.lineage.ancestors=[];},
    p=>{p.lineage.ancestors[0].pet.forms=[];},p=>{p.lineage.ancestors[0].generation=9;},
    p=>{p.lineage.ancestors[0].pet.lineage={generation:1,variant:0,ancestors:[]};},
    p=>{p.lineage.ancestors[0].archivedAt=start.toISOString();},
  ]) {
    const value=JSON.parse(good.getItem(SAVE_KEY));mutate(value.pet);
    const original=JSON.stringify(value),storage=memory(original);
    assert.throws(()=>readSavedPet(storage),error=>error instanceof SaveError&&error.code==='invalid');
    assert.equal(storage.getItem(SAVE_KEY),original);
  }
});

test('both new families and all five pinned appearances survive reload and family archiving',()=>{
  for(const egg of [6,7]) {
    const storage=memory();applySavedAction(storage,{...adopt,egg},start);
    for(let day=1;day<=4;day++) {
      applySavedAction(storage,{type:'evolve'},nextDay(day));
      applySavedAction(storage,{type:'emerge'},new Date(+nextDay(day)+60000));
      assert.equal(petSpriteStage(readSavedPet(storage).pet),day+1);
    }
    const parent=readSavedPet(storage).pet;
    assert.deepEqual(parent.forms.map(form=>form.visualForm),[1,2,3,4,5]);
    assert.equal(petStageName(parent),'Ancient');
    applySavedAction(storage,{type:'lineage',name:'New family egg',expectedBornAt:parent.bornAt},nextDay(7));
    const child=readSavedPet(storage).pet;
    assert.equal(child.egg,egg);
    assert.equal(petSpriteStage(child),1);
    assert.equal(petSpriteStage(child.lineage.ancestors[0].pet),5);
    assert.deepEqual(child.lineage.ancestors[0].pet.forms,parent.forms);
  }
});

function oldRenewalSave() {
  const storage=memory();applySavedAction(storage,adopt,start);
  const value=JSON.parse(storage.getItem(SAVE_KEY));
  value.pet.forms=[0,2,6,10,15].map(stage=>({stage,trait:'heart',at:nextDay(stage).toISOString().slice(0,10)}));
  value.pet.highestStage=15;value.pet.revealedStage=15;
  return memory(JSON.stringify(value));
}

test('old renewal saves retain their artwork and labels without a migration write',()=>{
  const storage=oldRenewalSave(),before=storage.getItem(SAVE_KEY);
  const loaded=readSavedPet(storage).pet;
  assert.equal(storage.getItem(SAVE_KEY),before);
  assert.deepEqual(loaded.forms.map(form=>petSpriteStage(loaded,form.stage)),[1,2,3,2,3]);
  assert.equal(petStageName(loaded),'Renewal 2');
  applySavedAction(storage,{type:'evolve'},nextDay(20));
  const entered=storage.getItem(SAVE_KEY);
  const full={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>applySavedAction(full,{type:'emerge'},new Date(+nextDay(20)+60000)),error=>error.code==='unavailable');
  assert.equal(storage.getItem(SAVE_KEY),entered);
  applySavedAction(storage,{type:'emerge'},new Date(+nextDay(20)+60000));
  const emerged=readSavedPet(storage).pet;
  assert.equal(petSpriteStage(emerged),4);
  assert.equal(petStageName(emerged),'Radiant');
  assert.deepEqual(emerged.forms.slice(0,loaded.forms.length),loaded.forms);
  assert.deepEqual(emerged.forms.slice(0,loaded.forms.length).map(form=>petSpriteStage(emerged,form.stage)),[1,2,3,2,3]);
});

test('legacy ancestral forms remain unchanged as a descendant grows',()=>{
  const storage=oldRenewalSave(),parent=readSavedPet(storage).pet;
  applySavedAction(storage,{type:'lineage',name:'Remy II',expectedBornAt:parent.bornAt},nextDay(20));
  const before=storage.getItem(SAVE_KEY);
  const child=readSavedPet(storage).pet;
  assert.equal(storage.getItem(SAVE_KEY),before);
  assert.deepEqual(child.lineage.ancestors[0].pet.forms,parent.forms);
  assert.equal(petSpriteStage(child.lineage.ancestors[0].pet),3);
  assert.equal(petStageName(child.lineage.ancestors[0].pet),'Renewal 2');
  applySavedAction(storage,{type:'evolve'},nextDay(21));
  applySavedAction(storage,{type:'emerge'},new Date(+nextDay(21)+60000));
  const reloaded=readSavedPet(storage).pet;
  assert.equal(petSpriteStage(reloaded),2);
  assert.deepEqual(reloaded.lineage.ancestors[0].pet.forms,parent.forms);
  assert.equal(petSpriteStage(reloaded.lineage.ancestors[0].pet),3);
});

test('invalid family indices and visual pins cannot corrupt current or archived progress',()=>{
  const good=memory(),parent=saveReadyFamily(good);
  applySavedAction(good,{type:'lineage',name:'Remy II',expectedBornAt:parent.bornAt},nextDay(7));
  for(const mutate of [
    p=>{p.egg=8;},p=>{p.egg=6.5;},p=>{p.lineage.ancestors[0].pet.egg=8;},
    ...[0,-1,6,1.5,null,'4'].map(value=>p=>{p.forms[0].visualForm=value;}),
    p=>{p.forms[0].visualForm=5;},p=>{p.lineage.ancestors[0].pet.forms[1].visualForm=6;},
  ]) {
    const value=JSON.parse(good.getItem(SAVE_KEY));mutate(value.pet);
    const original=JSON.stringify(value),storage=memory(original);
    assert.throws(()=>readSavedPet(storage),error=>error instanceof SaveError&&error.code==='invalid');
    assert.equal(storage.getItem(SAVE_KEY),original);
  }
});
