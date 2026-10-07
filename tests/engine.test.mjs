import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {transition, defaults, EVOLUTION_DAYS, FAMILY_COUNT, FORM_COUNT, hatchSeconds, cocoonSeconds, moodOf, dateKey, daysBetween, growth, foodAt, foodValue, preferences, careTrait, spriteStage, petSpriteStage, petStageName, careProgress, lineageStatus, generationOf, variantOf} from '../app/engine.ts';

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
test('all eight food preferences are internally consistent and match lore',async()=>{const lore=JSON.parse(await readFile(new URL('../app/lore.json',import.meta.url),'utf8'));assert.equal(preferences.length,FAMILY_COUNT);assert.equal(lore.length,FAMILY_COUNT);assert.equal(new Set(preferences.slice(0,6).map(p=>p.likes+'/'+p.dislikes)).size,6,'original families retain their six different pairings');for(let egg=0;egg<FAMILY_COUNT;egg++){assert.notEqual(preferences[egg].likes,preferences[egg].dislikes);assert.equal(foodValue(egg,preferences[egg].likes),2);assert.equal(foodValue(egg,preferences[egg].dislikes),1);assert.equal(lore[egg].likes,preferences[egg].likes);assert.equal(lore[egg].dislikes,preferences[egg].dislikes);}});
test('each egg gains the documented preferred food value',()=>{for(let egg=0;egg<FAMILY_COUNT;egg++){const p=adopt(egg);const fed=transition(p,{type:'feed',food:preferences[egg].likes},at(p,24*H));assert.equal(fed.food.level,2);}});
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

test('every daily cocoon changes the visible form, including the first renewal',()=>{
  assert.deepEqual([0,1,2,3,4,5,6,7].map(spriteStage),[1,2,3,4,5,4,5,4]);
  for(let egg=0;egg<FAMILY_COUNT;egg++){
    let p=adopt(egg);
    for(let day=1;day<=14;day++){
      const previous=petSpriteStage(p);
      p=evolve(p,at(p,day*24*H));
      assert.notEqual(petSpriteStage(p),previous,`Egg ${egg}, day ${day} must reveal a different form`);
      assert.equal(petSpriteStage(JSON.parse(JSON.stringify(p))),petSpriteStage(p));
    }
  }
});

test('missed days and late emergence change the actual visible form without erasing growth',()=>{
  for(let egg=0;egg<FAMILY_COUNT;egg++){
    let p=adopt(egg);
    const expected=[1,2,3,4,5];
    const names=['Hatchling','Growing','Flourishing','Radiant','Ancient'];
    const dates=[1,3,9,27];
    assert.equal(petSpriteStage(p),expected[0]);
    for(const [index,day] of dates.entries()){
      const previous=petSpriteStage(p);
      p=transition(p,{type:'evolve'},at(p,day*24*H));
      assert.equal(petSpriteStage(p),previous,'Cocoon entry keeps the former appearance until emergence');
      p=transition(p,{type:'emerge'},at(p,(day+1)*24*H));
      assert.equal(p.revealedStage,day+1,'Calendar growth still catches up');
      assert.equal(petSpriteStage(p),expected[index+1]);
      assert.equal(petStageName(p),names[index+1],'Names follow actual discoveries rather than absent calendar days');
    }
    for(const [index,form] of p.forms.entries()){assert.equal(petSpriteStage(p,form.stage),expected[index],'History must show the form that actually emerged');assert.equal(petStageName(p,form.stage),names[index]);}
  }
});

// Decode the committed 8-bit RGBA PNGs so metadata or compression differences cannot
// make duplicate creature artwork pass the visual asset regression.
async function silhouette(path){
  const png=await readFile(new URL(path,import.meta.url));
  assert.equal(png.readUInt32BE(0),0x89504e47);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),chunks=[];
  assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0);
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
  const encoded=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++){
    const type=encoded[y*(stride+1)];assert.ok(type<=4);
    for(let x=0;x<stride;x++){
      const pos=y*stride+x,a=x>=4?pixels[pos-4]:0,b=y?pixels[pos-stride]:0,c=y&&x>=4?pixels[pos-stride-4]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][type];
      pixels[pos]=(encoded[y*(stride+1)+x+1]+predictor)&255;
    }
  }
  return Uint8Array.from({length:width*height},(_,index)=>pixels[index*4+3]>=128?1:0);
}

