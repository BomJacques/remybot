import test from 'node:test';
import assert from 'node:assert/strict';
import {eggs} from '../app/eggs.ts';
import {defaults,FAMILY_COUNT,preferences,hatchSeconds,cocoonSeconds,petSpriteStage,petStageName,availablePlaymateIds,adventureProgress} from '../app/engine.ts';
import {SAVE_KEY,applySavedAction,readSavedPet} from '../app/storage.ts';

const start=new Date('2026-10-10T00:00:00Z');
const day=86400000;
const when=days=>new Date(+start+60000+days*day);
function memory(initial=null){let raw=initial;return {getItem:()=>raw,setItem:(_,value)=>{raw=value;}};}
function adopt(store,egg){return applySavedAction(store,{type:'adopt',egg,name:eggs[egg].name,timezone:'Australia/Brisbane',commitments:defaults},start).pet;}

test('the original family IDs keep their saved positions and four new families are appended',()=>{
  assert.deepEqual(eggs.map(egg=>egg.id),['moss','luna','ember','tide','static','relic','nimbus','pebble','dusk','coral','glint','tinker']);
  assert.equal(FAMILY_COUNT,12);
});

test('each new family hatches, completes five adventure chapters and preserves all discovered forms',()=>{
  for(const egg of [8,9,10,11]){
    const store=memory();let pet=adopt(store,egg);
    assert.equal(hatchSeconds(pet,start),60);
    assert.equal(petSpriteStage(pet),1);
    assert.throws(()=>applySavedAction(store,{type:'play',game:'snake'},start),/hatch/);
    for(let chapter=0;chapter<5;chapter++){
      let now=when(chapter);
      if(chapter){
        pet=applySavedAction(store,{type:'evolve'},now).pet;
        assert.equal(cocoonSeconds(pet,now),60);
        assert.equal(petSpriteStage(pet),chapter,'the old form remains until emergence');
        assert.throws(()=>applySavedAction(store,{type:'emerge'},new Date(+now+59000)),/cocoon/);
        now=new Date(+now+60000);
        pet=applySavedAction(store,{type:'emerge'},now).pet;
      }
      assert.equal(petSpriteStage(pet),chapter+1);
      assert.equal(petStageName(pet),['Hatchling','Growing','Flourishing','Radiant','Ancient'][chapter]);
      if(chapter){pet=applySavedAction(store,{type:'feed',food:preferences[egg].likes},now).pet;assert.equal(pet.food.level,2);}
      else pet=applySavedAction(store,{type:'care',activity:'brush'},now).pet;
      pet=applySavedAction(store,{type:'play',game:'snake'},now).pet;
      assert.equal(adventureProgress(pet,now).ready,true);
      const id=['leaf','moon','kite','pond','lamp'][chapter];
      pet=applySavedAction(store,{type:'keepsake',id},now).pet;
      pet=applySavedAction(store,{type:'decorate',id},now).pet;
      assert.deepEqual(readSavedPet(store).pet,pet);
    }
    assert.equal(adventureProgress(pet,when(5)).finished,true);
    const parent=pet;
    pet=applySavedAction(store,{type:'lineage',egg:0,name:'Moss junior',expectedBornAt:pet.bornAt},when(7)).pet;
    assert.deepEqual(pet.lineage.ancestors[0].pet.forms,parent.forms);
    assert.deepEqual(pet.lineage.ancestors[0].pet.adventure,parent.adventure);
    assert.equal(pet.gameWins.snake,5);
    assert.equal(pet.egg,0);assert.equal(hatchSeconds(pet,when(7)),60);
    pet=applySavedAction(store,{type:'invite',ids:['ancestor-1',`guest-${egg}`]},when(8)).pet;
    assert.deepEqual(readSavedPet(store).pet.playmates,pet.playmates);
  }
});

test('two-digit guest IDs persist for both active and archived companions without rewriting old saves',()=>{
  const store=memory();let pet=adopt(store,0);
  const original=store.getItem(SAVE_KEY);
  assert.equal(readSavedPet(store).pet.playmates,undefined);
  assert.equal(store.getItem(SAVE_KEY),original);
  for(const guest of ['guest-8','guest-9','guest-10','guest-11'])assert.ok(availablePlaymateIds(pet).includes(guest));
  pet=applySavedAction(store,{type:'invite',ids:['guest-10','guest-11']},when(0)).pet;
  assert.deepEqual(readSavedPet(store).pet.playmates,['guest-10','guest-11']);
  for(const d of [1,2]){
    applySavedAction(store,{type:'evolve'},when(d));
    pet=applySavedAction(store,{type:'emerge'},new Date(+when(d)+60000)).pet;
  }
  pet=applySavedAction(store,{type:'lineage',egg:11,name:'Tinker junior',expectedBornAt:pet.bornAt},when(7)).pet;
  assert.deepEqual(readSavedPet(store).pet.lineage.ancestors[0].pet.playmates,['guest-10','guest-11']);
  assert.ok(!availablePlaymateIds(pet).includes('guest-11'));
});

test('guest IDs outside the expanded catalogue or with noncanonical numbers cannot corrupt archives',()=>{
  const store=memory();adopt(store,0);
  for(const id of ['guest-12','guest-999','guest-010','guest-1e1','guest-10.0','guest--1','guest-9007199254740993']){
    const data=JSON.parse(store.getItem(SAVE_KEY));data.pet.playmates=[id];
    const raw=JSON.stringify(data),broken=memory(raw);
    assert.throws(()=>readSavedPet(broken),error=>error.code==='invalid');
    assert.equal(broken.getItem(SAVE_KEY),raw);
  }
});
