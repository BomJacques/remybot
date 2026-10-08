import {gameLevel} from './game-rules.ts';

export type SnakeDirection = 'up' | 'right' | 'down' | 'left';
export type SnakeCell = {x: number; y: number};
export type SnakeRules = ReturnType<typeof snakeRules>;
export type SnakeState = {
  body: SnakeCell[];
  direction: SnakeDirection;
  queued: SnakeDirection | null;
  apple: SnakeCell | null;
  score: number;
  status: 'running' | 'won' | 'bumped';
};
type Random = () => number;
const opposite: Record<SnakeDirection, SnakeDirection> = {up: 'down', down: 'up', left: 'right', right: 'left'};
const offsets: Record<SnakeDirection, SnakeCell> = {up: {x: 0, y: -1}, right: {x: 1, y: 0}, down: {x: 0, y: 1}, left: {x: -1, y: 0}};
export const sameCell = (a: SnakeCell, b: SnakeCell) => a.x === b.x && a.y === b.y;

export function snakeRules(wins = 0) {
  const level = gameLevel('snake', wins);
  return {level, goal: 4 + level, columns: 12, rows: 12, stepMs: 440 - (level - 1) * 35};
}

/** Choose from the empty cells directly, so even a nearly full board cannot loop. */
export function placeSnakeApple(body: readonly SnakeCell[], columns: number, rows: number, random: Random = Math.random): SnakeCell | null {
  const occupied = new Set(body.map(cell => `${cell.x},${cell.y}`));
  const available: SnakeCell[] = [];
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
    if (!occupied.has(`${x},${y}`)) available.push({x, y});
  }
  if (!available.length) return null;
  const value = random();
  const unit = Number.isFinite(value) ? Math.min(.999999999, Math.max(0, value)) : 0;
  return available[Math.floor(unit * available.length)];
}

export function createSnake(rules: SnakeRules): SnakeState {
  const y = Math.floor(rules.rows / 2);
  const x = Math.floor(rules.columns / 3);
  return {
    body: [{x, y}, {x: x - 1, y}, {x: x - 2, y}],
    direction: 'right', queued: null,
    // A visible first snack straight ahead makes the first few seconds easy to learn.
    apple: {x: Math.min(rules.columns - 1, x + 3), y},
    score: 0, status: 'running',
  };
}

/** Accept one turn per movement step; fast double taps cannot reverse into the neck. */
export function turnSnake(state: SnakeState, direction: SnakeDirection): SnakeState {
  if (state.status !== 'running' || state.queued || direction === state.direction || direction === opposite[state.direction]) return state;
  return {...state, queued: direction};
}

export function stepSnake(state: SnakeState, rules: SnakeRules, random: Random = Math.random): SnakeState {
  if (state.status !== 'running') return state;
  const direction = state.queued ?? state.direction;
  const delta = offsets[direction];
  const head = {x: (state.body[0].x + delta.x + rules.columns) % rules.columns, y: (state.body[0].y + delta.y + rules.rows) % rules.rows};
  const eating = !!state.apple && sameCell(head, state.apple);
  // The tail vacates its cell on an ordinary move, so moving into it is legal.
  const occupied = eating ? state.body : state.body.slice(0, -1);
  if (occupied.some(cell => sameCell(cell, head))) return {...state, direction, queued: null, status: 'bumped'};
  const body = [head, ...state.body];
  if (!eating) body.pop();
  const score = state.score + (eating ? 1 : 0);
  const apple = eating ? placeSnakeApple(body, rules.columns, rules.rows, random) : state.apple;
  const won = score >= rules.goal || apple === null;
  return {body, direction, queued: null, score, apple: won ? null : apple, status: won ? 'won' : 'running'};
}
