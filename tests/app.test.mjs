import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM/media double exercises the actual UI handlers without a browser dependency.
function makeDocument() {
  const ids = new Map();
  class Element {
    constructor(tag = '') { this.tag = tag; this.children = []; this.listeners = {}; this.text = ''; this.attributes = {}; this.dataset = {}; this.readyState = 0; this.classList = { remove() {} }; }
    get textContent() { return this.children.length ? this.children.map(c => c.textContent ?? String(c)).join('') : this.text; }
    set textContent(value) { this.children = []; this.text = value; }
    set id(value) { ids.set(value, this); }
    append(...children) { this.children.push(...children.flatMap(c => c.tag === 'fragment' ? c.children : [c])); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    add(child) { this.append(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return key === 'src' ? this.src : this.attributes[key]; }
    removeAttribute(key) { delete this[key]; delete this.attributes[key]; }
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
    async emit(type) { for (const handler of this.listeners[type] ?? []) await handler({ preventDefault() {} }); }
    focus() {}
    querySelector() { return this.children.find(c => c.tag === 'fieldset' && !c.disabled)?.children.find(c => c.tag === 'label')?.children[0]; }
    pause() {}
    load() {}
    async play() { await this.emit('playing'); }
  }
  return {
    getElementById(id) { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); },
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    createTextNode: text => ({ textContent: text }),
  };
}

const words = [
  { id: 1, word: 'aba', translation: 'fixture', visibility: 1, course: '1130', module: 2, lesson: 1, audio: 'aba.mp3', syllables: [{text: 'a', tone: 'low'}, {text: 'ba', tone: 'high'}] },
  { id: 2, word: 'ba', translation: 'fixture', visibility: 1, course: '1130', module: 2, lesson: 1, audio: 'ba.mp3', syllables: [{text: 'ba', tone: 'high'}] },
  { id: 3, word: 'da', translation: 'fixture', visibility: 1, course: '42', module: 2, lesson: 1, audio: null, syllables: [{text: 'da', tone: 'low'}] },
];

test('UI playback and feedback stay consistent through interaction transitions', async t => {
  const originals = { document: globalThis.document, Option: globalThis.Option, fetch: globalThis.fetch };
  t.after(() => Object.assign(globalThis, originals));
  globalThis.document = makeDocument();
  globalThis.Option = class { constructor(text, value) { this.textContent = text; this.value = value; } };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ words }) });
  await import('../js/app.mjs');
  await new Promise(resolve => setImmediate(resolve));
  const $ = id => document.getElementById(id);
  const reset = async () => { $('course').value = 'all'; await $('course').emit('change'); };
  const choose = (index, tone) => $('syllables').children[index].children.find(c => c.tag === 'label' && c.children[0].value === tone).children[0].emit('change');

  await t.test('the play button shows loading and playing itself and never speaks over the recording', async () => {
    await reset();
    assert.equal($('play-label').textContent, 'Play word');
    const play = $('audio').play;
    $('audio').play = async () => { assert.equal($('play').dataset.state, 'loading'); await play.call($('audio')); };
    await $('play').emit('click');
    $('audio').play = play;
    assert.equal($('play').dataset.state, 'playing');
    assert.equal($('play-label').textContent, 'Playing…');
    assert.equal($('audio-status').textContent, '');
    await $('audio').emit('ended');
    assert.equal($('play').dataset.state, '');
    assert.equal($('play-label').textContent, 'Play word');
    await $('audio').emit('error');
    assert.equal($('play-label').textContent, 'Play word');
    assert.match($('audio-status').textContent, /could not load/);
    await $('next').emit('click');
    assert.equal($('audio-status').textContent, '');
    assert.equal($('play').hidden, false);
    assert.equal($('audio-missing').hidden, true);
    await $('next').emit('click');
    assert.equal($('play').hidden, true);
    assert.equal($('audio-missing').hidden, false);
  });

  await t.test('checking with an unanswered syllable asks for it instead of marking it wrong', async () => {
    await reset();
    await choose(0, 'low');
    await $('answer-form').emit('submit');
    assert.match($('feedback').textContent, /Choose a tone for every syllable/);
    assert.equal($('result-0').textContent, 'Ready to check');
    assert.equal($('result-1').textContent, 'Choose a tone');
    assert.equal($('score').textContent, '0 / 3');
  });

  await t.test('returning to a selected tone says ready, not choose a tone', async () => {
    await reset();
    await choose(0, 'low');
    await $('next').emit('click');
    await $('previous').emit('click');
    assert.equal($('result-0').textContent, 'Ready to check');
    assert.equal($('result-1').textContent, 'Choose a tone');
  });

  await t.test('one-syllable success uses singular wording', async () => {
    await reset();
    await $('next').emit('click');
    await choose(0, 'high');
    await $('answer-form').emit('submit');
    assert.match($('feedback').textContent, /^Syllable correct!/);
    assert.equal($('submit').textContent, '✓ Word complete');
    assert.equal($('submit').disabled, true);
    assert.equal($('submit').children[0].attributes['aria-hidden'], 'true');
    assert.equal($('result-0').textContent, '✓ Correct');
    assert.equal($('result-0').children[0].attributes['aria-hidden'], 'true');
  });
});
