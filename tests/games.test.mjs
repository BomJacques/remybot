import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMove, createMovePattern, createStarPlaces, gameLevel, MAX_LEVELS, moveRules, starRules} from '../app/game-rules.ts';

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('each game advances independently from an easy first level and stops at its cap', () => {
  assert.equal(gameLevel('stars'), 1);
  assert.equal(gameLevel('moves'), 1);
  for (const game of ['stars', 'moves']) {
    assert.equal(gameLevel(game, 1), 2);
    assert.equal(gameLevel(game, 10000), MAX_LEVELS[game]);
    for (const invalid of [-20, NaN, Infinity]) assert.equal(gameLevel(game, invalid), 1);
  }
  assert.equal(gameLevel('stars', 7), 8);
  assert.equal(gameLevel('moves', 0), 1);
});

test('star difficulty grows without imposing a timer or tiny touch targets', () => {
  const beginner = starRules(0);
  assert.equal(beginner.goal, 5);
  assert.equal(beginner.drift, 0);
  const advanced = starRules(7);
  assert.equal(advanced.goal, 12);
  assert.ok(advanced.drift > 0);
  for (let wins = 0; wins < 30; wins += 1) {
    const current = starRules(wins), next = starRules(wins + 1);
    assert.ok(current.targetSize >= 56, 'Targets stay usable on a touch screen');
    assert.ok(next.goal >= current.goal && next.goal <= 12);
    assert.ok(next.drift >= current.drift && next.drift <= 16);
    assert.ok(current.driftSeconds >= 2.8);
    assert.equal('timeLimit' in current, false);
  }
});

test('memory sequences get longer and cues get quicker within comfortable bounds', () => {
  assert.deepEqual(moveRules(0).lengths, [1, 2, 3]);
  assert.equal(Math.max(...moveRules(5).lengths), 6);
  assert.ok(moveRules(5).cueMs < moveRules(0).cueMs);
  for (let wins = 0; wins < 20; wins += 1) {
    const current = moveRules(wins), next = moveRules(wins + 1);
    assert.equal(current.lengths.length, 3);
    assert.ok(current.lengths.every(length => length >= 1 && length <= 6));
    assert.ok(current.cueMs >= 800 && current.gapMs >= 250);
    assert.ok(next.lengths.every((length, index) => length >= current.lengths[index]));
  }
  const snapshot = moveRules(0);
  snapshot.lengths[0] = 99;
  assert.deepEqual(moveRules(0).lengths, [1, 2, 3], 'One session must not mutate the rules for later games');
});

test('random stars stay in reach and each moves clear of the last tap', () => {
  for (const random of [seededRandom(7), () => 0, () => 0.5, () => 1, () => NaN]) {
    const places = createStarPlaces(12, random);
    assert.equal(places.length, 12);
    places.forEach((place, index) => {
      assert.ok(place.x >= 16 && place.x <= 84);
      assert.ok(place.y >= 15 && place.y <= 85);
      if (index) assert.ok(Math.hypot(place.x - places[index - 1].x, place.y - places[index - 1].y) >= 36);
    });
  }
  assert.notDeepEqual(createStarPlaces(8, seededRandom(1)), createStarPlaces(8, seededRandom(2)));
});

test('fresh memory patterns vary and every cue is distinguishable from its neighbour', () => {
  const patterns = new Set();
  const random = seededRandom(8);
  for (let game = 0; game < 20; game += 1) {
    const pattern = createMovePattern(6, random);
    assert.equal(pattern.length, 6);
    pattern.forEach((move, index) => {
      assert.ok(['hop', 'spin', 'wave'].includes(move));
      if (index) assert.notEqual(move, pattern[index - 1]);
    });
    patterns.add(pattern.join(','));
  }
  assert.ok(patterns.size > 8, 'New rounds should not replay a fixed list');
  for (const value of [0, 1, -1, NaN]) assert.equal(createMovePattern(6, () => value).length, 6);
});

test('copying must match the whole sequence and retry leaves the challenge intact', () => {
  const pattern = Object.freeze(['wave', 'spin', 'hop']);
  assert.equal(checkMove(pattern, 0, 'wave'), 'next');
  assert.equal(checkMove(pattern, 1, 'hop'), 'retry');
  assert.deepEqual(pattern, ['wave', 'spin', 'hop']);
  assert.equal(checkMove(pattern, 0, 'wave'), 'next');
  assert.equal(checkMove(pattern, 1, 'spin'), 'next');
  assert.equal(checkMove(pattern, 2, 'hop'), 'complete');
  assert.equal(checkMove(pattern, 3, 'hop'), 'retry');
  assert.equal(checkMove(pattern, -1, 'wave'), 'retry');
  assert.equal(checkMove([], 0, 'hop'), 'retry');
});
