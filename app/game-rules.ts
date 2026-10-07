export type Game = 'stars' | 'moves';
export type Move = 'hop' | 'spin' | 'wave';
export type StarPlace = {x: number; y: number};
type Random = () => number;

export const MAX_LEVELS: Record<Game, number> = {stars: 8, moves: 6};

export function gameLevel(game: Game, wins = 0): number {
  const completed = Number.isFinite(wins) ? Math.max(0, Math.floor(wins)) : 0;
  return Math.min(MAX_LEVELS[game], completed + 1);
}

export function starRules(wins = 0) {
  const level = gameLevel('stars', wins);
  return {
    level,
    goal: 4 + level,
    targetSize: level < 4 ? 72 : level < 7 ? 66 : 60,
    drift: level < 3 ? 0 : level < 5 ? 8 : level < 7 ? 12 : 16,
    driftSeconds: Math.max(2.8, 5.6 - level * 0.35),
  };
}

export function moveRules(wins = 0) {
  const level = gameLevel('moves', wins);
  const lengths = [[1, 2, 3], [2, 3, 3], [2, 3, 4], [3, 4, 5], [3, 5, 6], [4, 5, 6]][level - 1];
  return {level, lengths: [...lengths], cueMs: 1050 - (level - 1) * 50, gapMs: 300};
}

function randomUnit(random: Random): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
}

export function createStarPlaces(count: number, random: Random = Math.random): StarPlace[] {
  const places: StarPlace[] = [];
  for (let index = 0; index < Math.min(12, Math.max(0, Math.floor(count))); index += 1) {
    let next = {x: 16 + randomUnit(random) * 68, y: 15 + randomUnit(random) * 70};
    const previous = places.at(-1);
    // Move the next star well clear of the previous tap, even with an unlucky random draw.
    if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < 36) {
      next = {x: previous.x < 50 ? 84 : 16, y: previous.y < 50 ? 85 : 15};
    }
    places.push(next);
  }
  return places;
}

export function createMovePattern(length: number, random: Random = Math.random): Move[] {
  const pattern: Move[] = [];
  const moves: Move[] = ['hop', 'spin', 'wave'];
  for (let index = 0; index < Math.min(6, Math.max(0, Math.floor(length))); index += 1) {
    // Distinct consecutive cues make each move readable, including without animation.
    const choices = moves.filter(move => move !== pattern.at(-1));
    pattern.push(choices[Math.floor(randomUnit(random) * choices.length)]);
  }
  return pattern;
}

export function checkMove(pattern: readonly Move[], index: number, move: Move): 'retry' | 'next' | 'complete' {
  if (index < 0 || index >= pattern.length || pattern[index] !== move) return 'retry';
  return index + 1 === pattern.length ? 'complete' : 'next';
}
