'use client';

import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent} from 'react';
import {ArrowLeft, ArrowRight, Brush, Check, Droplets, Hand, RotateCcw, Utensils} from 'lucide-react';
import {brushTravel, careRules, rhythmBeatId, rhythmCanFeed, rhythmHit, rhythmPosition, SOAP_SPOTS, touchesSpot, type BrushTravel, type CareActivityKind, type Point} from './care-rules';
import {CreatureAppearance} from './creature-appearance';
import './care-activity.css';

export type CareActivityProps = {
  activity: CareActivityKind;
  name: string;
  spriteSrc: string;
  level: number;
  appearance?: {egg: number; stage: number; variant: number};
  onComplete: () => Promise<boolean>;
  onReact: () => void;
};
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const activityNames: Record<CareActivityKind, string> = {brush: 'Tooth brushing', wash: 'Wash time', pat: 'Pat time', feed: 'Mealtime'};
const labels: Record<CareActivityKind, string> = {brush: 'strokes', wash: 'steps', pat: 'pats', feed: 'bites'};
const Icons = {brush: Brush, wash: Droplets, pat: Hand, feed: Utensils};

export function CareActivity({activity, name, spriteSrc, level, appearance, onComplete, onReact}: CareActivityProps) {
  const [rules] = useState(() => careRules(level));
  const goal = activity === 'brush' ? rules.brushStrokes : activity === 'wash' ? rules.washSpots + rules.rinseStrokes : activity === 'pat' ? rules.pats : rules.bites;
  const [progress, setProgress] = useState(0);
  const [cleanSpots, setCleanSpots] = useState<number[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [notice, setNotice] = useState('');
  const [reaction, setReaction] = useState(0);
  const [brushX, setBrushX] = useState(.5);
  const [beat, setBeat] = useState(0);
  const [beatPass, setBeatPass] = useState(0);
  const [slow, setSlow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [keyDirection, setKeyDirection] = useState<-1 | 0 | 1>(0);
  const [dragging, setDragging] = useState(false);
  const currentProgress = useRef(0);
  const cleaned = useRef(new Set<number>());
  const saving = useRef(false);
  const saved = useRef(false);
  const mounted = useRef(true);
  const gesture = useRef<{id: number; point: Point; start: Point; patted: boolean; brush: BrushTravel} | null>(null);
  const suppressClick = useRef(false);
  const nextTapAt = useRef(0);
  const keyboardDirection = useRef<-1 | 0 | 1>(0);
  const beatStarted = useRef(0);
  const lastSuccessfulBeat = useRef<number | null>(null);
  const frame = useRef(0);
  const field = useRef<HTMLDivElement>(null);
  const completeCallback = useRef(onComplete);
  const reactCallback = useRef(onReact);
  completeCallback.current = onComplete;
  reactCallback.current = onReact;
  const done = progress >= goal;
  const rinsing = activity === 'wash' && progress >= rules.washSpots;
  const period = rules.beatPeriod * (slow ? 1.75 : 1);
  const Icon = Icons[activity];

  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false; cancelAnimationFrame(frame.current);};
  }, []);

  useEffect(() => {
    if (rinsing && !done) field.current?.focus({preventScroll: true});
  }, [rinsing, done]);

  useEffect(() => {
    if (activity !== 'feed' || done) return;
    beatStarted.current = performance.now();
    lastSuccessfulBeat.current = null;
    setBeat(0);
    setBeatPass(0);
    let previous = 0;
    const tick = (now: number) => {
      if (now - previous >= 30) {
        setBeat(rhythmPosition(now - beatStarted.current, period));
        setBeatPass(rhythmBeatId(now - beatStarted.current, period));
        previous = now;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [activity, period, done]);

  function react() {
    setReaction(value => value + 1);
    reactCallback.current();
  }

  async function save() {
    if (currentProgress.current < goal || saving.current || saved.current || !mounted.current) return;
    saving.current = true;
    setSaveStatus('saving');
    try {
      const success = await completeCallback.current();
      saved.current = success;
      if (mounted.current) setSaveStatus(success ? 'saved' : 'error');
    } catch {
      if (mounted.current) setSaveStatus('error');
    } finally {
      saving.current = false;
    }
  }

  function addProgress(amount = 1) {
    if (currentProgress.current >= goal || saving.current || saved.current) return;
    currentProgress.current = Math.min(goal, currentProgress.current + amount);
    setProgress(currentProgress.current);
    if (currentProgress.current === goal) {
      setNotice('Finished!');
      react();
      void save();
    }
  }

  function stroke(direction?: -1 | 1) {
    if (currentProgress.current >= goal) return;
    if (direction !== undefined) {
      if (keyboardDirection.current === direction) {
        setNotice(direction === -1 ? 'Now brush to the right.' : 'Now brush to the left.');
        return;
      }
      keyboardDirection.current = direction;
      setKeyDirection(direction);
      setBrushX(direction === -1 ? .25 : .75);
    }
    addProgress();
    setNotice(activity === 'brush' ? 'Back and forth. Keep brushing!' : 'Sweep the water across.');
  }

  function cleanSpot(index: number) {
    if (cleaned.current.has(index) || currentProgress.current >= rules.washSpots || currentProgress.current >= goal) return;
    cleaned.current.add(index);
    setCleanSpots([...cleaned.current]);
    addProgress();
    if (cleaned.current.size === rules.washSpots) {
      setNotice('All soaped up! Swipe left and right to rinse.');
      keyboardDirection.current = 0;
      setKeyDirection(0);
      // Start rinsing with a fresh stroke, after lifting the finger.
      gesture.current = null;
      setDragging(false);
      react();
    } else setNotice('Rub the next spot.');
  }

  function pat() {
    if (Date.now() < nextTapAt.current || currentProgress.current >= goal) return;
    nextTapAt.current = Date.now() + 360;
    addProgress();
    react();
    setNotice(progress % 2 ? 'A little scratch behind the ears.' : `${name} likes that!`);
  }

  function feed() {
    if (Date.now() < nextTapAt.current || currentProgress.current >= goal || saving.current) return;
    nextTapAt.current = Date.now() + 420;
    const elapsed = performance.now() - beatStarted.current;
    const currentBeat = rhythmBeatId(elapsed, period);
    if (rhythmCanFeed(elapsed, period, rules.beatWidth, lastSuccessfulBeat.current)) {
      lastSuccessfulBeat.current = currentBeat;
      addProgress();
      react();
      setNotice('Chomp! Catch the next beat.');
    } else if (lastSuccessfulBeat.current === currentBeat) {
      setNotice('One bite per beat. Wait for the marker to come back.');
    } else {
      setNotice('Wait for the marker to reach the middle. Try again.');
    }
  }

  function point(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))};
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (activity === 'feed' || currentProgress.current >= goal || gesture.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const next = point(event);
    gesture.current = {id: event.pointerId, point: next, start: next, patted: false, brush: {anchor: next.x, direction: 0}};
    suppressClick.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (activity === 'brush' || rinsing) setBrushX(next.x);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId || currentProgress.current >= goal) return;
    const next = point(event);
    if (activity === 'brush' || activity === 'wash' && currentProgress.current >= rules.washSpots) {
      setBrushX(next.x);
      const result = brushTravel(active.brush, next.x);
      active.brush = result.travel;
      if (result.stroke) stroke();
    } else if (activity === 'wash') {
      // Accumulate slow rubbing too; tiny pointer events must not erase travel.
      if (Math.hypot(next.x - active.point.x, next.y - active.point.y) < .02) return;
      SOAP_SPOTS.slice(0, rules.washSpots).forEach((spot, index) => {
        if (touchesSpot(active.point, next, spot)) cleanSpot(index);
      });
    } else if (activity === 'pat' && !active.patted && Math.hypot(next.x - active.start.x, next.y - active.start.y) >= .12) {
      active.patted = true;
      suppressClick.current = true;
      pat();
    }
    active.point = next;
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current && gesture.current.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function fieldKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.repeat || done) return;
    if ((activity === 'brush' || rinsing) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      stroke(event.key === 'ArrowLeft' ? -1 : 1);
    }
    if (activity === 'pat' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      pat();
    }
  }

  const instructions = done ? `${activityNames[activity]} complete.` : activity === 'brush'
    ? 'Slide your finger left and right across the teeth.'
    : activity === 'wash' ? rinsing ? 'Swipe left and right to rinse off the soap.' : 'Rub your finger over every little soap spot.'
      : activity === 'pat' ? `Stroke or gently tap ${name}. Give each pat a moment.`
        : 'Tap Feed when the marker is inside the middle zone.';
  const feedReady = rhythmHit(beat, rules.beatWidth) && beatPass !== lastSuccessfulBeat.current;

  return <div className={`care-activity care-activity-${activity}`}>
    <div className="care-topline"><span><Icon size={17}/>{activityNames[activity]}</span><span>Challenge {rules.level}</span></div>
    <div className="care-meter-label"><span>{activity === 'wash' && !done ? rinsing ? '02 / RINSE' : '01 / SOAP' : 'PROGRESS'}</span><strong>{progress} / {goal} {labels[activity]}</strong></div>
    <div className="care-meter" role="progressbar" aria-label={activityNames[activity]} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={progress}><span style={{width: `${progress / goal * 100}%`}}/></div>
    <div ref={field} className={`care-field ${dragging ? 'is-touching' : ''} ${rinsing ? 'is-rinsing' : ''} ${done ? 'is-done' : ''}`}
      role={activity === 'pat' ? 'button' : 'group'} tabIndex={activity === 'feed' || done ? -1 : 0}
      aria-label={activity === 'pat' ? `Pat ${name}` : `${activityNames[activity]} activity area`}
      aria-describedby="care-instructions" aria-disabled={done || undefined}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
      onKeyDown={fieldKey} onClick={() => {if (activity === 'pat' && !suppressClick.current) pat();}}>
      <span className="care-field-corner" aria-hidden="true">{done ? 'COMPLETE' : activity === 'feed' ? 'CHOMP CHOMP' : activity === 'wash' ? rinsing ? 'RINSE' : 'SCRUB' : activity === 'brush' ? 'BRUSH' : 'HELLO!'}</span>
      <CreatureAppearance key={reaction} egg={appearance?.egg ?? 0} stage={appearance?.stage ?? 1} variant={appearance?.variant ?? 0} className={`care-creature ${reaction ? 'care-bounce' : ''}`}><img src={spriteSrc} alt="" draggable={false}/></CreatureAppearance>
      {activity === 'brush' && !done && <div className="care-teeth" aria-hidden="true"><span/><span/><span/><span/><span/><span/></div>}
      {(activity === 'brush' || rinsing) && !done && <div className={`care-tool ${rinsing ? 'care-rinse-tool' : ''}`} style={{left: `${brushX * 68 + 16}%`}} aria-hidden="true">{rinsing ? <Droplets/> : <Brush/>}</div>}
      {activity === 'wash' && !rinsing && SOAP_SPOTS.slice(0, rules.washSpots).map((spot, index) => <button key={`soap-${index}`} className={`care-soap-spot ${cleanSpots.includes(index) ? 'is-clean' : ''}`} style={{left: `${spot.x * 100}%`, top: `${spot.y * 100}%`}} disabled={cleanSpots.includes(index)} onClick={() => cleanSpot(index)} aria-label={`Soap spot ${index + 1}`}><span/><span/><span/></button>)}
      {rinsing && !done && <div className="care-rinse-drops" aria-hidden="true">·&nbsp;│&nbsp;·&nbsp;│&nbsp;·&nbsp;│&nbsp;·</div>}
      {activity === 'pat' && !done && <div className="care-touch-hint" aria-hidden="true"><Hand size={18}/>{dragging ? 'A little scratch…' : 'Tap or stroke'}</div>}
      {activity === 'feed' && !done && <div className="care-food-dish" aria-hidden="true"><span>▪ ▪ ▪</span><i/></div>}
      {done && <div className="care-done-stamp"><Check size={19}/>{saveStatus === 'saved' ? 'ALL DONE' : 'FINISHED'}</div>}
    </div>
    <p id="care-instructions" className="care-instructions">{instructions}</p>
    {!done && (activity === 'brush' || rinsing) && <div className="care-stroke-controls" aria-label="Alternate the brush directions"><button onClick={() => stroke(-1)} aria-label="Brush left" className={keyDirection === 1 ? 'is-next' : ''}><ArrowLeft/>Left</button><span>or use<br/>arrow keys</span><button onClick={() => stroke(1)} aria-label="Brush right" className={keyDirection === -1 ? 'is-next' : ''}>Right<ArrowRight/></button></div>}
    {!done && activity === 'wash' && !rinsing && <p className="care-alternative">Using a keyboard? Tab to each spot and press Enter.</p>}
    {!done && activity === 'pat' && <p className="care-alternative">You can also focus the screen and press Space.</p>}
    {!done && activity === 'feed' && <div className="care-feeding">
      <div className="care-beat-label"><span>WAIT</span><strong>FEED HERE</strong><span>WAIT</span></div>
      <div className={`care-beat-track ${feedReady ? 'is-ready' : ''}`} aria-hidden="true" style={{'--beat-width': `${rules.beatWidth * 100}%`} as CSSProperties}><span className="care-beat-zone"/><span className="care-beat-marker" style={{left: `${beat * 100}%`}}/></div>
      <strong className={`care-beat-cue ${feedReady ? 'is-ready' : ''}`} role="status" aria-live="polite" aria-atomic="true">{feedReady ? 'Feed now' : 'Wait for the next beat'}</strong>
      <button className="care-feed-button" onClick={feed}><Utensils size={20}/>Feed a bite</button>
      <label className="care-slow"><input type="checkbox" checked={slow} onChange={event => setSlow(event.target.checked)}/>Slower pace</label>
      <p className="care-alternative">Space or Enter works on the Feed button. Missed it? Just try the next beat.</p>
    </div>}
    <p className="care-notice" role="status" aria-live="polite">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? `${name} is all set.` : saveStatus === 'error' ? 'Couldn’t save yet. Your activity is finished — try saving again.' : notice || (activity === 'feed' ? 'No rush. Find the beat.' : 'Ready when you are.')}</p>
    {saveStatus === 'error' && <button className="care-save-again" onClick={() => void save()}><RotateCcw size={17}/>Try saving again</button>}
    {saveStatus === 'saved' && <div className="care-saved"><Check size={18}/>Care saved</div>}
  </div>;
}
