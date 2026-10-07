'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {ArrowLeft, ArrowUp, Hand, RotateCw} from 'lucide-react';
import {checkMove, createMovePattern, createStarPlaces, gameLevel, MAX_LEVELS, moveRules, starRules, type Game, type Move} from './game-rules';
import './play-game.css';

export type PlayGameProps = {
  name: string;
  spriteSrc: string;
  gameWins?: {stars: number; moves: number};
  onComplete: (game: Game) => Promise<boolean>;
  onReact: () => void;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type Phase = 'ready' | 'watching' | 'playing' | 'roundDone';
type Session = {
  game: Game;
  stars: ReturnType<typeof starRules>;
  moves: ReturnType<typeof moveRules>;
  places: ReturnType<typeof createStarPlaces>;
  patterns: Move[][];
};
const moveNames: Record<Move, string> = {hop: 'Hop', spin: 'Spin', wave: 'Wave'};
const MoveIcon = ({move}: {move: Move}) => move === 'hop' ? <ArrowUp/> : move === 'spin' ? <RotateCw/> : <Hand/>;

function PixelStar({filled = true}: {filled?: boolean}) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className="play-pixel-star"><path d="M7 1h2v4h2v1h4v3h-3v2h1v4h-3v-2H6v2H3v-4h1V9H1V6h4V5h2z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1}/></svg>;
}

