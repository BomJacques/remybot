import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Check,ChevronDown,Music2,Users} from 'lucide-react';
import {hatchSeconds,petSpriteStage,variantOf,type Pet} from './engine';
import {CreatureAppearance} from './creature-appearance';
import {availablePlaymates,selectedPlaymates,type Playmate} from './playmates';
import './playdate.css';

function Portrait({companion,className=''}:{companion:Playmate;className?:string}){
 return <CreatureAppearance {...companion.appearance} className={className}><img src={companion.spriteSrc} alt="" draggable={false}/></CreatureAppearance>;
}
function PixelBall(){return <svg viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges"><path d="M6 0h12v3h3v3h3v12h-3v3h-3v3H6v-3H3v-3H0V6h3V3h3z" fill="currentColor"/><path d="M6 3h6v6H6zm6 6h9v6h-9zm-9 6h9v6H6v-3H3z" fill="#d4e0aa"/></svg>;}

export function PlaymatesOnScreen({companions,onPlay}:{companions:Playmate[];onPlay:()=>void}){
 return companions.length?<div className="lcd-playmates" aria-label="Visiting friends">{companions.slice(0,2).map((companion,index)=><button type="button" key={companion.id} className={`lcd-playmate lcd-playmate-${index}`} onClick={event=>{event.stopPropagation();onPlay();}} aria-label={`Play with ${companion.name}, visiting friend`}><Portrait companion={companion} className="lcd-playmate-portrait"/><span>{companion.name}</span></button>)}</div>:null;
}

export function Playdate({pet,now,busy,onInvite,onComplete,onReact}:{
 pet:Pet;now:Date;busy:boolean;onInvite:(ids:string[])=>Promise<boolean>;onComplete:()=>Promise<boolean>;onReact:()=>void;
}){
 const available=availablePlaymates(pet),invited=selectedPlaymates(pet),selected=invited.map(companion=>companion.id);
 const signature=selected.join('|');
 const stage=petSpriteStage(pet);
 const active:Playmate={id:'active',name:pet.name,spriteSrc:`${import.meta.env.BASE_URL}moods/happy/${pet.egg}-${stage}.png`,appearance:{egg:pet.egg,stage,variant:variantOf(pet)}};
 const party=[active,...invited];
 const [draft,setDraft]=useState(selected),[pickerOpen,setPickerOpen]=useState(invited.length===0);
 const [inviting,setInviting]=useState(false),[inviteError,setInviteError]=useState('');
 const [holder,setHolder]=useState(0),[passes,setPasses]=useState(0),[flight,setFlight]=useState<{from:number;to:number;serial:number}|null>(null);
 const [catcher,setCatcher]=useState<number|null>(null),[dancing,setDancing]=useState(false);
 const [message,setMessage]=useState('Pass the ball three times. Everyone gets a turn.');
 const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[saveError,setSaveError]=useState(false);
 const mounted=useRef(true),inviteLock=useRef(false),completionLock=useRef(false),completed=useRef(false),inFlight=useRef(false);
 const totalPasses=useRef(0),flightSerial=useRef(0);
 const flightTimer=useRef<ReturnType<typeof setTimeout>|null>(null),reactionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const completeRef=useRef(onComplete);completeRef.current=onComplete;
 const resting=hatchSeconds(pet,now)>0||!!pet.cocoon||!!pet.restUntil&&Date.parse(pet.restUntil)>+now;
 const canPlay=!busy&&!inviting&&!resting&&invited.length>0;
 const draftChanged=draft.join('|')!==signature;
 const positions=party.length===3?[50,18,82]:party.length===2?[30,70]:[50];
 const next=(holder+1)%party.length;

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(flightTimer.current)clearTimeout(flightTimer.current);if(reactionTimer.current)clearTimeout(reactionTimer.current);};},[]);
 useEffect(()=>{
  setDraft(selected);setHolder(0);setPasses(0);totalPasses.current=0;inFlight.current=false;
  setFlight(null);setCatcher(null);setDancing(false);setInviteError('');
  if(flightTimer.current)clearTimeout(flightTimer.current);if(reactionTimer.current)clearTimeout(reactionTimer.current);
  setMessage(invited.length?'Pass the ball three times. Everyone gets a turn.':'Choose one or two visitors to start playing.');
 },[signature,pet.bornAt]);
 useEffect(()=>{if(resting){if(flightTimer.current)clearTimeout(flightTimer.current);inFlight.current=false;setFlight(null);setDancing(false);setCatcher(null);}},[resting]);

 async function savePlay(){
  if(completed.current||completionLock.current||!mounted.current)return;
  completionLock.current=true;setSaving(true);setSaveError(false);
  try{const result=await completeRef.current();if(result)completed.current=true;if(mounted.current){setSaved(result);setSaveError(!result);}}
  catch{if(mounted.current)setSaveError(true);}finally{completionLock.current=false;if(mounted.current)setSaving(false);}
 }
 async function invite(){
  if(inviteLock.current||busy||inFlight.current||dancing)return;
  inviteLock.current=true;setInviting(true);setInviteError('');
  try{const result=await onInvite(draft);if(mounted.current){if(result){setPickerOpen(false);setMessage(draft.length?'The visitors are here. Pass the ball!':'Visitors waved goodbye. Invite them again any time.');}else setInviteError('The invitation was not saved. Try again.');}}
  catch{if(mounted.current)setInviteError('The invitation was not saved. Try again.');}finally{inviteLock.current=false;if(mounted.current)setInviting(false);}
 }
 function toggle(id:string){
  if(busy||inviting||inFlight.current||dancing)return;
  setDraft(previous=>previous.includes(id)?previous.filter(item=>item!==id):previous.length<2?[...previous,id]:previous);
 }
 function pass(to=next){
  if(!canPlay||inFlight.current||dancing||to===holder)return;
  inFlight.current=true;setCatcher(null);setFlight({from:holder,to,serial:++flightSerial.current});
  setMessage(`${party[holder].name} passes to ${party[to].name}.`);onReact();
  flightTimer.current=setTimeout(()=>{
   if(!mounted.current)return;
   inFlight.current=false;setFlight(null);setHolder(to);setCatcher(to);
   totalPasses.current++;setPasses(totalPasses.current);setMessage(`${party[to].name} caught it!${totalPasses.current===3?' Three passes complete.':' Who is next?'}`);
   if(reactionTimer.current)clearTimeout(reactionTimer.current);
   reactionTimer.current=setTimeout(()=>{if(mounted.current)setCatcher(null);},650);
   if(totalPasses.current===3)void savePlay();
  },850);
 }
 function dance(){
  if(!canPlay||inFlight.current||dancing)return;
  if(reactionTimer.current)clearTimeout(reactionTimer.current);
  setCatcher(null);setDancing(true);setMessage('Hop, sway, spin! Everyone joins in.');onReact();
  reactionTimer.current=setTimeout(()=>{if(mounted.current){setDancing(false);setMessage('One more dance, or pass the ball?');}},1700);
 }
 const ballStyle={'--pass-from':`${positions[flight?.from??holder]}%`,'--pass-to':`${positions[flight?.to??holder]}%`} as CSSProperties;
 return <section className="playdate" aria-label="Play with visiting friends">
  <div className="playdate-invitation"><button className="playdate-picker-toggle" type="button" aria-expanded={pickerOpen} onClick={()=>setPickerOpen(value=>!value)}><Users size={19}/><span>{invited.length?`${invited.length} visiting ${invited.length===1?'friend':'friends'}`:'Invite some visitors'}<small>{invited.length?invited.map(companion=>companion.name).join(' + '):'Choose up to two. Your creature stays with you.'}</small></span><ChevronDown size={18}/></button>
   {pickerOpen&&<div className="playdate-picker"><p>Visitors come to play. They do not need feeding or chores.</p><div className="playdate-guest-grid" role="group" aria-label="Choose up to two visiting friends">{available.map(companion=>{const checked=draft.includes(companion.id);return <button key={companion.id} type="button" aria-pressed={checked} disabled={busy||inviting||!!flight||dancing||!checked&&draft.length===2} onClick={()=>toggle(companion.id)}><Portrait companion={companion} className="playdate-choice-portrait"/><strong>{companion.name}</strong><small>{companion.id.startsWith('ancestor-')?'From your family':'Visitor'}</small>{checked&&<Check className="playdate-chosen" size={16}/>}</button>;})}</div><div className="playdate-invite-footer"><span>{draft.length} / 2 chosen</span><button className="secondary-button" type="button" disabled={busy||inviting||!!flight||dancing||!draft.length} onClick={()=>setDraft([])}>Clear choices</button></div><button className="primary-button" type="button" disabled={busy||inviting||!!flight||dancing||!draftChanged} onClick={()=>void invite()}>{inviting?'Saving…':draft.length?`Invite ${draft.length===1?'this friend':'these friends'}`:'Wave goodbye'}</button>{inviteError&&<p className="playdate-error" role="alert">{inviteError}</p>}</div>}
  </div>
  <div className="playdate-score"><span>{saved?'PLAY STEP COMPLETE':'PASS THE BALL'}</span><strong>{saved?3:Math.min(3,passes)} / 3</strong></div>
  <div className={`playdate-scene ${dancing?'is-dancing':''}`} aria-label={`${party.map(companion=>companion.name).join(', ')} playing together`}>
   <span className="playdate-scene-title" aria-hidden="true">{dancing?'DANCE PARTY':invited.length?'PLAYTIME TOGETHER':'WAITING FOR VISITORS'}</span>
   <div className="playdate-floor" aria-hidden="true"/>
   {party.map((companion,index)=><div key={companion.id} className={`playdate-member ${catcher===index?'is-catching':''}`} style={{left:`${positions[index]}%`,'--dance-delay':`${index*90}ms`} as CSSProperties}><button type="button" disabled={!canPlay||!!flight||dancing} onClick={()=>pass(index===holder?next:index)} aria-label={index===holder?`Pass the ball from ${companion.name}`:`Pass the ball to ${companion.name}`}><Portrait companion={companion} className="playdate-member-portrait"/></button><span>{companion.name}</span><small>{index===0?'YOUR COMPANION':companion.id.startsWith('ancestor-')?'FAMILY VISITOR':'VISITOR'}</small></div>)}
   {invited.length>0&&<button type="button" key={`ball-${flight?.serial??'held'}`} className={`playdate-ball ${flight?'is-flying':''}`} style={ballStyle} disabled={!canPlay||!!flight||dancing} onClick={()=>pass()} aria-label={`Pass the ball to ${party[next].name}`}><PixelBall/></button>}
   {dancing&&<span className="playdate-notes" aria-hidden="true">♪ &nbsp; ♫ &nbsp; ♪</span>}
  </div>
  <p className="playdate-message" role="status" aria-live="polite" aria-atomic="true">{resting?`${pet.name} is resting. Play together after he wakes or hatches.`:message}</p>
  <div className="playdate-actions"><button type="button" className="primary-button" disabled={!canPlay||!!flight||dancing} onClick={()=>pass()}><span className="playdate-button-ball"><PixelBall/></span>{flight?'Ball in the air…':'Pass the ball'}</button><button type="button" className="secondary-button" disabled={!canPlay||!!flight||dancing} onClick={dance}><Music2 size={18}/>{dancing?'Dancing…':'Dance together'}</button></div>
  <p className="playdate-hint" role="status">{saving?'Saving playtime…':saveError?'Three passes complete. Playtime could not be saved.':saved?'Playtime saved. You can keep playing together.':'Three passes finish one adventure play step. Tap a friend to choose who catches.'}</p>
  {saveError&&<button type="button" className="secondary-button" disabled={saving||busy||resting} onClick={()=>void savePlay()}>Try saving playtime again</button>}
 </section>;
}