test('all eight eggs have five visibly distinct evolution silhouettes in every expression',async()=>{
  for(let egg=0;egg<FAMILY_COUNT;egg++){
    for(const folder of ['sprites','moods/happy','moods/sad','moods/hungry','moods/sleeping']){
      const forms=await Promise.all(Array.from({length:FORM_COUNT},(_,index)=>silhouette(`../public/${folder}/${egg}-${index+1}.png`)));
      for(let stage=1;stage<forms.length;stage++){
        for(let previous=0;previous<stage;previous++){
          let difference=0,union=0;
          for(let pixel=0;pixel<forms[stage].length;pixel++){
            if(forms[stage][pixel]||forms[previous][pixel])union++;
            if(forms[stage][pixel]!==forms[previous][pixel])difference++;
          }
          assert.ok(union>500,`${folder} egg ${egg} must not be blank`);
          assert.ok(difference/union>.05,`${folder} egg ${egg}: forms ${previous+1} and ${stage+1} need distinctly different silhouettes`);
        }
      }
    }
  }
});


test('hands-on care awards mastery once per activity per local day and never completes chores',()=>{
  const original=adopt();const now=at(original,1);
  let p=original;
  for(const activity of ['brush','wash','pat']) {
    p=transition(p,{type:'care',activity},now);
    p=transition(p,{type:'care',activity},now);
  }
  assert.deepEqual(careProgress(p,now),{xp:3,level:1,progress:60,untilNext:2,today:{brush:true,wash:true,pat:true}});
  assert.equal(p.pettedDate,p.bornDate);
  assert.deepEqual(p.checkins,original.checkins);
  assert.deepEqual(p.food,original.food);
  assert.equal(original.care,undefined,'care must not mutate an earlier save');
  assert.throws(()=>transition(p,{type:'care',activity:'unknown'},new Date(+now+1)),/Choose brushing/);
});

test('care follows local midnight including DST and does not farm XP under a backward clock',()=>{
  let p=adopt(0,d('2026-03-08T05:00:00Z'),'America/New_York');
  p=transition(p,{type:'care',activity:'wash'},d('2026-03-09T03:59:59Z'));
  assert.equal(p.care.completed.wash,'2026-03-08');
  p=transition(p,{type:'care',activity:'wash'},d('2026-03-09T04:00:00Z'));
  assert.equal(p.care.completed.wash,'2026-03-09');
  assert.equal(p.care.xp,2);
  assert.throws(()=>transition(p,{type:'care',activity:'wash'},d('2026-03-09T03:59:59Z')),/clock is earlier/);
  assert.equal(transition(p,{type:'care',activity:'wash'},d('2026-03-09T05:00:00Z')).care.xp,2);
});

test('mastery levels advance every five daily care completions and cannot overflow',()=>{
  let p=adopt();
  for(let day=0;day<2;day++)for(const activity of ['brush','wash','pat'])p=transition(p,{type:'care',activity},at(p,day*24*H));
  assert.equal(careProgress(p,at(p,24*H)).level,2);
  assert.equal(careProgress(p,at(p,24*H)).progress,20);
  const full={...p,care:{...p.care,xp:Number.MAX_SAFE_INTEGER}};
  assert.throws(()=>transition(full,{type:'care',activity:'brush'},at(p,2*24*H)),/care counter is full/);
});

test('hands-on care and bedtime wait for hatching, cocoon emergence and waking',()=>{
  const p=adopt();
  for(const action of [{type:'care',activity:'brush'},{type:'care',activity:'wash'},{type:'care',activity:'pat'},{type:'bedtime'}]) {
    assert.throws(()=>transition(p,action,base),/still getting ready/);
    assert.throws(()=>transition(transition(p,{type:'evolve'},at(p,24*H)),action,at(p,24*H)),/cocoon/);
    assert.throws(()=>transition(transition(p,{type:'bedtime'},at(p,1)),action,at(p,2)),/napping/);
  }
});

