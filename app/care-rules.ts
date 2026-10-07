export type CareActivityKind = 'brush' | 'wash' | 'pat' | 'feed';
export type Point = {x: number; y: number};
export type BrushTravel = {anchor: number; direction: -1 | 0 | 1};

export function careRules(rawLevel: number) {
  const level = Number.isFinite(rawLevel) ? Math.min(5, Math.max(1, Math.floor(rawLevel))) : 1;
  return {
    level,
    brushStrokes: 10 + level * 2,
    washSpots: Math.min(9, 5 + level),
    rinseStrokes: 4,
    pats: 5 + level,
    bites: 6 + Math.floor((level - 1) / 2),
    beatWidth: .46 - (level - 1) * .035,
    beatPeriod: 2700 - (level - 1) * 150,
  };
}

// Normalized travel makes a stroke equally achievable on a phone and an iPad.
// Continuing in one direction never earns extra strokes: the brush must return.
export function brushTravel(previous: BrushTravel, rawX: number, threshold = .2): {travel: BrushTravel; stroke: boolean} {
  const x = Math.min(1, Math.max(0, rawX));
  const distance = x - previous.anchor;
  const direction = Math.sign(distance) as -1 | 0 | 1;
  if (direction === previous.direction && direction !== 0) return {travel: {anchor: x, direction}, stroke: false};
  if (Math.abs(distance) < threshold) return {travel: previous, stroke: false};
  return {travel: {anchor: x, direction}, stroke: true};
}

export function rhythmPosition(elapsedMs: number, periodMs: number): number {
  const phase = ((Math.max(0, elapsedMs) % periodMs) / periodMs) * 2;
  return phase <= 1 ? phase : 2 - phase;
}

export function rhythmHit(position: number, width: number): boolean {
  return Number.isFinite(position) && Math.abs(position - .5) <= width / 2;
}

export function rhythmBeatId(elapsedMs: number, periodMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / (periodMs / 2));
}

export function rhythmCanFeed(elapsedMs: number, periodMs: number, width: number, lastSuccessfulBeat: number | null): boolean {
  return rhythmBeatId(elapsedMs, periodMs) !== lastSuccessfulBeat && rhythmHit(rhythmPosition(elapsedMs, periodMs), width);
}

// Include the whole finger path, so a fast stroke cannot jump over a soap spot.
export function touchesSpot(from: Point, to: Point, spot: Point, radius = .09): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  if (length < .0004) return false;
  const projection = Math.max(0, Math.min(1, ((spot.x - from.x) * dx + (spot.y - from.y) * dy) / length));
  return Math.hypot(spot.x - (from.x + projection * dx), spot.y - (from.y + projection * dy)) <= radius;
}

export const SOAP_SPOTS: readonly Point[] = [
  {x: .35, y: .32}, {x: .5, y: .27}, {x: .65, y: .32},
  {x: .35, y: .57}, {x: .5, y: .65}, {x: .65, y: .57},
  {x: .28, y: .45}, {x: .5, y: .46}, {x: .72, y: .45},
];
