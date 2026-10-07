'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Check, ChevronRight, Egg, Sprout, Timer} from 'lucide-react';
import {generationOf, hatchSeconds, lineageStatus, petSpriteStage, variantOf, type Pet} from './engine';
import {eggs} from './eggs';
import {appearanceNames, CreatureAppearance} from './creature-appearance';
import './family-album.css';

function FamilyPortrait({pet, variant = 0, stage, name}: {pet: Pick<Pet, 'egg'>; variant?: number; stage: number; name: string}) {
  return <CreatureAppearance egg={pet.egg} stage={stage} variant={variant} className="family-portrait">
    <img src={`${import.meta.env.BASE_URL}sprites/${pet.egg}-${stage}.png`} alt={stage === 0 ? `${eggs[pet.egg].name} mystery egg` : name} draggable={false}/>
  </CreatureAppearance>;
}

/** The engine rechecks eligibility and the caller's saved birth ID before saving. */
export function FamilyAlbum({pet, now, onBegin}: {pet: Pet; now: Date; onBegin: (name: string) => Promise<boolean>}) {
  const status = lineageStatus(pet, now);
  const generation = generationOf(pet);
  const variant = variantOf(pet);
  const [name, setName] = useState(`${pet.name.slice(0, 20)} ${generation + 1}`);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const inputId = useId();
  const confirmingHeading = useRef<HTMLHeadingElement>(null);
  const ancestors = pet.lineage?.ancestors ?? [];
  const asleep = !!pet.restUntil && Date.parse(pet.restUntil) > now.getTime();
  const currentStage = hatchSeconds(pet, now) > 0 ? 0 : petSpriteStage(pet);
  const validName = name.trim().length > 0 && name.trim().length <= 24;

  useEffect(() => {
    setName(`${pet.name.slice(0, 20)} ${generation + 1}`);
    setConfirming(false);
    setError('');
  }, [pet.bornAt]);

  useEffect(() => {if (confirming) confirmingHeading.current?.focus();}, [confirming]);

  async function begin() {
    if (lock.current || !status.eligible || !validName) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      if (!await onBegin(name.trim())) setError('The new egg was not saved. You can try again.');
    } catch {
      setError('The new egg was not saved. You can try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return <section className="family-album" aria-label="Creature family">
    <div className="family-current">
      <FamilyPortrait pet={pet} stage={currentStage} variant={variant} name={pet.name}/>
      <div><span className="family-eyebrow">GENERATION {generation} · WITH YOU NOW</span><h3>{pet.name}</h3><p>{eggs[pet.egg].name} family</p>{currentStage > 0 && <small>{appearanceNames[variant]}</small>}</div>
    </div>

    <div className="family-next">
      <div className="family-section-heading"><Sprout size={19}/><h3>The next generation</h3></div>
      <p>Your companion never dies. When you’re ready, raise a new egg from the same family. Every new generation has a small change to its features.</p>
      <div className="family-requirements">
        <div><span>{status.daysRemaining === 0 ? <Check size={15}/> : <Timer size={15}/>} Spend 7 days together</span><strong>{Math.max(0, 7 - status.daysRemaining)} / 7 days</strong><progress aria-label="Days together before a new generation" max={7} value={Math.max(0, 7 - status.daysRemaining)}/></div>
        <div><span>{status.evolutionsRemaining === 0 ? <Check size={15}/> : <Egg size={15}/>} Complete 2 cocoons</span><strong>{Math.max(0, 2 - status.evolutionsRemaining)} / 2</strong><progress aria-label="Cocoons completed before a new generation" max={2} value={Math.max(0, 2 - status.evolutionsRemaining)}/></div>
      </div>

      {!status.eligible && <p className="family-wait">{pet.cocoon ? 'Come back after this cocoon hatches.' : asleep ? 'Let your companion wake up first.' : currentStage === 0 ? 'Your first egg is still getting ready.' : 'Keep exploring together. There is no need to start a new generation as soon as it unlocks.'}</p>}
      {status.eligible && !confirming && <div className="family-new-egg">
        <div className="family-egg-preview"><FamilyPortrait pet={pet} stage={0} name="Next generation egg"/><div><span className="family-eyebrow">GENERATION {generation + 1}</span><h4>{eggs[pet.egg].name} egg</h4><p>Its new features are a hatching surprise.</p></div></div>
        <label htmlFor={inputId}>Name your next companion</label>
        <input id={inputId} className="text-input" value={name} onChange={event => setName(event.target.value)} maxLength={24} autoComplete="off"/>
        <button className="secondary-button" disabled={!validName} onClick={() => setConfirming(true)}>Choose this egg <ChevronRight size={17}/></button>
      </div>}
      {status.eligible && confirming && <div className="family-confirm">
        <h4 tabIndex={-1} ref={confirmingHeading}>Ready to raise {name.trim()}?</h4>
        <p>{pet.name} will stay in your family album with every form and check-in. {name.trim()} starts as an egg with fresh daily care. Your game levels and care practice carry on.</p>
        <p>You can keep caring for {pet.name} by choosing “Keep playing” below. Beginning a new generation makes the new egg your active companion.</p>
        {error && <p className="family-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={saving || !validName} onClick={() => void begin()}>{saving ? 'Saving new egg…' : 'Begin next generation'}<Egg size={17}/></button>
        <button className="secondary-button" disabled={saving} onClick={() => {setConfirming(false);setError('');}}>Keep playing with {pet.name}</button>
      </div>}
    </div>

    <div className="family-history">
      <div className="family-section-heading"><h3>Earlier companions</h3><span>{ancestors.length}</span></div>
      {ancestors.length === 0 ? <p className="family-empty">Your family starts here. Earlier companions will appear here when you begin a new generation.</p> : [...ancestors].reverse().map(ancestor => <article className="family-ancestor" key={`${ancestor.generation}-${ancestor.pet.bornAt}`}>
        <div className="family-ancestor-heading"><FamilyPortrait pet={ancestor.pet} stage={petSpriteStage(ancestor.pet)} variant={ancestor.variant} name={ancestor.pet.name}/><div><span className="family-eyebrow">GENERATION {ancestor.generation}</span><h4>{ancestor.pet.name}</h4><p>{eggs[ancestor.pet.egg].name} · {appearanceNames[ancestor.variant]}</p><small>{ancestor.pet.forms.length} forms · {Object.keys(ancestor.pet.checkins).length} check-ins</small></div></div>
        <details><summary>View saved journey</summary><div className="family-saved-journey"><span className="family-eyebrow">HATCHED {ancestor.pet.bornDate}</span><div className="family-forms">{ancestor.pet.forms.map(form => <div key={form.stage}><FamilyPortrait pet={ancestor.pet} variant={ancestor.variant} stage={petSpriteStage(ancestor.pet, form.stage)} name={`Form ${form.stage + 1}`}/><span>{form.at}</span></div>)}</div>{Object.entries(ancestor.pet.checkins).sort(([a], [b]) => b.localeCompare(a)).map(([date, checkin]) => <div className="family-saved-checkin" key={date}><span>{date}</span><span>{checkin.items.filter(item => item.done).length} / {checkin.items.length} chores</span></div>)}{Object.keys(ancestor.pet.checkins).length === 0 && <p>No check-ins saved.</p>}</div></details>
      </article>)}
    </div>
  </section>;
}
