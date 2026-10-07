'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {CreatureAppearance} from './creature-appearance';
import './toy-box.css';

type Toy = 'ball' | 'bubbles';
type Reaction = 'hop' | 'laugh' | null;
const BUBBLES = [0, 1, 2, 3, 4, 5];
const LAUGHS = ['Hee hee!', 'Ha! That tickles!', 'Again!'];

export function ToyBox({name, spriteSrc, appearance, onReact}: {
  name: string;
  spriteSrc: string;
  appearance?: {egg: number; stage: number; variant: number};
  onReact: () => void;
}) {
  const [toy, setToy] = useState<Toy>('ball');
  const [message, setMessage] = useState('Tap the ball to toss it.');
  const [ballSide, setBallSide] = useState<'left' | 'right'>('left');
  const [throwing, setThrowing] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [reactionId, setReactionId] = useState(0);
  const [popped, setPopped] = useState<number[]>([]);
  const [bubbleRound, setBubbleRound] = useState(0);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throwTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laughCount = useRef(0);
  const throwingRef = useRef(false);

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (throwTimer.current) clearTimeout(throwTimer.current);
  }, []);

  function react(kind: Exclude<Reaction, null>) {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReaction(kind);
    setReactionId(value => value + 1);
    reactionTimer.current = setTimeout(() => setReaction(null), 900);
    onReact();
  }

  function changeToy(next: Toy) {
    if (next === toy) return;
    if (throwTimer.current) clearTimeout(throwTimer.current);
    throwingRef.current = false;
    setThrowing(false);
    setToy(next);
    setMessage(next === 'ball' ? 'Tap the ball to toss it.' : 'Pop a bubble. Try all six!');
  }

  function tossBall() {
    if (throwingRef.current) return;
    throwingRef.current = true;
    setThrowing(true);
    setBallSide(side => side === 'left' ? 'right' : 'left');
    setMessage(ballSide === 'left' ? 'Boing! Coming back to you!' : 'Nice throw!');
    react('hop');
    throwTimer.current = setTimeout(() => {
      throwingRef.current = false;
      setThrowing(false);
    }, 1000);
  }

  function popBubble(id: number) {
    if (popped.includes(id)) return;
    const next = [...popped, id];
    setPopped(next);
    setMessage(next.length === BUBBLES.length ? 'All popped! Blow some more?' : ['Pop!', 'Plip!', 'Pop pop!'][next.length % 3]);
    react('hop');
  }

  function blowBubbles() {
    setPopped([]);
    setBubbleRound(round => round + 1);
    setMessage('Six fresh bubbles. Ready, set… pop!');
    react('laugh');
  }

  function tickle() {
    setMessage(LAUGHS[laughCount.current % LAUGHS.length]);
    laughCount.current += 1;
    react('laugh');
  }

  const ballStyle = {
    '--ball-from': ballSide === 'left' ? '80%' : '20%',
    '--ball-to': ballSide === 'left' ? '20%' : '80%',
  } as CSSProperties;

  return <div className="toy-box">
    <div className="toy-picker" role="group" aria-label="Choose a toy">
      <button type="button" aria-pressed={toy === 'ball'} onClick={() => changeToy('ball')}>
        <span className="toy-picker-ball" aria-hidden="true" /> Bounce a ball
      </button>
      <button type="button" aria-pressed={toy === 'bubbles'} onClick={() => changeToy('bubbles')}>
        <span className="toy-picker-bubbles" aria-hidden="true">○◦</span> Pop bubbles
      </button>
    </div>

    <div className={`toy-scene toy-scene-${toy}`} aria-label={`${name}’s play area`}>
      <span className="toy-scene-label" aria-hidden="true">FREE PLAY</span>
      {toy === 'bubbles' && <div className="toy-bubble-grid" key={bubbleRound}>
        {BUBBLES.map(id => <div className="toy-bubble-slot" key={id}>
          <button
            type="button"
            className={`toy-bubble ${popped.includes(id) ? 'is-popped' : ''}`}
            style={{'--bubble-tilt': `${((id + bubbleRound) % 3 - 1) * 9}deg`} as CSSProperties}
            aria-label={`Pop bubble ${id + 1}${popped.includes(id) ? ', popped' : ''}`}
            aria-disabled={popped.includes(id)}
            onClick={() => popBubble(id)}
          ><span aria-hidden="true">{popped.includes(id) ? '✧' : ''}</span></button>
        </div>)}
      </div>}

      <div className="toy-pet-position">
        <button type="button" className="toy-pet" onClick={tickle} aria-label={`Tickle ${name}`}>
          <CreatureAppearance key={reactionId} egg={appearance?.egg ?? 0} stage={appearance?.stage ?? 1} variant={appearance?.variant} className={`toy-pet-appearance ${reaction ? `toy-pet-${reaction}` : ''}`}><img src={spriteSrc} alt="" draggable={false}/></CreatureAppearance>
          {reaction === 'laugh' && <span key={`laugh-${reactionId}`} className="toy-giggle" aria-hidden="true">HA!</span>}
        </button>
        <span className="toy-pet-shadow" aria-hidden="true" />
      </div>
      <div className="toy-floor" aria-hidden="true" />

      {toy === 'ball' && <button
        type="button"
        className={`toy-ball ${throwing ? 'is-thrown' : ''}`}
        style={ballStyle}
        aria-label="Toss the ball"
        aria-disabled={throwing}
        onClick={tossBall}
      ><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" /><path d="M9 12C32 13 17 37 39 36M12 39C13 16 37 31 36 9" /></svg></button>}
    </div>

    <p className="toy-speech" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    {toy === 'bubbles'
      ? <button type="button" className="toy-action" onClick={blowBubbles}>Blow more bubbles <span aria-hidden="true">○◦</span></button>
      : <button type="button" className="toy-action" onClick={tossBall} aria-disabled={throwing}>Toss the ball <span aria-hidden="true">↗</span></button>}
    <p className="toy-hint">Tap {name} to make him laugh.</p>
  </div>;
}
