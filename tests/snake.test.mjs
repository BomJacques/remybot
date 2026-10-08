import test from 'node:test';
import assert from 'node:assert/strict';
import {gameLevel, MAX_LEVELS} from '../app/game-rules.ts';
import {createSnake, placeSnakeApple, snakeRules, stepSnake, turnSnake} from '../app/snake-rules.ts';

const rules = snakeRules();
const state = (body, direction = 'right', apple = {x: 10, y: 10}) => ({body, direction, queued: null, apple, score: 0, status: 'running'});

test('snake levels increase the target and speed within child-friendly bounds', () => {
  assert.equal(gameLevel('snake'), 1);
  assert.equal(MAX_LEVELS.snake, 6);
  assert.equal(rules.goal, 5);
  for (let wins = 0; wins < 100; wins += 1) {
    const current = snakeRules(wins), next = snakeRules(wins + 1);
    assert.ok(next.goal >= current.goal && next.goal <= 10);
    assert.ok(next.stepMs <= current.stepMs && next.stepMs >= 265);
    assert.equal(current.columns, 12);
    assert.equal(current.rows, 12);
  }
  for (const invalid of [-1, NaN, Infinity]) assert.deepEqual(snakeRules(invalid), rules);
  assert.equal(snakeRules(5).goal, 10);
  assert.equal(snakeRules(999).level, 6);
});

test('first apple is a few safe steps straight ahead and a snack grows the snake once', () => {
  let snake = createSnake(rules);
  const original = structuredClone(snake);
  assert.equal(snake.body.length, 3);
  snake = stepSnake(snake, rules, () => 0);
  snake = stepSnake(snake, rules, () => 0);
  assert.equal(snake.score, 0);
  snake = stepSnake(snake, rules, () => 0);
  assert.equal(snake.score, 1);
  assert.equal(snake.body.length, 4);
  assert.deepEqual(createSnake(rules), original, 'Rules and initial state are not mutated');
  assert.ok(!snake.body.some(cell => cell.x === snake.apple.x && cell.y === snake.apple.y));
});

test('all four edges wrap without ending the round', () => {
  const cases = [
    [{x: 11, y: 4}, 'right', {x: 0, y: 4}],
    [{x: 0, y: 4}, 'left', {x: 11, y: 4}],
    [{x: 4, y: 0}, 'up', {x: 4, y: 11}],
    [{x: 4, y: 11}, 'down', {x: 4, y: 0}],
  ];
  for (const [head, direction, destination] of cases) {
    const next = stepSnake(state([head], direction), rules);
    assert.deepEqual(next.body[0], destination);
    assert.equal(next.status, 'running');
  }
});

test('opposite turns and rapid extra turns are ignored until the next movement step', () => {
  const snake = createSnake(rules);
  assert.equal(turnSnake(snake, 'left'), snake);
  assert.equal(turnSnake(snake, 'right'), snake);
  const up = turnSnake(snake, 'up');
  assert.equal(up.queued, 'up');
  assert.equal(turnSnake(up, 'left'), up, 'Cannot queue up then left before moving');
  assert.equal(turnSnake(up, 'down'), up);
  const moved = stepSnake(up, rules);
  assert.equal(moved.direction, 'up');
  assert.equal(moved.queued, null);
  assert.equal(turnSnake(moved, 'left').queued, 'left');
  assert.equal(snake.queued, null, 'Input does not mutate prior snapshots');
});

test('self collision ends this round without changing score or advancing into the body', () => {
  const snake = state([{x: 4, y: 4}, {x: 4, y: 5}, {x: 5, y: 5}, {x: 5, y: 4}, {x: 6, y: 4}]);
  const bumped = stepSnake(snake, rules);
  assert.equal(bumped.status, 'bumped');
  assert.equal(bumped.score, 0);
  assert.deepEqual(bumped.body, snake.body);
  assert.equal(stepSnake(bumped, rules), bumped);
  assert.equal(turnSnake(bumped, 'up'), bumped);
});

test('moving into the departing tail is legal, but eating there cannot vacate it', () => {
  const body = [{x: 4, y: 4}, {x: 4, y: 5}, {x: 5, y: 5}, {x: 5, y: 4}];
  const moved = stepSnake(state(body), rules);
  assert.equal(moved.status, 'running');
  assert.deepEqual(moved.body[0], {x: 5, y: 4});
  assert.equal(moved.body.length, body.length);
  const impossibleApple = stepSnake(state(body, 'right', {x: 5, y: 4}), rules);
  assert.equal(impossibleApple.status, 'bumped');
});

test('apple placement never chooses occupied cells and handles a full board without looping', () => {
  const almostFull = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}];
  for (const number of [0, .5, 1, -1, NaN, Infinity]) {
    assert.deepEqual(placeSnakeApple(almostFull, 2, 2, () => number), {x: 1, y: 1});
  }
  assert.equal(placeSnakeApple([...almostFull, {x: 1, y: 1}], 2, 2), null);
  assert.deepEqual(placeSnakeApple([], 2, 2, () => 0), {x: 0, y: 0});
  assert.deepEqual(placeSnakeApple([], 2, 2, () => 1), {x: 1, y: 1});
});

test('the target wins once and terminal states cannot collect more snacks', () => {
  const snake = {...state([{x: 4, y: 4}, {x: 3, y: 4}], 'right', {x: 5, y: 4}), score: rules.goal - 1};
  const won = stepSnake(snake, rules);
  assert.equal(won.status, 'won');
  assert.equal(won.score, rules.goal);
  assert.equal(won.apple, null);
  assert.equal(stepSnake(won, rules), won);
  assert.equal(turnSnake(won, 'up'), won);
});

test('filling the final empty cell completes the game even if the target was oversized', () => {
  const tinyRules = {...rules, columns: 2, rows: 2, goal: 10};
  const snake = state([{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}], 'right', {x: 1, y: 0});
  const next = stepSnake(snake, tinyRules);
  assert.equal(next.body.length, 4);
  assert.equal(next.apple, null);
  assert.equal(next.status, 'won');
});
