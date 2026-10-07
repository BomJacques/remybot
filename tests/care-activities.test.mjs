import test from 'node:test';
import assert from 'node:assert/strict';
import {brushTravel, careRules, rhythmBeatId, rhythmCanFeed, rhythmHit, rhythmPosition, SOAP_SPOTS, touchesSpot} from '../app/care-rules.ts';

test('care levels gradually grow and remain bounded', () => {
  const first = careRules(1);
  const last = careRules(99);
  assert.equal(first.brushStrokes, 12);
  assert.equal(last.brushStrokes, 20);
  assert.equal(first.bites, 6);
  assert.equal(last.bites, 8);
  assert.equal(last.washSpots, 9);
  assert.equal(last.pats, 10);
  assert.equal(first.level, careRules(Number.NaN).level);
  assert.equal(careRules(-10).level, 1);
  assert.ok(last.beatWidth >= .3);
  assert.equal(new Set(SOAP_SPOTS.map(spot => `${spot.x},${spot.y}`)).size, SOAP_SPOTS.length);
});

test('brushing requires real travel and a reversal for the next stroke', () => {
  let travel = {anchor: .1, direction: 0};
  let result = brushTravel(travel, .15);
  assert.equal(result.stroke, false);
  result = brushTravel(result.travel, .35);
  assert.equal(result.stroke, true);
  result = brushTravel(result.travel, .8);
  assert.equal(result.stroke, false, 'continuing right cannot count another stroke');
  result = brushTravel(result.travel, .7);
  assert.equal(result.stroke, false, 'small reversal does not count');
  result = brushTravel(result.travel, .5);
  assert.equal(result.stroke, true, 'full return stroke counts');
  result = brushTravel(result.travel, .2);
  assert.equal(result.stroke, false);
  assert.equal(brushTravel(result.travel, .5).stroke, true);
});

test('rhythm repeats both directions and only counts the broad middle zone', () => {
  const rules = careRules(5);
  assert.equal(rhythmPosition(0, 2000), 0);
  assert.equal(rhythmPosition(500, 2000), .5);
  assert.equal(rhythmPosition(1000, 2000), 1);
  assert.equal(rhythmPosition(1500, 2000), .5);
  assert.equal(rhythmPosition(2500, 2000), .5);
  assert.equal(rhythmHit(.5, rules.beatWidth), true);
  assert.equal(rhythmHit(.1, rules.beatWidth), false);
  assert.equal(rhythmHit(.9, rules.beatWidth), false);
  assert.equal(rhythmHit(Number.NaN, rules.beatWidth), false);
});

test('washing includes the swept finger path, but a still finger does not scrub', () => {
  const spot = {x: .5, y: .5};
  assert.equal(touchesSpot({x: .1, y: .5}, {x: .9, y: .5}, spot), true);
  assert.equal(touchesSpot(spot, spot, spot), false);
  assert.equal(touchesSpot(spot, {x: .501, y: .501}, spot), false);
  assert.equal(touchesSpot({x: .1, y: .1}, {x: .9, y: .1}, spot), false);
});

test('feeding awards at most one bite in each crossing, even after the tap cooldown', () => {
  const {beatPeriod, beatWidth} = careRules(1);
  const earlyHit = 410;
  const laterHit = 850;
  assert.equal(rhythmCanFeed(earlyHit, beatPeriod, beatWidth, null), true);
  const usedBeat = rhythmBeatId(earlyHit, beatPeriod);
  assert.equal(rhythmHit(rhythmPosition(laterHit, beatPeriod), beatWidth), true, 'the second tap is still in the wide zone');
  assert.equal(rhythmCanFeed(laterHit, beatPeriod, beatWidth, usedBeat), false, 'a second bite in the same pass cannot be awarded');
  assert.equal(rhythmCanFeed(beatPeriod * .75, beatPeriod, beatWidth, usedBeat), true, 'the return crossing allows the next bite');
  assert.equal(rhythmCanFeed(0, beatPeriod, beatWidth, null), false, 'missed beats award nothing');
  assert.equal(rhythmCanFeed(earlyHit * 1.75, beatPeriod * 1.75, beatWidth, null), true, 'changing pace can start a fresh beat session');
});
