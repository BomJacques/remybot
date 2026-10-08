import {petSpriteStage,type Pet} from './engine';
import {eggs} from './eggs';

export type Playmate={
 id:string;
 name:string;
 spriteSrc:string;
 appearance:{egg:number;stage:number;variant:number};
};

/** Visitors show only hatchling art; saved relatives keep their actual discovered form. */
export function availablePlaymates(pet:Pet):Playmate[]{
 const guests:Playmate[]=eggs.flatMap((family,egg)=>egg===pet.egg?[]:[{
  id:`guest-${egg}`,name:family.name,spriteSrc:`${import.meta.env.BASE_URL}moods/happy/${egg}-1.png`,
  appearance:{egg,stage:1,variant:0},
 }]);
 const ancestors:Playmate[]=(pet.lineage?.ancestors??[]).map(ancestor=>{
  const stage=petSpriteStage(ancestor.pet);
  return {id:`ancestor-${ancestor.generation}`,name:ancestor.pet.name,
   spriteSrc:`${import.meta.env.BASE_URL}moods/happy/${ancestor.pet.egg}-${stage}.png`,
   appearance:{egg:ancestor.pet.egg,stage,variant:ancestor.variant}};
 });
 const found=new Set<string>();
 return [...ancestors.reverse(),...guests].filter(companion=>{if(found.has(companion.id))return false;found.add(companion.id);return true;});
}

export function selectedPlaymates(pet:Pet&{playmates?:string[]}):Playmate[]{
 const available=new Map(availablePlaymates(pet).map(companion=>[companion.id,companion]));
 return [...new Set(pet.playmates??[])].flatMap(id=>{const companion=available.get(id);return companion?[companion]:[];}).slice(0,2);
}
