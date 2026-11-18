import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWords, selectionOptions, grade, createSession } from '../js/game.mjs';

const words = [
  { id: 1, word: 'ba', visibility: 1, course: '1130', module: 2, lesson: 1, syllables: [{text:'ba',tone:'high'}] },
  { id: 2, word: 'aba', visibility: 1, course: '42', module: 2, lesson: 2, syllables: [{text:'a',tone:'low'},{text:'ba',tone:'mid'}] },
  { id: 3, word: 'hidden', visibility: 0, course: '1131', module: 9, lesson: 9, syllables: [{text:'a',tone:'low'}] },
  { id: 4, word: 'da', visibility: 1, course: '1130', module: 3, lesson: 3, syllables: [{text:'da',tone:'low'}] },
];

test('filters visible words across all three levels and sorts alphabetically', () => {
  assert.deepEqual(filterWords(words, {}).map(w => w.id), [2,1,4]);
  assert.deepEqual(filterWords(words, {course:'1130',module:'2',lesson:'1'}).map(w => w.id), [1]);
  assert.deepEqual(filterWords(words, {course:'1131'}), []);
  assert.deepEqual(filterWords(words, {module:'all',lesson:'3'}).map(w => w.id), [4]);
});

test('select options depend on visible words and their parent selections', () => {
  assert.deepEqual(selectionOptions(words, 'course', {}), ['42','1130']);
  assert.deepEqual(selectionOptions(words, 'module', {course:'42'}), ['2']);
  assert.deepEqual(selectionOptions(words, 'lesson', {course:'1130',module:'2'}), ['1']);
});

test('grades all three tones, incomplete answers, and empty syllables', () => {
  assert.deepEqual(grade([{tone:'high'},{tone:'mid'},{tone:'low'}], ['high','low']), [true,false,false]);
  assert.deepEqual(grade(words[1].syllables, ['low','mid']), [true,true]);
  assert.deepEqual(grade([], []), []);
});

test('retry keeps correct syllables, clears wrong ones, and scores a word once', () => {
  const game = createSession(words);
  game.choose(0, 'low');
  game.choose(1, 'high');
  assert.deepEqual(game.submit(), [true,false]);
  assert.deepEqual(game.attempt.choices, ['low',null]);
  assert.equal(game.score, 0);
  game.choose(0, 'high');
  assert.equal(game.attempt.choices[0], 'low');
  game.choose(1, 'mid');
  assert.deepEqual(game.submit(), [true,true]);
  game.submit();
  assert.equal(game.score, 1);
  game.move(1);
  game.move(-1);
  assert.deepEqual(game.attempt.correct, [true,true]);
  assert.equal(game.score, 1);
});

test('navigation is bounded, selection resets scores and descendants, reload starts fresh', () => {
  const game = createSession(words);
  game.move(-1);
  assert.equal(game.index, 0);
  game.choose(0, 'low'); game.choose(1, 'mid'); game.submit();
  game.select('lesson', '2');
  assert.equal(game.score, 0);
  game.select('module', '2');
  assert.equal(game.selection.lesson, 'all');
  game.select('course', '1130');
  assert.deepEqual(game.selection, {course:'1130',module:'all',lesson:'all'});
  game.move(1); game.move(1);
  assert.equal(game.index, 1);
  assert.equal(createSession(words).score, 0);
  game.select('course', 'missing');
  assert.equal(game.current, undefined);
  assert.deepEqual(game.submit(), []);
  assert.equal(game.score, 0);
});
