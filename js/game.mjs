export const TONES = ['high', 'mid', 'low'];
const levels = ['course', 'module', 'lesson'];

export function filterWords(words, selection = {}) {
  return words.filter(word => word.visibility === 1 && levels.every(level =>
    !selection[level] || selection[level] === 'all' || String(word[level]) === String(selection[level])
  )).sort((a, b) => a.word.localeCompare(b.word, 'en') || a.id - b.id);
}

export function selectionOptions(words, level, selection = {}) {
  const parents = Object.fromEntries(levels.slice(0, levels.indexOf(level)).map(key => [key, selection[key]]));
  return [...new Set(filterWords(words, parents).map(word => String(word[level])))].sort((a,b) => Number(a)-Number(b));
}

export function grade(syllables, choices) {
  return syllables.map((syllable, index) => TONES.includes(choices[index]) && choices[index] === syllable.tone);
}

export function createSession(words) {
  let selection = { course: 'all', module: 'all', lesson: 'all' };
  let set = filterWords(words, selection);
  let index = 0;
  const attempts = new Map();
  const attemptFor = word => {
    if (!word) return undefined;
    if (!attempts.has(word.id)) attempts.set(word.id, {
      choices: word.syllables.map(() => null), correct: word.syllables.map(() => null),
    });
    return attempts.get(word.id);
  };
  return {
    get selection() { return { ...selection }; },
    get words() { return set; },
    get index() { return index; },
    get current() { return set[index]; },
    get attempt() { return attemptFor(set[index]); },
    get score() { return [...attempts.values()].filter(a => a.correct.length && a.correct.every(value => value === true)).length; },
    select(level, value) {
      if (!levels.includes(level)) return;
      selection[level] = String(value);
      for (const child of levels.slice(levels.indexOf(level) + 1)) selection[child] = 'all';
      set = filterWords(words, selection);
      index = 0;
      attempts.clear();
    },
    choose(syllable, tone) {
      const attempt = attemptFor(set[index]);
      if (!attempt || !TONES.includes(tone) || syllable < 0 || syllable >= attempt.choices.length || attempt.correct[syllable]) return;
      attempt.choices[syllable] = tone;
      attempt.correct[syllable] = null;
    },
    submit() {
      const word = set[index];
      if (!word) return [];
      const attempt = attemptFor(word);
      attempt.correct = grade(word.syllables, attempt.choices);
      attempt.choices = attempt.choices.map((tone, i) => attempt.correct[i] ? tone : null);
      return [...attempt.correct];
    },
    move(direction) { index = Math.max(0, Math.min(set.length - 1, index + direction)); },
  };
}
