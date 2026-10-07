import {useRef,useState} from 'react';
import {ArrowRight,Check,Gamepad2,Heart,Moon,Sparkles} from 'lucide-react';
import {adventureProgress,cocoonSeconds,discoveredFormCount,growth,hatchSeconds,type Pet} from './engine';
import {adventures,keepsakes} from './adventure-content';
import {eggs} from './eggs';
import './adventure.css';

/** Small, single-colour LCD objects; never a second screen or another creature. */
function KeepsakeIcon({id}:{id:string}){
 const paths:Record<string,string>={
  leaf:'M15 3h9v9h-3v6h-6v3h-3v6H9v-9H6v-6h3V6h6z M12 12v9h3v-6h3v-3z',
  flower:'M12 3h6v6h6v6h-6v6h-3v6h-3v-6H6v-6H3V9h9z M12 9v6h6V9z M18 21h9v3h-6v3h-6v-3h3z',
  moon:'M12 3h9v3h-9v6H9v6h6v3h9v-3h3v6h-6v3H9v-3H6v-3H3V9h3V6h6z M24 6h3v3h-3z',
  star:'M12 3h6v6h3v3h9v6h-6v3h3v6h-6v-3h-9v3H6v-6h3v-3H3v-6h9z',
  kite:'M15 0h3v3h3v3h3v3h3v3h-3v3h-3v3h-3v3h-3v3h3v3h-3v3h-3v-6h3v-3h-3v-3H9v-3H6v-3H3V9h3V6h3V3h6z M12 6v9h3V6z',
  flag:'M6 3h3v3h18v9H9v12h6v3H0v-3h6z M15 9v3h6V9z',
  pond:'M9 9h15v3h6v3h3v6h-3v3h-6v3H9v-3H3v-3H0v-6h3v-3h6z M9 15v3h6v-3z M18 21v3h6v-3z',
  shell:'M12 3h9v3h6v6h3v12H3V12h3V6h6z M9 12v9h3v-9z M15 9v12h3V9z M21 12v9h3v-9z M6 27h21v3H6z',
  lamp:'M9 3h15v3h3v3h3v6H3V9h3V6h3z M15 18h3v9h6v3H9v-3h6z',
  beacon:'M12 3h9v3h3v15h-3v6h6v3H6v-3h6v-6H9V6h3z M12 9v6h9V9z M0 9h6v3H0z M27 9h6v3h-6z M3 0h3v3H3z M27 0h3v3h-3z',
 };
 return <svg className="keepsake-icon" viewBox="0 0 33 33" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" fillRule="evenodd" d={paths[id]??paths.star}/></svg>;
}

export function HabitatDecoration({item}:{item:string|null}){
 if(!item||!keepsakes.some(keepsake=>keepsake.id===item))return null;
 return <span className={`habitat-decoration habitat-${item}`} aria-hidden="true"><KeepsakeIcon id={item}/></span>;
}

type Shared={pet:Pet;now:Date;busy:boolean;onCare:()=>void;onPlay:()=>void};
export function AdventureCard({pet,now,busy,onCare,onPlay,onOpen,onEvolve,onWake}:Shared&{onOpen:()=>void;onEvolve:()=>void;onWake:()=>void}){
 const progress=adventureProgress(pet,now),story=adventures[pet.egg],chapter=story.chapters[Math.min(progress.chapter,4)];
 const sleeping=!!pet.restUntil&&Date.parse(pet.restUntil)>+now;
 const pending=growth(pet,now).pending;
 if(hatchSeconds(pet,now)>0)return null;
 let title=chapter.title,detail=progress.chapter===0?'Try care or a game to find your first keepsake.':'One care activity + one game. Then choose a keepsake.',label='Care together',action=onCare;
 if(progress.careDone){label='Play together';action=onPlay;}
 if(progress.ready){title='A keepsake is waiting';detail='Pick something for your creature’s home.';label='Choose your find';action=onOpen;}
 if(!progress.unlocked&&!progress.finished){title='A new chapter tomorrow';detail='The next daily cocoon opens another adventure. Your finds are saved.';label='See your finds';action=onOpen;}
 if(progress.finished){title='Five chapters explored';detail='Your keepsakes are yours. Pick one for the LCD.';label='Change your keepsake';action=onOpen;}
 if(pending&&!progress.ready&&!pet.cocoon&&!sleeping){const renewal=discoveredFormCount(pet)>=5;title=renewal?'A renewal cocoon is ready':'A new form is ready';detail=renewal?'Revisit a renewal form. Your adventure and keepsakes stay saved.':'A one-minute cocoon reveals your next form.';label='Start the cocoon';action=onEvolve;}
 if(pet.cocoon){title='Something new is growing';detail=`${cocoonSeconds(pet,now)} seconds until the cocoon opens. Your finds are safe.`;label='See your finds';action=onOpen;}
 if(sleeping){title=`${pet.name} is tucked in`;detail='A good place to finish. Your adventure will be here.';label='Open bedtime';action=onWake;}
 return <section className="adventure-card" aria-label="Your creature adventure">
  <div className="adventure-card-top"><span>{sleeping?<Moon size={14}/>:<Sparkles size={14}/>} {story.title}</span><button onClick={onOpen} disabled={busy} aria-label={`Open adventure, ${progress.chapter} of 5 keepsakes collected`}>{progress.chapter} / 5 finds</button></div>
  <h2>{title}</h2><p>{detail}</p>
  <button className="adventure-next" disabled={busy} onClick={action}>{label}<ArrowRight size={17}/></button>
 </section>;
}

