import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eggs} from '../app/eggs.ts';
import {adventures, keepsakes} from '../app/adventure-content.ts';
import {FAMILY_COUNT, preferences} from '../app/engine.ts';

const lore = JSON.parse(await readFile(new URL('../app/lore.json', import.meta.url), 'utf8'));
const foodIds = ['meal', 'snack', 'treat'];

test('every selectable family has matching story and food data at its saved index', () => {
  assert.equal(eggs.length, FAMILY_COUNT);
  assert.equal(lore.length, FAMILY_COUNT);
  assert.equal(adventures.length, FAMILY_COUNT);
  assert.equal(new Set(eggs.map(egg => egg.id)).size, FAMILY_COUNT);
  for (const [index, egg] of eggs.entries()) {
    assert.match(egg.id, /^[a-z]+$/);
    assert.match(egg.color, /^#[a-f\d]{6}$/i);
    for (const field of ['name', 'tag', 'story', 'hint']) assert.ok(egg[field].trim(), `${egg.id} has ${field}`);
    assert.ok(lore[index].title.startsWith(`${egg.name} and `), `${egg.name} lore uses the same saved index`);
    assert.ok(lore[index].story.includes(`I’m ${egg.name}`), `${egg.name} introduces itself after hatching`);
    assert.ok(lore[index].quirk.trim());
    assert.deepEqual(Object.keys(lore[index]).sort(), ['title', 'story', 'quirk', 'likes', 'dislikes', 'careHints'].sort());
    assert.ok(foodIds.includes(lore[index].likes));
    assert.ok(foodIds.includes(lore[index].dislikes));
    assert.notEqual(lore[index].likes, lore[index].dislikes);
    assert.equal(lore[index].likes, preferences[index].likes);
    assert.equal(lore[index].dislikes, preferences[index].dislikes);
    assert.equal(lore[index].careHints.length, 2);
    assert.ok(lore[index].careHints.every(hint => typeof hint === 'string' && hint.trim().length > 0));
  }
});

test('all families have five complete chapters with two supported keepsake choices each', () => {
  assert.equal(new Set(adventures.map(adventure => adventure.title)).size, FAMILY_COUNT);
  for (const [index, adventure] of adventures.entries()) {
    assert.equal(adventure.chapters.length, 5, eggs[index].name);
    assert.equal(new Set(adventure.chapters.map(chapter => chapter.title)).size, 5);
    for (const [chapterIndex, chapter] of adventure.chapters.entries()) {
      for (const field of ['title', 'prompt', 'discovery']) assert.ok(chapter[field].trim(), `${eggs[index].name} chapter ${chapterIndex + 1} ${field}`);
      assert.ok(`${chapter.prompt} ${chapter.discovery}`.includes(eggs[index].name), `${eggs[index].name} chapter belongs to its family`);
      assert.equal(keepsakes.filter(item => item.chapter === chapterIndex).length, 2);
    }
  }
});

test('the four new care guides include a concrete real-world chore', () => {
  for (const index of [8, 9, 10, 11]) {
    assert.match(lore[index].careHints.join(' '), /put your shoes|empty your lunch box|brush your own teeth/i, eggs[index].name);
  }
});
