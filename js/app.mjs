import { createSession, selectionOptions, TONES } from './game.mjs';

const $ = id => document.getElementById(id);
const selectors = ['course', 'module', 'lesson'];
const audio = $('audio');
const placeholderImage = 'media/images/placeholder.jpg';
let words = [];
let game;
let audioVersion = 0;

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// Screen readers skip the symbol and read only the words.
function withSymbol(element, symbol, text, symbolFirst = true) {
  const icon = textElement('span', symbol);
  icon.setAttribute('aria-hidden', 'true');
  element.replaceChildren(...(symbolFirst ? [icon, ` ${text}`] : [`${text} `, icon]));
}

function courseName(course) {
  return course === '42' ? 'Trial' : `AKAN ${course}`;
}

function renderSelectors() {
  for (const level of selectors) {
    const select = $(level);
    select.replaceChildren(new Option(`All ${level}s`, 'all'));
    for (const value of selectionOptions(words, level, game.selection)) {
      select.add(new Option(level === 'course' ? courseName(value) : `${level[0].toUpperCase()}${level.slice(1)} ${value}`, value));
    }
    select.value = game.selection[level];
    select.disabled = false;
  }
}

function renderSyllables() {
  const fragment = document.createDocumentFragment();
  const attempt = game.attempt;
  game.current.syllables.forEach((syllable, index) => {
    const fieldset = document.createElement('fieldset');
    const result = attempt.correct[index];
    fieldset.className = `syllable${result === true ? ' correct' : result === false ? ' incorrect' : ''}`;
    fieldset.disabled = result === true;
    const legend = document.createElement('legend');
    legend.append(textElement('span', `Syllable ${index + 1}: `, 'sr-only'));
    const syllableText = textElement('span', syllable.text);
    syllableText.lang = 'ak';
    legend.append(syllableText);
    fieldset.append(legend);
    for (const tone of TONES) {
      const label = document.createElement('label');
      label.className = 'tone-choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `syllable-${index}`;
      input.value = tone;
      input.checked = attempt.choices[index] === tone;
      input.setAttribute('aria-describedby', `result-${index}`);
      input.addEventListener('change', () => {
        game.choose(index, tone);
        fieldset.classList.remove('incorrect');
        $(`result-${index}`).textContent = 'Ready to check';
      });
      label.append(input, document.createTextNode(tone[0].toUpperCase() + tone.slice(1)));
      fieldset.append(label);
    }
    const status = textElement('p', attempt.choices[index] ? 'Ready to check' : 'Choose a tone', 'syllable-result');
    if (result === true) withSymbol(status, '✓', 'Correct');
    else if (result === false) withSymbol(status, '×', 'Try again');
    status.id = `result-${index}`;
    fieldset.append(status);
    fragment.append(fieldset);
  });
  $('syllables').replaceChildren(fragment);
  const complete = attempt.correct.length > 0 && attempt.correct.every(value => value === true);
  $('submit').disabled = complete;
  if (complete) withSymbol($('submit'), '✓', 'Word complete');
  else withSymbol($('submit'), '→', 'Check answer', false);
}

function stopAudio() {
  audioVersion++;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  $('play-label').textContent = 'Play word';
  $('audio-status').textContent = '';
}

function renderWord() {
  stopAudio();
  const word = game.current;
  $('game').hidden = !word;
  $('empty-state').hidden = Boolean(word);
  if (!word) return;
  $('word').textContent = word.word;
  $('translation').textContent = word.translation;
  $('word-context').textContent = `${courseName(word.course)} · Module ${word.module} · Lesson ${word.lesson}`;
  $('position').textContent = `Word ${game.index + 1} of ${game.words.length}`;
  $('score').textContent = `${game.score} / ${game.words.length}`;
  $('previous').disabled = game.index === 0;
  $('next').disabled = game.index === game.words.length - 1;
  const image = $('word-image');
  image.hidden = false;
  image.alt = word.image ? word.translation : '';
  image.src = word.image ?? placeholderImage;
  $('play').disabled = !word.audio;
  if (word.audio) audio.src = word.audio;
  else $('play-label').textContent = 'Audio unavailable';
  renderSyllables();
  const complete = game.attempt.correct.every(value => value === true);
  $('feedback').className = `feedback${complete ? ' success' : ''}`;
  $('feedback').textContent = complete ? 'You have completed this word. Keep practising with another.' : 'Take your time. You can try as often as you like.';
}

