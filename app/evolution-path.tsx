import {useId} from 'react';
import {FORM_COUNT, hatchSeconds, petSpriteStage, petStageName, variantOf, type Pet} from './engine';
import {CreatureAppearance} from './creature-appearance';
import './evolution-path.css';

/** Reveal an image only after its form has actually emerged from a cocoon. */
export function EvolutionPath({pet, now}: {pet: Pet; now: Date}) {
  const titleId = useId();
  const hatched = hatchSeconds(pet, now) === 0;
  const discovered = new Map<number, number>();
  if (hatched) for (const form of pet.forms) {
    if (form.stage > pet.revealedStage) continue;
    const visual = petSpriteStage(pet, form.stage);
    if (!discovered.has(visual)) discovered.set(visual, form.stage);
  }
  const current = hatched ? petSpriteStage(pet) : 0;

  return <section className="evolution-path" aria-labelledby={titleId}>
    <div className="evolution-path-heading"><h3 id={titleId}>Forms discovered</h3><span>{discovered.size} / {FORM_COUNT}</span></div>
    <ol className="evolution-path-steps">
      {Array.from({length: FORM_COUNT}, (_, index) => {
        const visual = index + 1;
        const firstStage = discovered.get(visual);
        const unlocked = firstStage !== undefined;
        const label = unlocked ? petStageName(pet, firstStage) : 'Undiscovered';
        return <li key={visual} className={`${unlocked ? 'is-discovered' : ''} ${current === visual ? 'is-current' : ''}`} aria-current={current === visual ? 'step' : undefined}>
          <div className="evolution-path-portrait" title={label}>
            {unlocked ? <CreatureAppearance className="evolution-path-creature" egg={pet.egg} stage={visual} variant={variantOf(pet)}><img src={`${import.meta.env.BASE_URL}sprites/${pet.egg}-${visual}.png`} alt={label} draggable={false}/></CreatureAppearance> : <span className="evolution-path-mystery" aria-label="Undiscovered form">?</span>}
          </div>
          <span className="evolution-path-number">FORM {visual}</span>
          {current === visual && <span className="evolution-path-current">Now</span>}
        </li>;
      })}
    </ol>
    <p className="evolution-path-note">{!hatched ? 'Your first form is still inside the egg.' : pet.cocoon ? 'The cocoon is growing. Its next form stays hidden until it hatches.' : discovered.size < FORM_COUNT ? `${petStageName(pet)} now. Complete a daily cocoon to discover the next form.` : 'All five forms discovered. Cocoons continue with renewal forms.'}</p>
  </section>;
}
