import {useRef,useState,type ReactNode} from 'react';
import {Check,Heart,Moon,Sparkles,Utensils,Droplets,Brush,ChevronRight} from 'lucide-react';
import {careProgress,foodAt,dateKey,type Pet} from './engine';
import './care-hub.css';

export type CareChoice='brush'|'wash'|'pat'|'feed'|'bedtime';
export function CareHub({pet,now,onChoose}:{pet:Pet;now:Date;onChoose:(choice:CareChoice)=>void}){
 const progress=careProgress(pet,now);
 const sleeping=!!pet.restUntil&&Date.parse(pet.restUntil)>+now;
 const fed=pet.fedDates.includes(dateKey(now,pet.timezone));
 const cards=[
  {id:'brush' as const,title:'Brush teeth',text:'Brush back and forth until they sparkle.',icon:Brush,done:progress.today.brush},
  {id:'wash' as const,title:'Wash time',text:'Scrub the soap spots, then rinse.',icon:Droplets,done:progress.today.wash},
  {id:'pat' as const,title:'Give him a pat',text:'Gentle strokes fill his affection meter.',icon:Heart,done:progress.today.pat},
  {id:'feed' as const,title:'Feed to the beat',text:foodAt(pet,now).level===3?'His tummy is full.':'Choose a snack, then tap in rhythm.',icon:Utensils,done:fed},
 ];
 return <div className="care-hub">
  <div className="care-level"><Sparkles size={22}/><div><strong>Care level {progress.level}</strong><span>{progress.untilNext} daily care {progress.untilNext===1?'task':'tasks'} to the next level</span></div><b>{progress.xp} XP</b></div>
  <div className="care-xp-track" role="progressbar" aria-label="Care level progress" aria-valuenow={progress.progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:progress.progress+'%'}}/></div>
  <p className="care-day-note">{pet.name}’s routine today <span>{cards.filter(card=>card.done).length} / 4</span></p>
  <div className="care-activity-list">{cards.map(({id,title,text,icon:Icon,done})=><button key={id} className="care-task" disabled={sleeping||!!pet.cocoon||(id==='feed'&&foodAt(pet,now).level===3)} onClick={()=>onChoose(id)}><span className="care-task-icon"><Icon size={23}/></span><span><strong>{title}</strong><small>{text}</small></span><span className={`care-task-status ${done?'is-done':''}`}>{done?<><Check size={14}/>Done</>:<ChevronRight size={18}/>}</span></button>)}</div>
  <button className="bedtime-link" onClick={()=>onChoose('bedtime')}><Moon size={22}/><span><strong>Bedtime & naps</strong><small>{sleeping?'He’s asleep. Check in or wake him gently.':'Pull up the blanket and turn out the light.'}</small></span><ChevronRight size={18}/></button>
  <p className="care-hub-note">Brushing, washing and patting each earn 1 XP the first time each day. Repeat for practice. Your own chores stay in Check in.</p>
 </div>;
}

export function Bedtime({pet,now,creature,onBedtime,onWake,onNap}:{pet:Pet;now:Date;creature:ReactNode;onBedtime:()=>Promise<boolean>;onWake:()=>Promise<boolean>;onNap:()=>Promise<boolean>}){
 const [blanket,setBlanket]=useState(0),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const savingRef=useRef(false);
 const sleeping=!!pet.restUntil&&Date.parse(pet.restUntil)>+now;
 const minutes=sleeping?Math.max(1,Math.ceil((Date.parse(pet.restUntil!)-+now)/60000)):0;
 const progress=careProgress(pet,now);
 async function save(which:'bed'|'wake'|'nap'){
  if(savingRef.current)return;savingRef.current=true;setSaving(true);setNotice('');
  try{if(await (which==='bed'?onBedtime:which==='nap'?onNap:onWake)()){setBlanket(0);setNotice(which==='wake'?'Morning! Ready to play.':which==='nap'?'A short nap.':'Light off. Time to sleep.');}else setNotice('That was not saved. Try again.');}
  catch{setNotice('That was not saved. Try again.');}finally{savingRef.current=false;setSaving(false);}
 }
 return <div className="bedtime-room">
  <div className={`bedtime-scene ${sleeping?'lights-out':''}`}>
   <span className="bedtime-stars" aria-hidden="true">✦ · ✧ · ✦</span><span className="bedtime-window" aria-hidden="true">☾</span>
   <div className="bedtime-pet">{creature}</div><div className="bedtime-pillow" aria-hidden="true"/>
   <div className="bedtime-blanket" aria-hidden="true" style={{height:(sleeping?42:12+blanket*.3)+'%'}}><span>▧ &nbsp; ▧ &nbsp; ▧</span></div>
   {sleeping&&<span className="bedtime-zzz" aria-hidden="true">z Z</span>}
  </div>
  {sleeping?<><p className="bedtime-status">{pet.name} is {pet.restMode==='bedtime'?'in bed':'napping'}.<strong>{minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes}m`} until wake-up</strong></p><button className="primary-button" disabled={saving} onClick={()=>void save('wake')}>Wake him gently</button></>:<>
   <div className="bedtime-checks"><span className={progress.today.brush?'ready':''}>{progress.today.brush?<Check size={14}/>:<Brush size={14}/>}Teeth</span><span className={progress.today.wash?'ready':''}>{progress.today.wash?<Check size={14}/>:<Droplets size={14}/>}Washed</span><span className={foodAt(pet,now).level>0?'ready':''}>{foodAt(pet,now).level>0?<Check size={14}/>:<Utensils size={14}/>}Tummy</span></div>
   <label className="blanket-label" htmlFor="bedtime-blanket">{blanket>=85?'All tucked in. Switch off the light.':'Pull up the blanket.'}<span>{blanket}%</span></label>
   <input id="bedtime-blanket" aria-label="Pull up the blanket" type="range" min="0" max="100" value={blanket} disabled={saving||!!pet.cocoon} onChange={event=>setBlanket(Number(event.target.value))}/>
   <button className="primary-button" disabled={saving||blanket<85||!!pet.cocoon} onClick={()=>void save('bed')}><Moon size={18}/>Lights out · 8 hours</button>
   <button className="secondary-button" disabled={saving||!!pet.cocoon} onClick={()=>void save('nap')}>Take a 20-minute nap</button>
   <p className="care-hub-note">Sleep continues when you close the app. You can wake him early.</p>
  </>}
  {notice&&<p className="bedtime-notice" role="status">{notice}</p>}
 </div>;
}