test('bedtime lasts eight real hours, survives reload and wake ends it early',()=>{
  const original=adopt(0,d('2026-11-01T04:00:00Z'),'America/New_York');const now=at(original,1);
  const asleep=JSON.parse(JSON.stringify(transition(original,{type:'bedtime'},now)));
  assert.equal(asleep.restMode,'bedtime');
  assert.equal(asleep.lastBedtimeAt,now.toISOString());
  assert.equal(Date.parse(asleep.restUntil)-(+now),8*H);
  assert.equal(moodOf(asleep,new Date(+now+8*H-1)),'sleeping');
  assert.notEqual(moodOf(asleep,new Date(+now+8*H)),'sleeping');
  for(const action of [{type:'feed',food:'meal'},{type:'pet'},{type:'play'},{type:'nap'},{type:'evolve'}])assert.throws(()=>transition(asleep,action,new Date(+now+1)),/napping/);
  const awake=transition(asleep,{type:'wake'},new Date(+now+1000));
  assert.equal(awake.restUntil,null);
  assert.equal(awake.restMode,undefined);
  assert.equal(awake.restedAt,new Date(+now+1000).toISOString());
  assert.deepEqual(awake.checkins,original.checkins);
  const nap=transition(awake,{type:'nap'},new Date(+now+2000));
  assert.equal(nap.restMode,'nap');
  assert.equal(Date.parse(nap.restUntil)-(+now+2000),20*60000);
});

function readyForLineage(p){return evolve(evolve(p,at(p,24*H)),at(p,2*24*H));}

test('lineage requires seven local days and two actual completed cocoons',()=>{
  const original=adopt();
  assert.deepEqual(lineageStatus(original,at(original,7*24*H)),{eligible:false,daysRemaining:0,evolutionsRemaining:2,generation:1});
  const caughtUp=evolve(original,at(original,27*24*H));
  assert.equal(caughtUp.revealedStage,27);
  assert.equal(lineageStatus(caughtUp,at(original,28*24*H)).evolutionsRemaining,1,'calendar catch-up is still one cocoon');
  const p=readyForLineage(original);
  assert.equal(lineageStatus(p,d('2026-10-10T13:59:59Z')).eligible,false);
  assert.equal(lineageStatus(p,d('2026-10-10T14:00:00Z')).eligible,true);
  const asleep=transition(p,{type:'bedtime'},at(p,7*24*H));
  assert.equal(lineageStatus(asleep,at(p,7*24*H)).eligible,false);
  assert.throws(()=>transition(original,{type:'lineage',name:'Remy II',expectedBornAt:original.bornAt},at(original,7*24*H)),/7 days/);
});

test('a voluntary new generation retains its parent in full and carries player mastery',()=>{
  let p=adopt(4);
  p=transition(p,{type:'checkin',done:['bed']},at(p,0));
  p=transition(p,{type:'play',game:'stars'},at(p,1));
  p=transition(p,{type:'care',activity:'brush'},at(p,2));
  p=readyForLineage(p);
  const before=JSON.stringify(p),now=at(p,7*24*H);
  const child=transition(p,{type:'lineage',name:'  Remy II  ',expectedBornAt:p.bornAt},now);
  assert.equal(JSON.stringify(p),before);
  assert.equal(child.name,'Remy II');
  assert.equal(child.egg,p.egg);
  assert.equal(generationOf(child),2);
  assert.equal(variantOf(child),1);
  assert.equal(hatchSeconds(child,now),60);
  assert.equal(child.forms.length,1);
  assert.equal(child.revealedStage,0);
  assert.equal(child.highestStage,0);
  assert.deepEqual(child.checkins,{});
  assert.deepEqual(child.fedDates,[]);
  assert.equal(child.pettedDate,null);
  assert.equal(child.food.level,3);
  assert.deepEqual(child.commitments,p.commitments);
  assert.deepEqual(child.gameWins,p.gameWins);
  assert.equal(child.playCount,p.playCount);
  assert.deepEqual(child.care,{xp:1,completed:{},lastCompletedAt:now.toISOString()});
  const ancestor=child.lineage.ancestors[0];
  assert.equal(ancestor.pet.name,p.name);
  assert.deepEqual(ancestor.pet.forms,p.forms);
  assert.deepEqual(ancestor.pet.checkins,p.checkins);
  assert.deepEqual(ancestor.pet.care,p.care);
  assert.equal(ancestor.pet.lineage,undefined);
  assert.equal(ancestor.archivedAt,now.toISOString());
});

