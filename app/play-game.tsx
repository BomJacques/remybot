'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowUp, Hand, RotateCw} from 'lucide-react';
import './play-game.css';

export type PlayGameProps = {
  name: string;
  spriteSrc: string;
  onComplete: () => Promise<boolean>;
  onReact: () => void;
};

type Game = 'stars' | 'moves';
type Move = 'hop' | 'spin' | 'wave';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const starPlaces = [{x: 13, y: 25}, {x: 86, y: 8}, {x: 69, y: 86}, {x: 13, y: 82}, {x: 48, y: 38}];
const patterns: Move[][] = [['hop'], ['wave', 'hop'], ['spin', 'hop', 'wave']];
const moveNames: Record<Move, string> = {hop: 'Hop', spin: 'Spin', wave: 'Wave'};
const MoveIcon = ({move}: {move: Move}) => move === 'hop' ? <ArrowUp/> : move === 'spin' ? <RotateCw/> : <Hand/>;

function PixelStar({filled = true}: {filled?: boolean}) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className="play-pixel-star"><path d="M7 1h2v4h2v1h4v3h-3v2h1v4h-3v-2H6v2H3v-4h1V9H1V6h4V5h2z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1}/></svg>;
}

export function PlayGame({name, spriteSrc, onComplete, onReact}: PlayGameProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [caught, setCaught] = useState(0);
  const [cooling, setCooling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [round, setRound] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'watching' | 'playing' | 'roundDone'>('ready');
  const [shownMove, setShownMove] = useState<Move | null>(null);
  const [reaction, setReaction] = useState<Move>('hop');
  const [reactionId, setReactionId] = useState(0);
  const [notice, setNotice] = useState('');
  const caughtRef = useRef(0);
  const inputIndex = useRef(0);
  const nextTapAt = useRef(0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const starButton = useRef<HTMLButtonElement>(null);
  const firstMove = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const reactRef = useRef(onReact);
  reactRef.current = onReact;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    const button = !game ? firstChoice.current : saveStatus === 'saved' || saveStatus === 'error' ? nextButton.current : saveStatus !== 'idle' ? null : game === 'stars' ? starButton.current : phase === 'playing' ? firstMove.current : phase === 'watching' ? null : nextButton.current;
    button?.focus({preventScroll: true});
  }, [game, phase, saveStatus]);

  useEffect(() => {
    if (game !== 'moves' || phase !== 'watching') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    patterns[round].forEach((move, index) => {
      timers.push(setTimeout(() => {
        setShownMove(move);
        setReaction(move);
        setReactionId(id => id + 1);
      }, index * 1200));
      timers.push(setTimeout(() => setShownMove(null), index * 1200 + 950));
    });
    timers.push(setTimeout(() => {
      inputIndex.current = 0;
      setMoveIndex(0);
      setPhase('playing');
      setNotice('Your turn! Copy the moves in order.');
    }, patterns[round].length * 1200));
    return () => timers.forEach(clearTimeout);
  }, [game, phase, round]);

  function animate(move: Move) {
    setReaction(move);
    setReactionId(id => id + 1);
    reactRef.current();
  }

  function startGame(nextGame: Game | null) {
    if (saving.current) return;
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    caughtRef.current = 0;
    inputIndex.current = 0;
    nextTapAt.current = 0;
    setCooling(false);
    setCaught(0);
    setRound(0);
    setMoveIndex(0);
    setPhase('ready');
    setShownMove(null);
    setReactionId(0);
    setSaveStatus('idle');
    setNotice('');
    setGame(nextGame);
  }

  async function savePlay() {
    if (saving.current || saveStatus === 'saved') return;
    saving.current = true;
    setSaveStatus('saving');
    try {
      const saved = await onComplete();
      if (mounted.current) setSaveStatus(saved ? 'saved' : 'error');
    } catch {
      if (mounted.current) setSaveStatus('error');
    } finally {
      saving.current = false;
    }
  }

  function catchStar() {
    if (caughtRef.current >= 5 || Date.now() < nextTapAt.current || saving.current) return;
    nextTapAt.current = Date.now() + 360;
    setCooling(true);
    cooldownTimer.current = setTimeout(() => setCooling(false), 360);
    const count = ++caughtRef.current;
    setCaught(count);
    animate('hop');
    if (count === 5) void savePlay();
  }

  function showPattern() {
    if (saving.current || phase === 'watching') return;
    inputIndex.current = 0;
    setMoveIndex(0);
    setNotice('Watch the moves.');
    setPhase('watching');
  }

  function copyMove(move: Move) {
    if (phase !== 'playing' || Date.now() < nextTapAt.current) return;
    nextTapAt.current = Date.now() + 280;
    animate(move);
    if (patterns[round][inputIndex.current] !== move) {
      inputIndex.current = 0;
      setMoveIndex(0);
      setPhase('ready');
      setNotice('Let’s watch that pattern again.');
      return;
    }
    inputIndex.current += 1;
    setMoveIndex(inputIndex.current);
    if (inputIndex.current === patterns[round].length) {
      setPhase('roundDone');
      setNotice(round === 2 ? 'All three patterns copied!' : 'You got it!');
      if (round === 2) void savePlay();
    } else setNotice('Yes! What comes next?');
  }

  const complete = game === 'stars' ? caught === 5 : round === 2 && phase === 'roundDone';
  const place = starPlaces[Math.min(caught, 4)];

  if (!game) return <div className="play-game">
    <div className="play-chooser-mascot" aria-hidden="true"><img src={spriteSrc} alt="" draggable={false}/><span>LET’S PLAY</span></div>
    <div className="play-choices">
      <button ref={firstChoice} className="play-choice" onClick={() => startGame('stars')}><PixelStar/><span><strong>Catch the stars</strong><small>Find five stars for {name}. No timer.</small></span><span aria-hidden="true">→</span></button>
      <button className="play-choice" onClick={() => startGame('moves')}><Hand/><span><strong>Copy my moves</strong><small>Hop, spin and wave. Three little patterns.</small></span><span aria-hidden="true">→</span></button>
    </div>
  </div>;

  return <div className="play-game">
    <div className="play-toolbar">
      <button className="play-back" onClick={() => startGame(null)} disabled={saveStatus === 'saving'} aria-label="Choose another game"><ArrowLeft size={16}/>Games</button>
      <strong>{game === 'stars' ? 'Catch the stars' : 'Copy my moves'}</strong>
    </div>
    <div className="play-score">
      <span>{game === 'stars' ? `${caught} / 5 stars` : `Round ${round + 1} / 3`}</span>
      <span className="play-score-stars" aria-hidden="true">{Array.from({length: game === 'stars' ? 5 : 3}, (_, index) => <PixelStar key={index} filled={index < (game === 'stars' ? caught : round + (phase === 'roundDone' ? 1 : 0))}/>)}</span>
    </div>
    <div className={`play-field ${game === 'moves' ? 'play-field-moves' : ''} ${complete ? 'play-field-complete' : ''}`}>
      <div className="play-scene-specks" aria-hidden="true">·&nbsp;&nbsp;&nbsp; + &nbsp;&nbsp; · &nbsp;&nbsp; + &nbsp;&nbsp; ·</div>
      {game === 'stars' && !complete && <div className="play-target-area">
        <button ref={starButton} className={`play-star-target ${cooling ? 'is-resting' : ''}`} style={{left: `${place.x}%`, top: `${place.y}%`}} onClick={catchStar} aria-label={`Catch star ${caught + 1}`} aria-disabled={cooling}><PixelStar/></button>
      </div>}
      {game === 'moves' && <div className="play-move-bubble" aria-live="polite" aria-atomic="true">
        {shownMove ? <><MoveIcon move={shownMove}/><strong>{moveNames[shownMove]}!</strong></> : <span>{complete ? 'You got them all!' : phase === 'watching' ? 'Watch…' : phase === 'playing' ? 'Your turn' : phase === 'roundDone' ? 'You got it!' : 'Ready?'}</span>}
      </div>}
      {game === 'stars' && complete && <div className="play-finish-banner"><PixelStar/><span>Five stars!</span><PixelStar/></div>}
      <img key={reactionId} className={`play-mascot ${reactionId ? `play-reaction-${reaction}` : ''}`} src={spriteSrc} alt={`${name} is playing`} draggable={false}/>
      <div className="play-floor" aria-hidden="true"/>
    </div>
    <div className="play-instructions" role="status" aria-atomic="true">
      {complete ? saveStatus === 'saving' ? 'Saving play time…' : saveStatus === 'error' ? 'Game complete. Play time could not be saved. Try saving again.' : `${name} had fun!` : game === 'stars' ? caught ? `${caught} stars caught. Find the next one!` : 'Tap each star. Take as long as you like.' : notice || `Watch ${name}, then tap the same moves.`}
    </div>
    {game === 'moves' && !complete && <div className="play-moves-controls">
      <div className="play-move-buttons">{(['hop', 'spin', 'wave'] as const).map(move => <button ref={move === 'hop' ? firstMove : undefined} key={move} className="play-move-button" disabled={phase !== 'playing'} onClick={() => copyMove(move)}><MoveIcon move={move}/><span>{moveNames[move]}</span></button>)}</div>
      {phase === 'roundDone' ? <button ref={nextButton} className="primary-button" onClick={() => {setRound(value => value + 1);setPhase('ready');setMoveIndex(0);inputIndex.current = 0;setNotice('');}}>Next round</button> : <button ref={nextButton} className="play-watch-button" onClick={showPattern} disabled={phase === 'watching'}>{phase === 'watching' ? 'Watching…' : phase === 'playing' ? 'Watch again' : 'Show my moves'}{phase === 'playing' && <span>{moveIndex} / {patterns[round].length} copied</span>}</button>}
    </div>}
    {complete && (saveStatus === 'error' ? <button ref={nextButton} className="primary-button" onClick={() => void savePlay()}>Save play time again</button> : <button ref={nextButton} className="primary-button" disabled={saveStatus !== 'saved'} onClick={() => startGame(game)}>{saveStatus === 'saving' ? 'Saving…' : 'Play again'}</button>)}
  </div>;
}

export default PlayGame;
