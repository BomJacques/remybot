export type Kind = 'body' | 'mind' | 'heart';
export type Commitment = {id:string; label:string; kind:Kind};
export type Checkin = {items:(Commitment & {done:boolean})[]; savedAt:string};
export type Game = 'stars' | 'moves';
export type CareActivity = 'brush' | 'wash' | 'pat';
export type CareState = {xp:number;completed:Partial<Record<CareActivity,string>>;lastCompletedAt:string};
export type AdventureState = {chapter:number;care:boolean;play:boolean;items:string[];equipped:string|null};
export type Form = {stage:number;trait:Kind;at:string;visualForm?:number};
export type CompanionSnapshot = {egg:number;name:string;bornDate:string;bornAt:string;hatchStorySeen?:boolean;timezone:string;commitments:Commitment[];checkins:Record<string,Checkin>;food:{level:number;decayAt:string};pettedDate:string|null;fedDates:string[];playCount?:number;lastPlayedAt?:string;gameWins?:Record<Game,number>;care?:CareState;adventure?:AdventureState;revealedStage:number;highestStage:number;cocoon?:{startedAt:string;endsAt:string;targetStage:number;trait:Kind}|null;restUntil?:string|null;restedAt?:string;restMode?:'nap'|'bedtime';lastBedtimeAt?:string;forms:Form[]};
export type Ancestor = {generation:number;variant:number;archivedAt:string;pet:CompanionSnapshot};
export type Pet = CompanionSnapshot & {lineage?:{generation:number;variant:number;ancestors:Ancestor[]}};
export type Food = 'meal'|'snack'|'treat';
export type Action = {type:'adopt';egg:number;name:string;timezone:string;commitments:Commitment[]}|{type:'feed';food:Food}|{type:'pet'}|{type:'care';activity:CareActivity}|{type:'play';game?:Game}|{type:'toyPlay'}|{type:'keepsake';id:string}|{type:'decorate';id:string|null}|{type:'checkin';done:string[]}|{type:'commitments';items:Commitment[]}|{type:'evolve'}|{type:'emerge'}|{type:'nap'}|{type:'bedtime'}|{type:'wake'}|{type:'readStory'}|{type:'lineage';name:string;expectedBornAt:string;egg?:number};
export const EVOLUTION_DAYS=1;
export const FAMILY_COUNT=8;
export const FORM_COUNT=5;
export const CARE_XP_PER_LEVEL=5;
export const LINEAGE_DAYS=7;
export const BEDTIME_HOURS=8;
export const KEEPSAKE_CHOICES=[['leaf','flower'],['moon','star'],['kite','flag'],['pond','shell'],['lamp','beacon']] as const;
export const defaults:Commitment[] = [{id:'shoes',label:'Put shoes away',kind:'heart'},{id:'teeth',label:'Brush teeth',kind:'body'},{id:'lunchbox',label:'Empty lunch box',kind:'mind'}];
export const foodNames:Record<Food,string>={meal:'Garden bowl',snack:'Crisp apple',treat:'Star biscuit'};
export const preferences:{likes:Food;dislikes:Food}[]=[{likes:'meal',dislikes:'treat'},{likes:'treat',dislikes:'meal'},{likes:'snack',dislikes:'meal'},{likes:'meal',dislikes:'snack'},{likes:'treat',dislikes:'snack'},{likes:'snack',dislikes:'treat'},{likes:'treat',dislikes:'meal'},{likes:'meal',dislikes:'treat'}];
export function foodValue(egg:number,food:Food){return preferences[egg].likes===food?2:preferences[egg].dislikes===food?1:food==='meal'?2:1;}
export function hatchSeconds(p:Pet,now:Date){return Math.max(0,Math.ceil((Date.parse(p.bornAt)-now.getTime())/1000));}
export function cocoonSeconds(p:Pet,now:Date){return p.cocoon?Math.max(0,Math.ceil((Date.parse(p.cocoon.endsAt)-now.getTime())/1000)):0;}
export function moodOf(p:Pet,now:Date){if(hatchSeconds(p,now)>0)return 'egg';if(p.cocoon)return 'cocoon';if(p.restUntil&&Date.parse(p.restUntil)>now.getTime())return 'sleeping';if(foodAt(p,now).level===0)return 'hungry';if(now.getTime()-Date.parse(p.restedAt??p.bornAt)>12*3600000)return 'tired';const check=p.checkins[dateKey(now,p.timezone)];if(!check||p.commitments.some(c=>!check.items.some(i=>i.id===c.id&&i.done)))return 'sad';return 'happy';}
export const traitNames:Record<Kind,string>={body:'Adventurous',mind:'Curious',heart:'Kind-hearted'};
export function dateKey(now:Date,timezone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');}
export function daysBetween(a:string,b:string){return Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
export function growth(p:Pet,now:Date){const elapsed=Math.max(0,daysBetween(p.bornDate,dateKey(now,p.timezone)));const stage=Math.max(p.highestStage,Math.floor(elapsed/EVOLUTION_DAYS));return {elapsed,stage,remaining:Math.max(0,(stage+1)*EVOLUTION_DAYS-elapsed),progress:Math.max(0,Math.min(100,(elapsed-stage*EVOLUTION_DAYS)/EVOLUTION_DAYS*100)),pending:stage>p.revealedStage};}
export function foodAt(p:Pet,now:Date){const elapsed=Math.max(0,now.getTime()-Date.parse(p.food.decayAt));const intervals=Math.floor(elapsed/(8*3600000));const level=Math.max(0,p.food.level-intervals);return {level,decayAt:level===0?now.toISOString():new Date(Date.parse(p.food.decayAt)+intervals*8*3600000).toISOString()};}
export function careTrait(p:Pet):Kind {const points={body:0,mind:0,heart:0};for(const check of Object.values(p.checkins)) for(const item of check.items)if(item.done)points[item.kind]++;return (Object.keys(points) as Kind[]).reduce((a,b)=>points[b]>points[a]?b:a,'heart');}
export function spriteStage(stage:number){return stage<FORM_COUNT?stage+1:4+((stage+1)%2);}
function legacySpriteStage(index:number){return index<3?index+1:2+((index+1)%2);}
function visualFormAt(forms:Form[],index:number){return forms[index].visualForm??legacySpriteStage(index);}
/** Unpinned legacy entries keep their original appearance, including archived ancestors. */
export function petSpriteStage(p:Pick<Pet,'revealedStage'|'forms'>,stage=p.revealedStage){const index=p.forms.findIndex(form=>form.stage===stage);return index<0?spriteStage(stage):visualFormAt(p.forms,index);}
export function stageName(stage:number){return ['Hatchling','Growing','Flourishing','Radiant','Ancient'][stage]??`Renewal ${stage-4}`;}
/** Names follow actual discoveries instead of the number of calendar days that elapsed. */
export function petStageName(p:Pick<Pet,'revealedStage'|'forms'>,stage=p.revealedStage){
 const index=p.forms.findIndex(form=>form.stage===stage);if(index<0)return stageName(stage);
 const seen=new Set<number>();let renewals=0;
 for(let i=0;i<=index;i++){const visual=visualFormAt(p.forms,i);const repeated=seen.has(visual);if(repeated)renewals++;if(i===index)return repeated?`Renewal ${renewals}`:stageName(visual-1);seen.add(visual);}
 return 'Hatchling';
}
function nextVisualForm(p:Pet){const highest=p.forms.reduce((max,_,index)=>Math.max(max,visualFormAt(p.forms,index)),1);return highest<FORM_COUNT?highest+1:petSpriteStage(p)===4?5:4;}
export function generationOf(p:Pet){return p.lineage?.generation??1;}
export function variantOf(p:Pet){return p.lineage?.variant??0;}
export function variantForGeneration(generation:number){return generation===1?0:1+((generation-2)%3);}
export function careProgress(p:Pet,now:Date){const xp=p.care?.xp??0;const today=dateKey(now,p.timezone);return {xp,level:1+Math.floor(xp/CARE_XP_PER_LEVEL),progress:(xp%CARE_XP_PER_LEVEL)/CARE_XP_PER_LEVEL*100,untilNext:CARE_XP_PER_LEVEL-xp%CARE_XP_PER_LEVEL,today:{brush:p.care?.completed.brush===today,wash:p.care?.completed.wash===today,pat:p.care?.completed.pat===today}};}
export function discoveredFormCount(p:Pick<Pet,'revealedStage'|'forms'>){return new Set(p.forms.filter(form=>form.stage<=p.revealedStage).map(form=>petSpriteStage(p,form.stage))).size;}
export function adventureProgress(p:Pet,now:Date){
 const chapter=p.adventure?.chapter??0,careDone=p.adventure?.care??false,playDone=p.adventure?.play??false;
 const finished=chapter>=KEEPSAKE_CHOICES.length;
 const unlocked=!finished&&hatchSeconds(p,now)===0&&chapter<Math.min(KEEPSAKE_CHOICES.length,discoveredFormCount(p));
 const awake=!p.cocoon&&!(p.restUntil&&Date.parse(p.restUntil)>now.getTime());
 return {chapter,unlocked,careDone,playDone,ready:unlocked&&awake&&(chapter===0?(careDone||playDone):(careDone&&playDone)),finished,equipped:p.adventure?.equipped??null,items:[...(p.adventure?.items??[])]};
}
function markAdventure(p:Pet,task:'care'|'play',now:Date){if(!adventureProgress(p,now).unlocked)return;p.adventure??={chapter:0,care:false,play:false,items:[],equipped:null};p.adventure[task]=true;}
export function lineageStatus(p:Pet,now:Date){const daysRemaining=Math.max(0,LINEAGE_DAYS-Math.max(0,daysBetween(p.bornDate,dateKey(now,p.timezone))));const evolutionsRemaining=Math.max(0,2-(p.forms.length-1));return {eligible:daysRemaining===0&&evolutionsRemaining===0&&hatchSeconds(p,now)===0&&!p.cocoon&&!(p.restUntil&&Date.parse(p.restUntil)>now.getTime()),daysRemaining,evolutionsRemaining,generation:generationOf(p)};}
function validItems(items:Commitment[]){if(!Array.isArray(items)||items.length<1||items.length>6)throw new Error('Choose between 1 and 6 daily commitments.');const ids=new Set<string>();return items.map(i=>{if(typeof i.id!=='string'||!i.id||i.id.length>64||ids.has(i.id)||typeof i.label!=='string'||!i.label.trim()||i.label.trim().length>90||!['body','mind','heart'].includes(i.kind))throw new Error('Each commitment needs a unique ID, a short name, and a care type.');ids.add(i.id);return {...i,label:i.label.trim()};});}
export function transition(current:Pet|null,action:Action,now=new Date()):Pet {
 if(action.type==='adopt'){if(current)throw new Error('You already have a companion.');if(!Number.isInteger(action.egg)||action.egg<0||action.egg>=FAMILY_COUNT)throw new Error('Pick one of the eight eggs.');if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>24)throw new Error('Use a name between 1 and 24 characters.');const bornAt=new Date(now.getTime()+60000);const bornDate=dateKey(bornAt,action.timezone);return {egg:action.egg,name:action.name.trim(),bornDate,bornAt:bornAt.toISOString(),hatchStorySeen:false,timezone:action.timezone,commitments:validItems(action.commitments),checkins:{},food:{level:3,decayAt:bornAt.toISOString()},pettedDate:null,fedDates:[],revealedStage:0,highestStage:0,forms:[{stage:0,trait:'heart',at:bornDate,visualForm:1}]};}
 if(!current)throw new Error('Choose a companion first.');
 const p=structuredClone(current);const today=dateKey(now,p.timezone);p.highestStage=growth(p,now).stage;
 if(hatchSeconds(p,now)>0 && action.type!=='commitments')throw new Error('Your egg is still getting ready to hatch.');
 if(p.cocoon&&['feed','pet','care','play','toyPlay','keepsake','nap','bedtime','wake','lineage'].includes(action.type))throw new Error('He is cosy in his cocoon. He will be back soon.');
 if(p.restUntil&&Date.parse(p.restUntil)>now.getTime()&&['feed','pet','care','play','toyPlay','keepsake','nap','bedtime','evolve','lineage'].includes(action.type))throw new Error('He is napping. Let him wake up before playing or caring for him.');
 switch(action.type){
  case 'feed':{const food=foodAt(p,now);if(food.level===3)throw new Error(`${p.name} is full. Come back when his tummy has room.`);if(!['meal','snack','treat'].includes(action.food))throw new Error('Choose a meal or a snack.');p.food={level:Math.min(3,food.level+foodValue(p.egg,action.food)),decayAt:food.decayAt};if(!p.fedDates.includes(today))p.fedDates.push(today);markAdventure(p,'care',now);break;}
  case 'readStory':p.hatchStorySeen=true;break;
  case 'pet':p.pettedDate=today;break;
  case 'care':{if(!['brush','wash','pat'].includes(action.activity))throw new Error('Choose brushing, washing, or patting.');if(p.care&&now.getTime()<Date.parse(p.care.lastCompletedAt))throw new Error('The clock is earlier than your last care session. Try again when it catches up.');const care=p.care??{xp:0,completed:{},lastCompletedAt:now.toISOString()};if(care.completed[action.activity]!==today){if(care.xp>=Number.MAX_SAFE_INTEGER)throw new Error('Your care counter is full.');care.xp++;care.completed[action.activity]=today;}care.lastCompletedAt=now.toISOString();p.care=care;if(action.activity==='pat')p.pettedDate=today;markAdventure(p,'care',now);break;}
  case 'play':{if(p.restUntil&&Date.parse(p.restUntil)>now.getTime())throw new Error('He is napping. Let him wake up before playing.');if(action.game!==undefined&&!['stars','moves'].includes(action.game))throw new Error('Choose one of your companion’s games.');if((p.playCount??0)>=Number.MAX_SAFE_INTEGER)throw new Error('Your play counter is full.');if(action.game){const wins={stars:0,moves:0,...p.gameWins};if(wins[action.game]>=Number.MAX_SAFE_INTEGER)throw new Error('Your play counter is full.');wins[action.game]++;p.gameWins=wins;}p.playCount=(p.playCount??0)+1;p.lastPlayedAt=now.toISOString();if(action.game)markAdventure(p,'play',now);break;}
  case 'toyPlay':{if((p.playCount??0)>=Number.MAX_SAFE_INTEGER)throw new Error('Your play counter is full.');p.playCount=(p.playCount??0)+1;p.lastPlayedAt=now.toISOString();markAdventure(p,'play',now);break;}
  case 'keepsake':{const progress=adventureProgress(p,now);if(!progress.ready)throw new Error(progress.finished?'Your keepsake collection is complete.':!progress.unlocked?'Discover the next creature form to open this adventure.':progress.chapter===0?'Finish a care activity or play together for this adventure first.':'Finish the care and play steps for this adventure first.');if(!(KEEPSAKE_CHOICES[progress.chapter] as readonly string[]).includes(action.id))throw new Error('Choose one of this chapter’s two keepsakes.');p.adventure={chapter:progress.chapter+1,care:false,play:false,items:[...progress.items,action.id],equipped:action.id};break;}
  case 'decorate':{if(action.id!==null&&!p.adventure?.items.includes(action.id))throw new Error('Choose a keepsake you have collected.');if(p.adventure)p.adventure.equipped=action.id;break;}
  case 'checkin':{if(!Array.isArray(action.done)||action.done.some(id=>!p.commitments.some(c=>c.id===id)))throw new Error('Choose from your current commitments.');p.checkins[today]={items:p.commitments.map(i=>({...i,done:action.done.includes(i.id)})),savedAt:now.toISOString()};break;}
  case 'commitments':p.commitments=validItems(action.items);break;
  case 'nap':p.restUntil=new Date(now.getTime()+20*60000).toISOString();p.restedAt=p.restUntil;p.restMode='nap';break;
  case 'bedtime':if(p.lastBedtimeAt&&now.getTime()<Date.parse(p.lastBedtimeAt))throw new Error('The clock is earlier than your last bedtime. Try again when it catches up.');p.restUntil=new Date(now.getTime()+BEDTIME_HOURS*3600000).toISOString();p.restedAt=p.restUntil;p.restMode='bedtime';p.lastBedtimeAt=now.toISOString();break;
  case 'wake':p.restUntil=null;p.restedAt=now.toISOString();delete p.restMode;break;
  case 'evolve':{if(p.cocoon)throw new Error('Your companion is already in a cocoon.');if(p.highestStage<=p.revealedStage)throw new Error('The next metamorphosis is still growing.');p.cocoon={startedAt:now.toISOString(),endsAt:new Date(now.getTime()+60000).toISOString(),targetStage:p.highestStage,trait:careTrait(p)};break;}
  case 'emerge':{if(!p.cocoon)throw new Error('There is no cocoon ready.');if(cocoonSeconds(p,now)>0)throw new Error('The cocoon needs a little more time.');const visualForm=nextVisualForm(p);p.revealedStage=Math.max(p.cocoon.targetStage,p.highestStage);p.forms.push({stage:p.revealedStage,trait:p.cocoon.trait,at:today,visualForm});p.cocoon=null;p.restedAt=now.toISOString();p.restUntil=null;delete p.restMode;break;}
  case 'lineage':{if(action.expectedBornAt!==p.bornAt)throw new Error('Your companion changed. Close the family album and open it again.');if(!lineageStatus(p,now).eligible)throw new Error('A new generation needs 7 days together and 2 completed metamorphoses.');if([p.care?.lastCompletedAt,p.lastBedtimeAt,p.lastPlayedAt].some(time=>time&&Date.parse(time)>now.getTime()))throw new Error('The clock is earlier than your last activity. Try again when it catches up.');if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>24)throw new Error('Use a name between 1 and 24 characters.');const egg=action.egg===undefined?p.egg:action.egg;if(!Number.isInteger(egg)||egg<0||egg>=FAMILY_COUNT)throw new Error('Pick one of the eight eggs.');const generation=generationOf(p)+1;if(!Number.isSafeInteger(generation))throw new Error('Your family album is full.');const {lineage,...snapshot}=p;const child=transition(null,{type:'adopt',egg,name:action.name,timezone:p.timezone,commitments:p.commitments},now);child.lineage={generation,variant:variantForGeneration(generation),ancestors:[...(lineage?.ancestors??[]),{generation:generation-1,variant:variantOf(p),archivedAt:now.toISOString(),pet:snapshot}]};if(p.playCount!==undefined)child.playCount=p.playCount;if(p.gameWins)child.gameWins={...p.gameWins};if(p.lastPlayedAt)child.lastPlayedAt=p.lastPlayedAt;if(p.care)child.care={xp:p.care.xp,completed:{},lastCompletedAt:now.toISOString()};return child;}
  default:throw new Error('That action is not supported.');
 }
 return p;
}