test('lineage variants change between generations without recursively duplicating family records',()=>{
  let p=adopt();
  const expected=[0,1,2,3,1,2];
  for(let generation=1;generation<=expected.length;generation++) {
    assert.equal(generationOf(p),generation);
    assert.equal(variantOf(p),expected[generation-1]);
    if(generation===expected.length)break;
    p=readyForLineage(p);
    p=transition(p,{type:'lineage',name:`Remy ${generation+1}`,expectedBornAt:p.bornAt},at(p,7*24*H));
    assert.equal(p.lineage.ancestors.length,generation);
    for(const [index,ancestor] of p.lineage.ancestors.entries()) {
      assert.equal(ancestor.generation,index+1);
      assert.equal(ancestor.variant,expected[index]);
      assert.equal(ancestor.pet.lineage,undefined);
    }
    p=JSON.parse(JSON.stringify(p));
  }
});

test('stale lineage confirmations and invalid names cannot replace a companion',()=>{
  const p=readyForLineage(adopt()),now=at(p,7*24*H);
  assert.throws(()=>transition(p,{type:'lineage',name:'Remy II',expectedBornAt:'another pet'},now),/companion changed/);
  for(const name of ['', ' ', 'a'.repeat(25)])assert.throws(()=>transition(p,{type:'lineage',name,expectedBornAt:p.bornAt},now),/name between/);
});

test('Nimbus and Pebble adopt, hatch, feed and renew through all five forms',()=>{
  assert.equal(FAMILY_COUNT,8);assert.equal(FORM_COUNT,5);
  assert.deepEqual(preferences[6],{likes:'treat',dislikes:'meal'});
  assert.deepEqual(preferences[7],{likes:'meal',dislikes:'treat'});
  const sequence=[1,2,3,4,5,4,5,4];
  const names=['Hatchling','Growing','Flourishing','Radiant','Ancient','Renewal 1','Renewal 2','Renewal 3'];
  for(const egg of [6,7]) {
    let p=adopt(egg);
    assert.equal(hatchSeconds(p,base),60);
    assert.equal(p.forms[0].visualForm,1);
    assert.equal(petStageName(p),'Hatchling');
    p=transition(p,{type:'feed',food:preferences[egg].likes},at(p,24*H));
    assert.equal(p.food.level,2);
    for(let day=1;day<sequence.length;day++) {
      p=evolve(p,at(p,day*24*H));
      assert.equal(petSpriteStage(p),sequence[day]);
      assert.equal(p.forms.at(-1).visualForm,sequence[day]);
      assert.equal(petStageName(p),names[day]);
    }
    const child=transition(p,{type:'lineage',name:'New arrival',expectedBornAt:p.bornAt},at(p,8*24*H));
    assert.equal(child.egg,egg);
    assert.equal(petSpriteStage(child),1);
    assert.equal(child.forms[0].visualForm,1);
    assert.deepEqual(child.lineage.ancestors[0].pet.forms,p.forms);
  }
  for(const egg of [-1,8,99,0.5,NaN])assert.throws(()=>adopt(egg),/eight eggs/);
});

test('legacy renewal appearances stay fixed when Radiant and Ancient are discovered',()=>{
  let p=adopt();
  const oldStages=[0,5,12,20,26,50];
  p.forms=oldStages.map(stage=>({stage,trait:'heart',at:dateKey(at(p,stage*24*H),p.timezone)}));
  p.revealedStage=50;p.highestStage=50;
  const history=structuredClone(p.forms),oldVisuals=[1,2,3,2,3,2];
  const oldNames=['Hatchling','Growing','Flourishing','Renewal 1','Renewal 2','Renewal 3'];
  for(const [index,stage] of oldStages.entries()) {
    assert.equal(petSpriteStage(p,stage),oldVisuals[index]);
    assert.equal(petStageName(p,stage),oldNames[index]);
  }
  p=evolve(p,at(p,60*24*H));
  assert.equal(petSpriteStage(p),4);
  assert.equal(petStageName(p),'Radiant');
  p=evolve(p,at(p,61*24*H));
  assert.equal(petSpriteStage(p),5);
  assert.equal(petStageName(p),'Ancient');
  p=evolve(p,at(p,62*24*H));
  assert.equal(petSpriteStage(p),4);
  assert.equal(petStageName(p),'Renewal 4');
  assert.deepEqual(p.forms.slice(0,history.length),history,'old entries are never reinterpreted or rewritten');
  for(const [index,stage] of oldStages.entries()) {
    assert.equal(petSpriteStage(p,stage),oldVisuals[index]);
    assert.equal(petStageName(p,stage),oldNames[index]);
  }
});
