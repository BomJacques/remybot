import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transition, defaults, EVOLUTION_DAYS, hatchSeconds, cocoonSeconds, moodOf, dateKey, daysBetween, growth, foodAt, foodValue, preferences, careTrait} from '../app/engine.ts';

const d=s=>new Date(s);
const base=d('2026-10-04T02:00:00Z');
const fixtures=[{id:'bed',label:'Make my bed',kind:'body'},{id:'learning',label:'Read or do my homework',kind:'mind'},{id:'tidy',label:'Put my toys away',kind:'heart'}];
const adopt=(egg=0, now=base, timezone='Australia/Brisbane')=>transition(null,{type:'adopt',egg,name:'Remy',timezone,commitments:fixtures},now);
const at=(p, ms)=>new Date(Date.parse(p.bornAt)+ms);
const H=3600000;
const evolve=(p, now)=>transition(transition(p,{type:'evolve'},now),{type:'emerge'},new Date(+now+60000));
const clientSource=await readFile(new URL('../app/remybot.tsx',import.meta.url),'utf8');

test('incubation lasts exactly 60 seconds and rounds the countdown up',()=>{const p=adopt();assert.equal(hatchSeconds(p,base),60);assert.equal(hatchSeconds(p,new Date(+base+59999)),1);assert.equal(hatchSeconds(p,new Date(+base+60000)),0);assert.equal(hatchSeconds(p,new Date(+base+120000)),0);});
test('care is rejected before hatching and accepted at the boundary',()=>{const p=adopt();for(const action of [{type:'pet'},{type:'play'},{type:'feed',food:'meal'},{type:'checkin',done:[]},{type:'readStory'},{type:'evolve'}])assert.throws(()=>transition(p,action,at(p,-1)),/still getting ready/);assert.equal(transition(p,{type:'pet'},at(p,0)).pettedDate,'2026-10-04');});
test('commitments can be set during incubation',()=>{const p=adopt();assert.equal(transition(p,{type:'commitments',items:[defaults[0]]},base).commitments.length,1);});
test('incubation crossing midnight uses the hatch date',()=>{const p=adopt(0,d('2026-10-04T13:59:30Z'));assert.equal(p.bornDate,'2026-10-05');assert.equal(growth(p,d('2026-10-05T13:59:59Z')).stage,0);assert.equal(growth(p,d('2026-10-05T14:00:00Z')).stage,1);});
test('evolution occurs on each next local calendar day',()=>{const p=adopt();assert.equal(EVOLUTION_DAYS,1);assert.deepEqual([growth(p,d('2026-10-04T13:59:59Z')).stage,growth(p,d('2026-10-04T14:00:00Z')).stage,growth(p,d('2026-10-05T13:59:59Z')).stage,growth(p,d('2026-10-05T14:00:00Z')).stage],[0,1,1,2]);assert.throws(()=>transition(p,{type:'evolve'},d('2026-10-04T13:59:59Z')),/still growing/);assert.equal(transition(p,{type:'evolve'},d('2026-10-04T14:00:00Z')).cocoon.targetStage,1);});
test('spring DST preserves local calendar boundaries',()=>{const p=adopt(0,d('2026-03-08T05:00:00Z'),'America/New_York');assert.equal(dateKey(d('2026-03-09T03:59:59Z'),p.timezone),'2026-03-08');assert.equal(growth(p,d('2026-03-09T03:59:59Z')).stage,0);assert.equal(growth(p,d('2026-03-09T04:00:00Z')).stage,1);assert.equal(daysBetween('2026-03-08','2026-03-09'),1);});
test('autumn DST preserves local calendar boundaries',()=>{const p=adopt(0,d('2026-11-01T04:00:00Z'),'America/New_York');assert.equal(growth(p,d('2026-11-02T04:59:59Z')).stage,0);assert.equal(growth(p,d('2026-11-02T05:00:00Z')).stage,1);});
test('food remains full until 8h and loses exactly one block at 8h',()=>{const p=adopt();assert.equal(foodAt(p,at(p,8*H-1)).level,3);assert.equal(foodAt(p,at(p,8*H)).level,2);assert.equal(foodAt(p,at(p,16*H)).level,1);assert.equal(foodAt(p,at(p,24*H)).level,0);});
test('food decay uses real hours across DST',()=>{const p=adopt(0,d('2026-03-08T04:00:00Z'),'America/New_York');assert.equal(foodAt(p,at(p,8*H-1)).level,3);assert.equal(foodAt(p,at(p,8*H)).level,2);});
test('feeding at positive food preserves the partial interval',()=>{const p=adopt();const fed=transition(p,{type:'feed',food:'snack'},at(p,9*H));assert.equal(fed.food.level,3);assert.equal(foodAt(fed,at(p,16*H-1)).level,3);assert.equal(foodAt(fed,at(p,16*H)).level,2);});
test('long absence has no negative food debt',()=>{const p=adopt();const t=at(p,100*24*H);const fed=transition(p,{type:'feed',food:'meal'},t);assert.equal(foodAt(p,t).level,0);assert.equal(fed.food.level,2);assert.equal(foodAt(fed,new Date(+t+8*H-1)).level,2);assert.equal(foodAt(fed,new Date(+t+8*H)).level,1);});
test('full food rejects extra feeding',()=>assert.throws(()=>transition(adopt(),{type:'feed',food:'meal'},at(adopt(),0)),/is full/));
test('all six food preferences are distinct, internally consistent, and match lore',async()=>{const lore=JSON.parse(await readFile(new URL('../app/lore.json',import.meta.url),'utf8'));assert.equal(new Set(preferences.map(p=>p.likes+'/'+p.dislikes)).size,6);for(let egg=0;egg<6;egg++){assert.notEqual(preferences[egg].likes,preferences[egg].dislikes);assert.equal(foodValue(egg,preferences[egg].likes),2);assert.equal(foodValue(egg,preferences[egg].dislikes),1);assert.equal(lore[egg].likes,preferences[egg].likes);assert.equal(lore[egg].dislikes,preferences[egg].dislikes);}});
test('each egg gains the documented preferred food value',()=>{for(let egg=0;egg<6;egg++){const p=adopt(egg);const fed=transition(p,{type:'feed',food:preferences[egg].likes},at(p,24*H));assert.equal(fed.food.level,2);}});
test('multiple feeds in a day give one daily feeding entry',()=>{let p=adopt(0,d('2026-10-03T14:00:00Z'));p=transition(p,{type:'feed',food:'meal'},at(p,8*H));p=transition(p,{type:'feed',food:'snack'},at(p,16*H));assert.equal(p.fedDates.length,1);});
test('repeated same-day check-ins overwrite rather than stack',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed']},at(p,1));p=transition(p,{type:'checkin',done:['learning']},at(p,2));assert.equal(Object.keys(p.checkins).length,1);assert.equal(p.checkins[p.bornDate].items.filter(i=>i.done).length,1);assert.equal(careTrait(p),'mind');});
test('duplicate done IDs cannot multiply trait points',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed','bed']},at(p,0));assert.equal(p.checkins[p.bornDate].items.filter(i=>i.done).length,1);});
test('unknown check-in IDs and duplicate commitment IDs are rejected',()=>{const p=adopt();assert.throws(()=>transition(p,{type:'checkin',done:['unknown']},at(p,0)));assert.throws(()=>transition(p,{type:'commitments',items:[defaults[0],defaults[0]]},at(p,0)));});
test('commitment changes retain past snapshots and new check-ins use current definitions',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed']},at(p,0));p=transition(p,{type:'commitments',items:[{...fixtures[0],label:'New chore',kind:'mind'}]},at(p,24*H));assert.equal(p.checkins[p.bornDate].items[0].label,'Make my bed');p=transition(p,{type:'checkin',done:['bed']},at(p,24*H));assert.equal(p.checkins['2026-10-05'].items[0].label,'New chore');});
test('missed days catch up to latest stage, reveal once, and do not require food',()=>{const p=adopt();const now=at(p,27*24*H);assert.equal(growth(p,now).stage,27);const next=evolve(p,now);assert.equal(next.revealedStage,27);assert.equal(next.forms.length,2);assert.equal(next.forms[1].stage,27);assert.equal(foodAt(next,now).level,0);assert.throws(()=>transition(next,{type:'emerge'},new Date(+now+60000)),/no cocoon ready/);assert.throws(()=>transition(next,{type:'evolve'},now),/still growing/);assert.equal(evolve(next,at(p,28*24*H)).revealedStage,28);});
test('revealed form traits do not reroll after check-in edits',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed']},at(p,24*H));p=evolve(p,at(p,24*H));const form=structuredClone(p.forms[1]);p=transition(p,{type:'checkin',done:['learning']},at(p,24*H));assert.deepEqual(p.forms[1],form);});
test('JSON reload preserves hatch, care, and evolution',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed']},at(p,24*H));p=evolve(p,at(p,24*H));const reloaded=JSON.parse(JSON.stringify(p));assert.deepEqual(growth(reloaded,at(p,2*24*H)),growth(p,at(p,2*24*H)));assert.equal(hatchSeconds(reloaded,at(p,2*24*H)),0);assert.equal(careTrait(reloaded),careTrait(p));});
test('already unlocked growth never reverses under a backward clock',()=>{let p=adopt();p=evolve(p,at(p,10*24*H));assert.equal(growth(p,at(p,1*24*H)).stage,10);});
test('REGRESSION: backward clock cannot create a negative progress percentage',()=>{let p=adopt();p=evolve(p,at(p,10*24*H));assert.ok(growth(p,at(p,1*24*H)).progress>=0);});
test('REGRESSION: editing a checked commitment leaves today available to resave',()=>{let p=adopt();p=transition(p,{type:'checkin',done:['bed']},at(p,0));p=transition(p,{type:'commitments',items:p.commitments.map(i=>i.id==='bed'?{...i,label:'Brush my teeth',kind:'mind'}:i)},at(p,1));const daily=p.checkins[p.bornDate];const draft=daily.items.filter(i=>i.done&&p.commitments.some(c=>c.id===i.id)).map(i=>i.id);const expression=clientSource.match(/const savedSame=([^;]+);/)?.[1];assert.ok(expression,'savedSame expression must match source');const savedSame=new Function('pet','daily','draft','return '+expression)(p,daily,draft);assert.equal(savedSame,false,'UI incorrectly disables resave even though the saved label and trait are obsolete');});
test('cocoon takes exactly 60 seconds, survives reload, and forbids care',()=>{let p=adopt();const t=at(p,24*H);p=transition(p,{type:'evolve'},t);assert.equal(p.revealedStage,0);assert.equal(cocoonSeconds(p,t),60);assert.equal(cocoonSeconds(p,new Date(+t+59999)),1);assert.throws(()=>transition(p,{type:'emerge'},new Date(+t+59999)),/more time/);for(const action of [{type:'pet'},{type:'play'},{type:'feed',food:'meal'},{type:'nap'},{type:'wake'}])assert.throws(()=>transition(p,action,t),/cocoon/);assert.throws(()=>transition(p,{type:'evolve'},t),/already in a cocoon/);p=JSON.parse(JSON.stringify(p));assert.equal(transition(p,{type:'emerge'},new Date(+t+60000)).revealedStage,1);});
test('cocoon trait is snapshotted at entry',()=>{let p=adopt();const t=at(p,24*H);p=transition(p,{type:'checkin',done:['bed']},t);p=transition(p,{type:'evolve'},t);p=transition(p,{type:'checkin',done:['learning']},new Date(+t+30000));p=transition(p,{type:'emerge'},new Date(+t+60000));assert.equal(p.forms[1].trait,'body');});
test('late emergence catches up stages without duplicate forms',()=>{let p=adopt();p=transition(p,{type:'evolve'},at(p,24*H));p=transition(p,{type:'emerge'},at(p,30*24*H));assert.equal(p.revealedStage,30);assert.equal(p.forms.length,2);assert.equal(p.cocoon,null);});
test('nap lasts 20 minutes and wake ends it early',()=>{let p=adopt();const t=at(p,1);p=transition(p,{type:'nap'},t);assert.equal(moodOf(p,t),'sleeping');assert.equal(moodOf(p,new Date(+t+20*60000-1)),'sleeping');assert.notEqual(moodOf(p,new Date(+t+20*60000)),'sleeping');assert.notEqual(moodOf(transition(p,{type:'wake'},new Date(+t+30000)),new Date(+t+30000)),'sleeping');});
test('incomplete saved chores are sad and all complete chores are happy',()=>{let p=adopt();const t=at(p,1);assert.equal(moodOf(p,t),'sad');p=transition(p,{type:'checkin',done:['bed']},t);assert.equal(moodOf(p,t),'sad');p=transition(p,{type:'checkin',done:p.commitments.map(c=>c.id)},t);assert.equal(moodOf(p,t),'happy');});
test('child defaults are the requested three chores',()=>assert.deepEqual(defaults.map(i=>i.label),['Put shoes away','Brush teeth','Empty lunch box']));

test('completed play is counted once without feeding or completing chores',()=>{
  const original=adopt();const now=at(original,1);
  const played=transition(original,{type:'play'},now);
  assert.equal(played.playCount,1);
  assert.equal(played.lastPlayedAt,now.toISOString());
  assert.deepEqual(played.checkins,original.checkins);
  assert.deepEqual(played.food,original.food);
  assert.deepEqual(played.fedDates,original.fedDates);
  assert.equal(played.pettedDate,original.pettedDate);
  assert.equal(moodOf(played,now),'sad');
  assert.equal(original.playCount,undefined,'transition must not mutate the old save');
  const again=transition(played,{type:'play'},new Date(+now+5000));
  assert.equal(again.playCount,2);
  assert.equal(again.lastPlayedAt,new Date(+now+5000).toISOString());
});

test('play preserves saved chores and their happy mood',()=>{
  const original=adopt();const now=at(original,1);
  const checked=transition(original,{type:'checkin',done:original.commitments.map(c=>c.id)},now);
  const played=transition(checked,{type:'play'},now);
  assert.deepEqual(played.checkins,checked.checkins);
  assert.equal(moodOf(played,now),'happy');
});

test('play waits for the nap boundary or an explicit wake',()=>{
  const p=adopt();const now=at(p,1);const asleep=transition(p,{type:'nap'},now);
  assert.throws(()=>transition(asleep,{type:'play'},new Date(+now+20*60000-1)),/napping/);
  assert.equal(transition(asleep,{type:'play'},new Date(+now+20*60000)).playCount,1);
  assert.equal(transition(transition(asleep,{type:'wake'},now),{type:'play'},now).playCount,1);
});

test('play counter cannot overflow an exact integer',()=>{
  const p={...adopt(),playCount:Number.MAX_SAFE_INTEGER};
  assert.throws(()=>transition(p,{type:'play'},at(p,1)),/counter is full/);
});