for (const level of selectors) {
  $(level).addEventListener('change', () => {
    game.select(level, $(level).value);
    renderSelectors();
    renderWord();
    $('load-status').textContent = `${game.words.length} ${game.words.length === 1 ? 'word' : 'words'} in your new practice set. Score reset to zero.`;
  });
}

for (const [id, direction] of [['previous', -1], ['next', 1]]) {
  $(id).addEventListener('click', () => {
    game.move(direction);
    renderWord();
    $('word').focus();
  });
}

$('answer-form').addEventListener('submit', event => {
  event.preventDefault();
  const results = game.submit();
  renderSyllables();
  $('score').textContent = `${game.score} / ${game.words.length}`;
  const correct = results.filter(Boolean).length;
  const complete = correct === results.length;
  $('feedback').className = `feedback${complete ? ' success' : ''}`;
  const syllableCount = results.length === 1 ? 'syllable' : 'syllables';
  const wordCount = game.words.length === 1 ? 'word' : 'words';
  $('feedback').textContent = complete
    ? (game.score === game.words.length ? `Practice set complete! ${game.score} of ${game.words.length} ${wordCount} correct.` : `${results.length === 1 ? 'Syllable correct!' : `All ${results.length} syllables correct!`} ${game.score} of ${game.words.length} ${wordCount} complete.`)
    : `${correct} of ${results.length} ${syllableCount} correct. ${results.length - correct === 1 ? 'Try the marked syllable again.' : 'Try the marked syllables again.'}`;
  if (!complete) $('syllables').querySelector('fieldset:not(:disabled) input').focus();
  else if (!$('next').disabled) $('next').focus();
  else $('word').focus();
});

$('play').addEventListener('click', async () => {
  if (!game.current.audio) return;
  const version = audioVersion;
  $('audio-status').textContent = '';
  try {
    if (audio.error) audio.load();
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    if (version !== audioVersion || error.name === 'AbortError') return;
    $('audio-status').textContent = 'The recording could not play. Please try again.';
    $('play-label').textContent = 'Play word';
  }
});
audio.addEventListener('playing', () => {
  $('play-label').textContent = 'Replay word';
  $('audio-status').textContent = 'Playing…';
});
audio.addEventListener('ended', () => { $('audio-status').textContent = ''; });
audio.addEventListener('pause', () => {
  if ($('audio-status').textContent === 'Playing…') $('audio-status').textContent = '';
});
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  $('audio-status').textContent = 'The recording could not load. Please try again.';
  $('play-label').textContent = 'Play word';
});
$('word-image').addEventListener('error', () => {
  const image = $('word-image');
  if (image.getAttribute('src') === placeholderImage) image.hidden = true;
  else {
    image.alt = '';
    image.src = placeholderImage;
  }
});

async function start() {
  try {
    const response = await fetch(new URL('../data/words.json', import.meta.url));
    if (!response.ok) throw new Error('Word data unavailable');
    const data = await response.json();
    if (!Array.isArray(data.words)) throw new Error('Invalid word data');
    words = data.words;
    game = createSession(words);
    renderSelectors();
    renderWord();
    $('load-status').textContent = '';
    $('load-status').className = 'sr-only';
  } catch {
    $('game').hidden = true;
    $('load-status').className = 'notice';
    $('load-status').textContent = 'The practice words could not load. Please reload the page to try again.';
  }
}

start();