export function PlayGame({name, spriteSrc, gameWins = {stars: 0, moves: 0}, onComplete, onReact}: PlayGameProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [caught, setCaught] = useState(0);
  const [cooling, setCooling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [round, setRound] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [shownMove, setShownMove] = useState<Move | null>(null);
  const [reaction, setReaction] = useState<Move>('hop');
  const [reactionId, setReactionId] = useState(0);
  const [notice, setNotice] = useState('');
  const [stillStars, setStillStars] = useState(false);
  const caughtRef = useRef(0);
  const inputIndex = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const nextTapAt = useRef(0);
  const saving = useRef(false);
  const saved = useRef(false);
  const mounted = useRef(true);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const starButton = useRef<HTMLButtonElement>(null);
  const firstMove = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const reactRef = useRef(onReact);
  reactRef.current = onReact;

  const game = session?.game;
  const complete = !!session && (game === 'stars' ? caught === session.stars.goal : round === session.patterns.length - 1 && phase === 'roundDone');

  function updatePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

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
    if (!session || session.game !== 'moves' || phase !== 'watching') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const spacing = session.moves.cueMs + session.moves.gapMs;
    session.patterns[round].forEach((move, index) => {
      timers.push(setTimeout(() => {
        setShownMove(move);
        setReaction(move);
        setReactionId(id => id + 1);
      }, 350 + index * spacing));
      timers.push(setTimeout(() => setShownMove(null), 350 + index * spacing + session.moves.cueMs));
    });
    timers.push(setTimeout(() => {
      inputIndex.current = 0;
      setMoveIndex(0);
      nextTapAt.current = 0;
      updatePhase('playing');
      setNotice('Your turn! Copy the moves in order.');
    }, 350 + session.patterns[round].length * spacing));
    return () => timers.forEach(clearTimeout);
  }, [session, phase, round]);

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
    saved.current = false;
    setCooling(false);
    setCaught(0);
    setRound(0);
    setMoveIndex(0);
    updatePhase('ready');
    setShownMove(null);
    setReactionId(0);
    setSaveStatus('idle');
    setNotice('');
    if (!nextGame) {
      setSession(null);
      return;
    }
    // Snapshot the rules: saving this win updates the next game, never this round.
    const stars = starRules(gameWins.stars);
    const moves = moveRules(gameWins.moves);
    setSession({game: nextGame, stars, moves, places: createStarPlaces(stars.goal), patterns: moves.lengths.map(length => createMovePattern(length))});
  }

  async function savePlay() {
    if (!session || saving.current || saved.current) return;
    saving.current = true;
    setSaveStatus('saving');
    try {
      const success = await onComplete(session.game);
      saved.current = success;
      if (mounted.current) setSaveStatus(success ? 'saved' : 'error');
    } catch {
      if (mounted.current) setSaveStatus('error');
    } finally {
      saving.current = false;
    }
  }

  function catchStar() {
    if (!session || caughtRef.current >= session.stars.goal || Date.now() < nextTapAt.current || saving.current) return;
    nextTapAt.current = Date.now() + 360;
    setCooling(true);
    cooldownTimer.current = setTimeout(() => setCooling(false), 360);
    const count = ++caughtRef.current;
    setCaught(count);
    animate(count % 3 === 0 ? 'spin' : 'hop');
    if (count === session.stars.goal) void savePlay();
  }

  function showPattern() {
    if (saving.current || phaseRef.current === 'watching') return;
    inputIndex.current = 0;
    setMoveIndex(0);
    setShownMove(null);
    setNotice('Watch the moves.');
    updatePhase('watching');
  }

  function copyMove(move: Move) {
    if (!session || phaseRef.current !== 'playing' || Date.now() < nextTapAt.current) return;
    nextTapAt.current = Date.now() + 280;
    animate(move);
    const result = checkMove(session.patterns[round], inputIndex.current, move);
    if (result === 'retry') {
      inputIndex.current = 0;
      setMoveIndex(0);
      updatePhase('ready');
      setNotice('Let’s watch that pattern again. You can try as often as you like.');
      return;
    }
    inputIndex.current += 1;
    setMoveIndex(inputIndex.current);
    if (result === 'complete') {
      updatePhase('roundDone');
      setNotice(round === session.patterns.length - 1 ? 'All three patterns copied!' : 'You got it!');
      if (round === session.patterns.length - 1) void savePlay();
    } else setNotice('Yes! What comes next?');
  }

  if (!session) return <div className="play-game">
    <div className="play-chooser-mascot" aria-hidden="true"><img src={spriteSrc} alt="" draggable={false}/><span>LET’S PLAY</span></div>
    <div className="play-choices">
      <button ref={firstChoice} className="play-choice" onClick={() => startGame('stars')}><PixelStar/><span><strong>Catch the stars <em>Level {gameLevel('stars', gameWins.stars)}</em></strong><small>Find {starRules(gameWins.stars).goal} stars for {name}.{starRules(gameWins.stars).drift ? ' Now they drift!' : ' Take your time.'}</small></span><span aria-hidden="true">→</span></button>
      <button className="play-choice" onClick={() => startGame('moves')}><Hand/><span><strong>Copy my moves <em>Level {gameLevel('moves', gameWins.moves)}</em></strong><small>Hop, spin and wave. Patterns of up to {Math.max(...moveRules(gameWins.moves).lengths)} moves.</small></span><span aria-hidden="true">→</span></button>
    </div>
    <p className="play-chooser-note">Finish a game to unlock its next level. New stars and moves every time.</p>
  </div>;

  const level = game === 'stars' ? session.stars.level : session.moves.level;
  const maxLevel = MAX_LEVELS[session.game];
  const goal = game === 'stars' ? session.stars.goal : session.patterns.length;
  const progress = game === 'stars' ? caught : round + (phase === 'roundDone' ? 1 : 0);
  const place = session.places[Math.min(caught, session.stars.goal - 1)];
  const nextDescription = game === 'stars'
    ? `${starRules(level).goal} stars${starRules(level).drift > session.stars.drift ? ' with more movement' : ''}`
    : `patterns of up to ${Math.max(...moveRules(level).lengths)} moves, a little quicker`;

  return <div className="play-game">
    <div className="play-toolbar">
      <button className="play-back" onClick={() => startGame(null)} disabled={saveStatus === 'saving'} aria-label="Choose another game"><ArrowLeft size={16}/>Games</button>
      <strong>{game === 'stars' ? 'Catch the stars' : 'Copy my moves'}</strong>
    </div>
    <div className="play-score"><span>{game === 'stars' ? `${caught} / ${goal} stars` : `Round ${round + 1} / ${goal}`}</span><span className="play-level">Level {level} / {maxLevel}</span></div>
    <div className="play-progress" role="progressbar" aria-label={game === 'stars' ? 'Stars caught' : 'Patterns copied'} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={goal}>{Array.from({length: goal}, (_, index) => <span key={index} className={index < progress ? 'is-filled' : ''}/>)}</div>
    <div className={`play-field ${game === 'moves' ? 'play-field-moves' : ''} ${complete ? 'play-field-complete' : ''}`}>
      <div className="play-scene-specks" aria-hidden="true">·&nbsp;&nbsp;&nbsp; + &nbsp;&nbsp; · &nbsp;&nbsp; + &nbsp;&nbsp; ·</div>
      {game === 'stars' && !complete && <div className="play-target-area">
        <div className={`play-star-drift ${session.stars.drift && !stillStars ? 'is-drifting' : ''}`} style={{left: `${place.x}%`, top: `${place.y}%`, '--star-drift': `${session.stars.drift}px`, '--star-speed': `${session.stars.driftSeconds}s`} as CSSProperties}>
          <button ref={starButton} className={`play-star-target ${cooling ? 'is-resting' : ''}`} style={{width: session.stars.targetSize, height: session.stars.targetSize}} onClick={catchStar} aria-label={`Catch star ${caught + 1} of ${goal}`} aria-disabled={cooling}><PixelStar/></button>
        </div>
      </div>}
      {game === 'moves' && <div className="play-move-bubble" aria-live="polite" aria-atomic="true">
        {shownMove ? <><MoveIcon move={shownMove}/><strong>{moveNames[shownMove]}!</strong></> : <span>{complete ? 'You got them all!' : phase === 'watching' ? 'Watch…' : phase === 'playing' ? 'Your turn' : phase === 'roundDone' ? 'You got it!' : `${session.patterns[round].length} move${session.patterns[round].length === 1 ? '' : 's'} to copy`}</span>}
      </div>}
      {game === 'stars' && complete && <div className="play-finish-banner"><PixelStar/><span>{goal} stars!</span><PixelStar/></div>}
      <img key={reactionId} className={`play-mascot ${reactionId ? `play-reaction-${reaction}` : ''}`} src={spriteSrc} alt={`${name} is playing`} draggable={false}/>
      <div className="play-floor" aria-hidden="true"/>
    </div>
    <div className="play-instructions" role="status" aria-atomic="true">
      {complete ? saveStatus === 'saving' ? 'Saving play time…' : saveStatus === 'error' ? 'Game complete. Play time could not be saved. Try saving again.' : `${name} had fun!` : game === 'stars' ? caught ? `${caught} stars caught. Find the next one!` : `Tap each star${session.stars.drift && !stillStars ? ' as it drifts' : ''}. Take as long as you like.` : notice || `Watch ${name}, then tap the same moves.`}
    </div>
    {game === 'stars' && session.stars.drift > 0 && !complete && <button className="play-watch-button" aria-pressed={stillStars} onClick={() => setStillStars(value => !value)}>{stillStars ? 'Let stars drift' : 'Keep stars still'}</button>}
    {game === 'moves' && !complete && <div className="play-moves-controls">
      <div className="play-move-buttons">{(['hop', 'spin', 'wave'] as const).map(move => <button ref={move === 'hop' ? firstMove : undefined} key={move} className="play-move-button" disabled={phase !== 'playing'} onClick={() => copyMove(move)}><MoveIcon move={move}/><span>{moveNames[move]}</span></button>)}</div>
      {phase === 'roundDone' ? <button ref={nextButton} className="primary-button" onClick={() => {setRound(value => value + 1);updatePhase('ready');setMoveIndex(0);inputIndex.current = 0;setNotice('');}}>Next round</button> : <button ref={nextButton} className="play-watch-button" onClick={showPattern} disabled={phase === 'watching'}>{phase === 'watching' ? 'Watching…' : phase === 'playing' ? 'Watch again' : 'Show my moves'}{phase === 'playing' && <span>{moveIndex} / {session.patterns[round].length} copied</span>}</button>}
    </div>}
    {complete && saveStatus === 'saved' && <div className="play-level-unlocked" role="status"><strong>{level < maxLevel ? `Level ${level + 1} unlocked!` : 'Top level complete!'}</strong><span>{level < maxLevel ? `Next: ${nextDescription}.` : 'Play again for a fresh challenge.'}</span></div>}
    {complete && (saveStatus === 'error' ? <button ref={nextButton} className="primary-button" onClick={() => void savePlay()}>Save play time again</button> : <button ref={nextButton} className="primary-button" disabled={saveStatus !== 'saved'} onClick={() => startGame(session.game)}>{saveStatus === 'saving' ? 'Saving…' : level < maxLevel ? `Play level ${level + 1}` : 'Play again'}</button>)}
    {!complete && <p className="play-next-level">{level < maxLevel ? `Finish to unlock level ${level + 1}.` : 'Top level. New challenge every game.'}</p>}
  </div>;
}

export default PlayGame;
