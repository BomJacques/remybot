export type Kind = 'body' | 'mind' | 'heart';
export type Commitment = {id:string; label:string; kind:Kind};
export type Checkin = {items:(Commitment & {done:boolean})[]; savedAt:string};
export type Game = 'stars' | 'moves';
export type Pet = {egg:number;name:string;bornDate:string;bornAt:string;hatchStorySeen?:boolean;timezone:string;commitments:Commitment[];checkins:Record<string,Checkin>;food:{level:number;decayAt:string};pettedDate:string|null;fedDates:string[];playCount?:number;lastPlayedAt?:string;gameWins?:Record<Game,number>;revealedStage:number;highestStage:number;cocoon?:{startedAt:string;endsAt:string;targetStage:number;trait:Kind}|null;restUntil?:string|null;restedAt?:string;forms:{stage:number;trait:Kind;at:string}[]};
export type Food = 'meal'|'snack'|'treat';
export type Action = {type:'adopt';egg:number;name:string;timezone:string;commitments:Commitment[]}|{type:'feed';food:Food}|{type:'pet'}|{type:'play';game?:Game}|{type:'checkin';done:string[]}|{type:'commitments';items:Commitment[]}|{type:'evolve'}|{type:'emerge'}|{type:'nap'}|{type:'wake'}|{type:'readStory'};
export const EVOLUTION_DAYS=1;
export const defaults:Commitment[] = [{id:'shoes',label:'Put shoes away',kind:'heart'},{id:'teeth',label:'Brush teeth',kind:'body'},{id:'lunchbox',label:'Empty lunch box',kind:'mind'}];
export const foodNames:Record<Food,string>={meal:'Garden bowl',snack:'Crisp apple',treat:'Star biscuit'};
export const preferences:{likes:Food;dislikes:Food}[]=[{likes:'meal',dislikes:'treat'},{likes:'treat',dislikes:'meal'},{likes:'snack',dislikes:'meal'},{likes:'meal',dislikes:'snack'},{likes:'treat',dislikes:'snack'},{likes:'snack',dislikes:'treat'}];
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
export function spriteStage(stage:number){return stage<3?stage+1:2+((stage+1)%2);}
/** Visual growth follows completed cocoons, so catching up days never skips into the same sprite. */
export function petSpriteStage(p:Pick<Pet,'revealedStage'|'forms'>,stage=p.revealedStage){const formIndex=p.forms.findIndex(form=>form.stage===stage);return spriteStage(formIndex<0?stage:formIndex);}
export function stageName(stage:number){return ['Hatchling','Growing','Flourishing'][stage]??`Renewal ${stage-2}`;}
function validItems(items:Commitment[]){if(!Array.isArray(items)||items.length<1||items.length>6)throw new Error('Choose between 1 and 6 daily commitments.');const ids=new Set<string>();return items.map(i=>{if(typeof i.id!=='string'||!i.id||i.id.length>64||ids.has(i.id)||typeof i.label!=='string'||!i.label.trim()||i.label.trim().length>90||!['body','mind','heart'].includes(i.kind))throw new Error('Each commitment needs a unique ID, a short name, and a care type.');ids.add(i.id);return {...i,label:i.label.trim()};});}
export function transition(current:Pet|null,action:Action,now=new Date()):Pet {
 if(action.type==='adopt'){if(current)throw new Error('You already have a companion.');if(!Number.isInteger(action.egg)||action.egg<0||action.egg>5)throw new Error('Pick one of the six eggs.');if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>24)throw new Error('Use a name between 1 and 24 characters.');const bornAt=new Date(now.getTime()+60000);const bornDate=dateKey(bornAt,action.timezone);return {egg:action.egg,name:action.name.trim(),bornDate,bornAt:bornAt.toISOString(),hatchStorySeen:false,timezone:action.timezone,commitments:validItems(action.commitments),checkins:{},food:{level:3,decayAt:bornAt.toISOString()},pettedDate:null,fedDates:[],revealedStage:0,highestStage:0,forms:[{stage:0,trait:'heart',at:bornDate}]};}
 if(!current)throw new Error('Choose a companion first.');
 const p=structuredClone(current);const today=dateKey(now,p.timezone);p.highestStage=growth(p,now).stage;
 if(hatchSeconds(p,now)>0 && action.type!=='commitments')throw new Error('Your egg is still getting ready to hatch.');
 if(p.cocoon&&['feed','pet','play','nap','wake'].includes(action.type))throw new Error('He is cosy in his cocoon. He will be back soon.');
 switch(action.type){
  case 'feed':{const food=foodAt(p,now);if(food.level===3)throw new Error(`${p.name} is full. Come back when his tummy has room.`);if(!['meal','snack','treat'].includes(action.food))throw new Error('Choose a meal or a snack.');p.food={level:Math.min(3,food.level+foodValue(p.egg,action.food)),decayAt:food.decayAt};if(!p.fedDates.includes(today))p.fedDates.push(today);break;}
  case 'readStory':p.hatchStorySeen=true;break;
  case 'pet':p.pettedDate=today;break;
  case 'play':{if(p.restUntil&&Date.parse(p.restUntil)>now.getTime())throw new Error('He is napping. Let him wake up before playing.');if(action.game!==undefined&&!['stars','moves'].includes(action.game))throw new Error('Choose one of your companion’s games.');if((p.playCount??0)>=Number.MAX_SAFE_INTEGER)throw new Error('Your play counter is full.');if(action.game){const wins={stars:0,moves:0,...p.gameWins};if(wins[action.game]>=Number.MAX_SAFE_INTEGER)throw new Error('Your play counter is full.');wins[action.game]++;p.gameWins=wins;}p.playCount=(p.playCount??0)+1;p.lastPlayedAt=now.toISOString();break;}
  case 'checkin':{if(!Array.isArray(action.done)||action.done.some(id=>!p.commitments.some(c=>c.id===id)))throw new Error('Choose from your current commitments.');p.checkins[today]={items:p.commitments.map(i=>({...i,done:action.done.includes(i.id)})),savedAt:now.toISOString()};break;}
  case 'commitments':p.commitments=validItems(action.items);break;
  case 'nap':p.restUntil=new Date(now.getTime()+20*60000).toISOString();p.restedAt=p.restUntil;break;
  case 'wake':p.restUntil=null;p.restedAt=now.toISOString();break;
  case 'evolve':{if(p.cocoon)throw new Error('Your companion is already in a cocoon.');if(p.highestStage<=p.revealedStage)throw new Error('The next metamorphosis is still growing.');p.cocoon={startedAt:now.toISOString(),endsAt:new Date(now.getTime()+60000).toISOString(),targetStage:p.highestStage,trait:careTrait(p)};break;}
  case 'emerge':{if(!p.cocoon)throw new Error('There is no cocoon ready.');if(cocoonSeconds(p,now)>0)throw new Error('The cocoon needs a little more time.');p.revealedStage=Math.max(p.cocoon.targetStage,p.highestStage);p.forms.push({stage:p.revealedStage,trait:p.cocoon.trait,at:today});p.cocoon=null;p.restedAt=now.toISOString();p.restUntil=null;break;}
  default:throw new Error('That action is not supported.');
 }
 return p;
}
