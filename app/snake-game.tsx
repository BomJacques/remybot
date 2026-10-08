'use client';

import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw} from 'lucide-react';
import {CreatureAppearance} from './creature-appearance';
import {MAX_LEVELS} from './game-rules';
import {createSnake, snakeRules, stepSnake, turnSnake, type SnakeDirection, type SnakeState} from './snake-rules';
import './snake-game.css';

type SnakeGameProps = {
  name: string;
  spriteSrc: string;
  appearance?: {egg: number; stage: number; variant: number};
  wins: number;
  onComplete: () => Promise<boolean>;
  onReact: () => void;
  onBack: () => void;
};
type Phase = 'ready' | 'playing' | 'paused' | 'finished';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const directionKeys: Record<string, SnakeDirection> = {ArrowUp: 'up', w: 'up', W: 'up', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left'};
const directionIcons = {up: ArrowUp, left: ArrowLeft, down: ArrowDown, right: ArrowRight};

export function SnakeGame({name, spriteSrc, appearance, wins, onComplete, onReact, onBack}: SnakeGameProps) {
  const [rules, setRules] = useState(() => snakeRules(wins));
  const [board, setBoard] = useState(() => createSnake(rules));
  const [phase, setPhase] = useState<Phase>('ready');
  const [slow, setSlow] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [cheer, setCheer] = useState(0);
  const boardRef = useRef(board);
  const phaseRef = useRef<Phase>('ready');
  const mounted = useRef(true);
  const saving = useRef(false);
  const saved = useRef(false);
  const field = useRef<HTMLDivElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{id: number; x: number; y: number; turned: boolean} | null>(null);
  const callbacks = useRef({onComplete, onReact});
  callbacks.current = {onComplete, onReact};

  function updatePhase(value: Phase) {
    phaseRef.current = value;
    setPhase(value);
    gesture.current = null;
  }

  async function saveWin() {
    if (boardRef.current.status !== 'won' || saving.current || saved.current || !mounted.current) return;
    saving.current = true;
    setSaveStatus('saving');
    try {
      const success = await callbacks.current.onComplete();
      saved.current = success;
      if (mounted.current) setSaveStatus(success ? 'saved' : 'error');
    } catch {
      if (mounted.current) setSaveStatus('error');
    } finally {
      saving.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    startButton.current?.focus({preventScroll: true});
    const hidden = () => {
      if (document.hidden && phaseRef.current === 'playing') updatePhase('paused');
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {mounted.current = false; document.removeEventListener('visibilitychange', hidden);};
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      if (phaseRef.current !== 'playing' || document.hidden) return;
      const previous = boardRef.current;
      const next = stepSnake(previous, rules);
      boardRef.current = next;
      setBoard(next);
      if (next.score > previous.score) {
        setCheer(value => value + 1);
        callbacks.current.onReact();
      }
      if (next.status !== 'running') {
        updatePhase('finished');
        if (next.status === 'won') void saveWin();
      }
    }, Math.round(rules.stepMs * (slow ? 1.7 : 1)));
    return () => clearInterval(timer);
  }, [phase, rules, slow]);

  useEffect(() => {
    if (phase === 'playing') field.current?.focus({preventScroll: true});
    else if (phase === 'paused' || phase === 'finished') actionButton.current?.focus({preventScroll: true});
  }, [phase, saveStatus]);

  function steer(direction: SnakeDirection) {
    if (phaseRef.current !== 'playing') return;
    const next = turnSnake(boardRef.current, direction);
    boardRef.current = next;
    setBoard(next);
  }

  function restart() {
    if (saving.current) return;
    const nextRules = snakeRules(wins);
    const next = createSnake(nextRules);
    saved.current = false;
    setSaveStatus('idle');
    setCheer(0);
    setRules(nextRules);
    boardRef.current = next;
    setBoard(next);
    updatePhase('ready');
    requestAnimationFrame(() => startButton.current?.focus({preventScroll: true}));
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const direction = directionKeys[event.key];
    if (!direction || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) steer(direction);
  }

  function pointerStart(event: PointerEvent<HTMLDivElement>) {
    if (phaseRef.current !== 'playing' || !event.isPrimary || event.button !== 0) return;
    gesture.current = {id: event.pointerId, x: event.clientX, y: event.clientY, turned: false};
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({preventScroll: true});
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const swipe = gesture.current;
    if (!swipe || swipe.id !== event.pointerId || swipe.turned) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    swipe.turned = true;
    steer(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  }

  const won = board.status === 'won';
  const bumped = board.status === 'bumped';
  const maxLevel = MAX_LEVELS.snake;
  const message = won ? saveStatus === 'saving' ? 'Saving play time…' : saveStatus === 'error' ? 'Snacks collected! Saving did not work. Try saving again.' : `${name} cheers! All ${rules.goal} snacks collected.` : bumped ? 'All tangled up! Try again whenever you like.' : phase === 'paused' ? 'Paused. Your snake will wait for you.' : phase === 'ready' ? `Collect ${rules.goal} apples. Going off an edge brings you back on the other side.` : board.score ? `${name} cheers you on. Keep finding apples!` : 'Steer to the apple. Keep clear of your own tail.';

  return <div className="play-game snake-game" onKeyDown={keyboard}>
    <div className="play-toolbar"><button className="play-back" onClick={onBack} disabled={saveStatus === 'saving'} aria-label="Choose another game"><ArrowLeft size={16}/>Games</button><strong>Snack snake</strong></div>
    <div className="play-score"><span>{board.score} / {rules.goal} apples</span><span className="play-level">Level {rules.level} / {maxLevel}</span></div>
    <div className="play-progress" role="progressbar" aria-label="Apples collected" aria-valuemin={0} aria-valuemax={rules.goal} aria-valuenow={board.score}>{Array.from({length: rules.goal}, (_, index) => <span key={index} className={index < board.score ? 'is-filled' : ''}/>)}</div>
    <div className="snake-scene">
      <div ref={field} className={`snake-field ${phase !== 'playing' ? 'snake-field-still' : ''}`} tabIndex={0} role="group" aria-label="Snake playing field. Use arrow keys, W A S D, swipe, or direction buttons." onPointerDown={pointerStart} onPointerMove={pointerMove} onPointerUp={() => {gesture.current = null;}} onPointerCancel={() => {gesture.current = null;}}>
        <svg viewBox={`0 0 ${rules.columns * 10} ${rules.rows * 10}`} className="snake-grid" aria-hidden="true" shapeRendering="crispEdges">
          <defs><pattern id="snake-pixels" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="currentColor" strokeWidth=".25" opacity=".22"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#snake-pixels)"/>
          {board.apple && <g transform={`translate(${board.apple.x * 10} ${board.apple.y * 10})`} className="snake-apple"><path d="M4 1H6V3H8V4H9V8H8V9H2V8H1V4H2V3H4ZM6 0H8V1H6Z"/><path d="M3 4H4V6H3Z" className="snake-highlight"/></g>}
          {board.body.map((cell, index) => <g key={`${cell.x}-${cell.y}`} transform={`translate(${cell.x * 10} ${cell.y * 10})`} className={index ? 'snake-body' : 'snake-head'}>
            <path d="M1 1H9V9H1Z"/>
            {index === 0 ? <g transform={`rotate(${({right: 0, down: 90, left: 180, up: 270})[board.direction]} 5 5)`}><path className="snake-highlight" d="M6 2H8V4H6ZM6 6H8V8H6Z"/></g> : <path className="snake-highlight" d="M2 2H4V4H2Z"/>}
          </g>)}
        </svg>
        {phase === 'ready' && <div className="snake-overlay"><strong>Snack time!</strong><span>{rules.goal} apples to find</span><button ref={startButton} className="snake-start" onClick={() => updatePhase('playing')}><Play size={18}/>Start snake</button></div>}
        {phase === 'paused' && <div className="snake-overlay"><strong>Paused</strong><button ref={actionButton} className="snake-start" onClick={() => updatePhase('playing')}><Play size={18}/>Keep playing</button></div>}
        {phase === 'finished' && <div className="snake-overlay snake-finished"><strong>{won ? 'Snack mission complete!' : 'A little tangle'}</strong><span>{won ? `${board.score} apples collected` : 'Have another go'}</span></div>}
      </div>
      <div className="snake-cheering" aria-hidden="true"><CreatureAppearance key={cheer} egg={appearance?.egg ?? 0} stage={appearance?.stage ?? 1} variant={appearance?.variant} className={`snake-companion ${cheer ? 'play-reaction-hop' : ''}`}><img src={spriteSrc} alt="" draggable={false}/></CreatureAppearance><span>{won ? 'YUM!' : cheer ? 'GO, GO!' : 'LET’S GO'}</span></div>
    </div>
    <p className="snake-status" role="status" aria-atomic="true">{message}</p>
    {(phase === 'ready' || phase === 'playing' || phase === 'paused') && <>
      <div className="snake-controls" aria-label="Snake direction controls">{(['up', 'left', 'down', 'right'] as const).map(direction => {const Icon = directionIcons[direction]; return <button key={direction} className={`snake-direction snake-direction-${direction}`} aria-label={`Go ${direction}`} disabled={phase !== 'playing'} onClick={() => steer(direction)}><Icon aria-hidden="true"/></button>;})}</div>
      <div className="snake-options"><button className="play-watch-button" aria-pressed={slow} onClick={() => setSlow(value => !value)}>{slow ? 'Slower pace: on' : 'Slower pace: off'}</button><button className="play-watch-button" disabled={phase === 'ready'} onClick={() => updatePhase(phaseRef.current === 'playing' ? 'paused' : 'playing')}>{phase === 'paused' ? <Play size={16}/> : <Pause size={16}/>}<span>{phase === 'paused' ? 'Resume' : 'Pause'}</span></button></div>
      <p className="play-next-level">Swipe, use the arrows, or press W A S D. You can pause any time.</p>
    </>}
    {won && saveStatus === 'saved' && <div className="play-level-unlocked" role="status"><strong>{rules.level < maxLevel ? `Level ${rules.level + 1} unlocked!` : 'Top level complete!'}</strong><span>{rules.level < maxLevel ? `Next: ${snakeRules(rules.level).goal} apples. Slower pace is always available.` : 'Play again for a fresh trail of snacks.'}</span></div>}
    {phase === 'finished' && <button ref={actionButton} className="primary-button" disabled={saveStatus === 'saving' || won && saveStatus === 'idle'} onClick={() => saveStatus === 'error' ? void saveWin() : restart()}>{saveStatus === 'error' ? 'Save play time again' : saveStatus === 'saving' ? 'Saving…' : bumped ? <><RotateCcw size={17}/>Try again</> : rules.level < maxLevel ? `Play level ${rules.level + 1}` : 'Play again'}</button>}
  </div>;
}