export function AdventureRoom({pet,now,busy,onChoose,onEquip,onCare,onPlay}:Shared&{onChoose:(id:string)=>Promise<boolean>;onEquip:(id:string|null)=>Promise<boolean>}){
 const progress=adventureProgress(pet,now),story=adventures[pet.egg];
 const chapter=story.chapters[Math.min(progress.chapter,4)];
 const personalised=(copy:string)=>copy.split(eggs[pet.egg].name).join(pet.name);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const [found,setFound]=useState<{id:string;discovery:string}|null>(null);
 const lock=useRef(false);
 const resting=!!pet.cocoon||(!!pet.restUntil&&Date.parse(pet.restUntil)>+now)||hatchSeconds(pet,now)>0;
 const disabled=busy||saving;
 async function save(id:string|null,claim:boolean){
  if(lock.current||disabled)return;lock.current=true;setSaving(true);setError('');
  try{const result=claim&&id?await onChoose(id):await onEquip(id);if(!result)setError('That was not saved. Try again.');else if(claim&&id)setFound({id,discovery:personalised(chapter.discovery)});}
  catch{setError('That was not saved. Try again.');}finally{lock.current=false;setSaving(false);}
 }
 const options=keepsakes.filter(item=>item.chapter===progress.chapter);
 const collected=keepsakes.filter(item=>progress.items.includes(item.id));
 return <section className="adventure-room" aria-label={story.title}>
  <div className="adventure-map" aria-label={`${progress.chapter} of 5 chapters completed`}>{story.chapters.map((part,index)=><span key={part.title} className={index<progress.chapter?'is-found':index===progress.chapter?'is-current':''} aria-label={`Chapter ${index+1}: ${index<progress.chapter?'complete':index===progress.chapter?'next':'undiscovered'}`}>{index<progress.chapter?<Check size={18}/>:index+1}</span>)}</div>
  {found?<div className="adventure-discovery" role="status"><span className="adventure-found-icon"><KeepsakeIcon id={found.id}/></span><span className="adventure-eyebrow">NEW KEEPSAKE</span><h3>{keepsakes.find(item=>item.id===found.id)?.name}</h3><p>{found.discovery}</p><p className="adventure-small">It’s on your creature’s LCD. Change it in your collection whenever you like.</p><button className="primary-button" disabled={disabled} onClick={()=>setFound(null)}>See my collection<ArrowRight size={17}/></button></div>:
   !progress.finished?<div className="adventure-chapter"><span className="adventure-eyebrow">CHAPTER {progress.chapter+1} / 5</span><h3>{chapter.title}</h3><p>{personalised(chapter.prompt)}</p>
    {!progress.unlocked?<div className="adventure-wait"><Sparkles size={20}/><p>Your next form opens this chapter. Complete a daily cocoon to continue.</p></div>:<>
     <p className="adventure-rule">{progress.chapter===0?'Start with one care activity OR one game or toy round.':'Complete one care activity AND one game or toy round.'}</p>
     <div className="adventure-tasks"><button className={progress.careDone?'is-done':''} disabled={disabled||resting||progress.careDone||progress.ready} onClick={onCare}>{progress.careDone?<Check size={20}/>:<Heart size={20}/>}<span>Care together<small>{progress.careDone?'Complete':'Brush, wash, pat or feed'}</small></span></button><button className={progress.playDone?'is-done':''} disabled={disabled||resting||progress.playDone||progress.ready} onClick={onPlay}>{progress.playDone?<Check size={20}/>:<Gamepad2 size={20}/>}<span>Play together<small>{progress.playDone?'Complete':'A game or toy round'}</small></span></button></div>
     {resting&&!progress.ready&&<p className="adventure-small">Come back after your creature wakes or hatches. Your progress stays saved.</p>}
     <h4>{progress.ready?'Choose your keepsake':'Your next finds'}</h4><div className="adventure-choices">{options.map(item=><button key={item.id} disabled={disabled||!progress.ready||resting} onClick={()=>void save(item.id,true)}><KeepsakeIcon id={item.id}/><strong>{item.name}</strong><small>{progress.ready?'Choose this':'Finish the chapter'}</small></button>)}</div>
    </>}
   </div>:<div className="adventure-complete"><Sparkles size={28}/><h3>All five chapters explored</h3><p>Your collection stays with this companion’s story. Keep playing, or start a new generation when you’re ready.</p></div>}
  {error&&<p className="adventure-error" role="alert">{error}</p>}
  <div className="adventure-collection"><div className="adventure-collection-heading"><h3>Your keepsakes</h3><span>{collected.length} / 5</span></div>{collected.length?<><p className="adventure-small">Pick one to put on the LCD.</p><div className="adventure-collection-items">{collected.map(item=><button key={item.id} disabled={disabled} aria-pressed={progress.equipped===item.id} onClick={()=>void save(item.id,false)}><KeepsakeIcon id={item.id}/><span>{item.name}</span>{progress.equipped===item.id&&<Check className="keepsake-selected" size={15}/>}</button>)}<button className="keepsake-none" disabled={disabled} aria-pressed={progress.equipped===null} onClick={()=>void save(null,false)}><span aria-hidden="true">—</span><span>Clear LCD</span>{progress.equipped===null&&<Check className="keepsake-selected" size={15}/>}</button></div></>:<p className="adventure-small">Your first find will appear here.</p>}</div>
  {progress.chapter>0&&<details className="adventure-story"><summary>Story so far · {progress.chapter} {progress.chapter===1?'chapter':'chapters'}</summary><ol>{story.chapters.slice(0,progress.chapter).map((part,index)=><li key={part.title}><span className="adventure-eyebrow">CHAPTER {index+1}</span><h4>{part.title}</h4><p>{personalised(part.discovery)}</p></li>)}</ol></details>}
  <p className="adventure-note">No streaks to keep. Unfinished chapters stay ready for your next visit. Your own chores are separate in Check in.</p>
 </section>;
}

