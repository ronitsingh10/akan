import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { filterWords, createSession } from '../js/game.mjs';

const data = JSON.parse(await readFile(new URL('../data/words.json', import.meta.url), 'utf8'));

test('shipped data contains only game fields and usable syllables', () => {
  assert.deepEqual(Object.keys(data), ['words']);
  assert.ok(data.words.length > 0);
  assert.equal(new Set(data.words.map(word => word.id)).size, data.words.length);
  for (const word of data.words) {
    assert.deepEqual(Object.keys(word).sort(), ['audio', 'course', 'id', 'image', 'lesson', 'module', 'syllables', 'translation', 'visibility', 'word']);
    assert.ok(word.syllables.length > 0);
    assert.doesNotMatch(word.word + word.translation, /&#(?:\d+|x[\da-f]+);/i);
    for (const syllable of word.syllables) {
      assert.deepEqual(Object.keys(syllable).sort(), ['id', 'ordering', 'text', 'tone']);
      assert.ok(['high', 'mid', 'low'].includes(syllable.tone));
      assert.ok(syllable.text);
    }
  }
});

test('every generated media reference exists in the static deliverable', async () => {
  const paths = new Set(data.words.flatMap(word => [word.image, word.audio]).filter(Boolean));
  for (const path of paths) {
    assert.match(path, /^media\/(images|sounds)\/[^/]+$/);
    const file = await stat(new URL(`../${path}`, import.meta.url));
    assert.ok(file.isFile() && file.size > 0, path);
  }
});

test('all visible words can be graded and each contributes to the score once', () => {
  const game = createSession(data.words);
  const visible = filterWords(data.words);
  assert.equal(game.words.length, visible.length);
  for (let index = 0; index < visible.length; index++) {
    assert.equal(game.current.visibility, 1);
    game.current.syllables.forEach((syllable, i) => game.choose(i, syllable.tone));
    assert.ok(game.submit().every(Boolean));
    assert.equal(game.score, index + 1);
    game.move(1);
  }
  game.submit();
  assert.equal(game.score, visible.length);
});
