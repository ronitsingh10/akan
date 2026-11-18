import { readFile, writeFile, readdir, mkdir, copyFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tones = new Set(['high', 'mid', 'low']);

export function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(text ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, value) => {
    if (!value.startsWith('#')) return named[value] ?? entity;
    const code = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : entity;
  });
}

// Parse only the two allowlisted INSERT streams. Never evaluate SQL or export other tables.
export function readTable(sql, table) {
  if (!['words', 'syllables'].includes(table)) throw new Error('Unsupported table');
  const header = new RegExp('^INSERT INTO `' + table + '` VALUES\\s*', 'gm');
  const rows = [];
  for (const match of sql.matchAll(header)) {
    let i = match.index + match[0].length;
    const fail = () => { throw new Error(`Malformed ${table} INSERT`); };
    const whitespace = () => { while (/\s/.test(sql[i] ?? '') && i < sql.length) i++; };
    while (true) {
      whitespace();
      if (sql[i++] !== '(') fail();
      const row = [];
      while (true) {
        whitespace();
        let value = '';
        if (sql[i] === "'") {
          i++;
          let closed = false;
          while (i < sql.length) {
            const char = sql[i++];
            if (char === '\\') {
              if (i >= sql.length) fail();
              const escaped = sql[i++];
              value += ({'0':'\0', n:'\n', r:'\r', t:'\t', b:'\b', Z:'\x1a'})[escaped] ?? escaped;
            } else if (char === "'") {
              if (sql[i] === "'") { value += "'"; i++; }
              else { closed = true; break; }
            } else value += char;
          }
          if (!closed) fail();
        } else {
          const start = i;
          while (i < sql.length && ![',', ')'].includes(sql[i])) i++;
          const token = sql.slice(start, i).trim();
          if (token === 'NULL') value = null;
          else if (/^-?\d+$/.test(token)) value = Number(token);
          else fail();
        }
        row.push(value);
        whitespace();
        const delimiter = sql[i++];
        if (delimiter === ')') break;
        if (delimiter !== ',') fail();
      }
      if (row.length !== (table === 'words' ? 9 : 5)) fail();
      rows.push(row);
      whitespace();
      const delimiter = sql[i++];
      if (delimiter === ';') break;
      if (delimiter !== ',') fail();
    }
  }
  return rows;
}

export function convert(sql, { images = [], sounds = [], placeholderCopies = [], placeholderAudio = [] } = {}) {
  const wordRows = readTable(sql, 'words');
  const syllableRows = readTable(sql, 'syllables');
  if (!wordRows.length || !syllableRows.length) throw new Error('Words and syllables are required');
  const report = { missingAudio: [], placeholderAudio: [], placeholderImages: [], placeholderCopies: [], missingImages: [],
    orphanSyllables: [], unusedAudio: [], spellingMismatches: [] };
  const ids = new Set(wordRows.map(row => row[1]));
  if (ids.size !== wordRows.length) throw new Error('Duplicate word IDs');
  const grouped = new Map();
  const syllableIds = new Set();
  for (const [id, text, tone, ordering, wordId] of syllableRows) {
    if (!tones.has(tone)) throw new Error(`Invalid tone on syllable ${id}`);
    if (syllableIds.has(id)) throw new Error(`Duplicate syllable ID ${id}`);
    syllableIds.add(id);
    if (!ids.has(wordId)) { report.orphanSyllables.push(id); continue; }
    if (!Number.isInteger(ordering) || ordering < 1 || !text) throw new Error(`Invalid syllable ${id}`);
    if (!grouped.has(wordId)) grouped.set(wordId, []);
    grouped.get(wordId).push({ id, text: decodeEntities(text), tone, ordering });
  }
  const media = (name, available, type) => {
    if (!name) return null;
    if (basename(name) !== name || /[\\\x00-\x1f]/.test(name) || !/^[\w .()-]+$/.test(name)) {
      throw new Error('Unsafe media filename');
    }
    const extension = type === 'sounds' ? /\.mp3$/i : /\.(?:jpg|jpeg|png|gif|webp)$/i;
    if (!extension.test(name)) throw new Error('Unsupported media file type');
    return available.includes(name) ? `media/${type}/${name}` : null;
  };
  const words = wordRows.map(([visibility, id, word, translation, imageName, audioName, course, module, lesson]) => {
    if (![0,1].includes(visibility) || !Number.isInteger(id) || !word || course == null ||
        !Number.isInteger(module) || !Number.isInteger(lesson)) throw new Error(`Invalid word ${id}`);
    const syllables = (grouped.get(id) ?? []).sort((a,b) => a.ordering - b.ordering);
    if (!syllables.length) throw new Error(`Word ${id} has no syllables`);
    if (new Set(syllables.map(s => s.ordering)).size !== syllables.length) throw new Error(`Duplicate syllable order on word ${id}`);
    const imagePath = media(imageName, images, 'images');
    const image = imageName === 'placeholder.jpg' || placeholderCopies.includes(imageName) ? null : imagePath;
    const audioPath = media(audioName, sounds, 'sounds');
    const audio = placeholderAudio.includes(audioName) ? null : audioPath;
    const decoded = decodeEntities(word);
    if (visibility === 1) {
      if (placeholderAudio.includes(audioName)) report.placeholderAudio.push(id);
      else if (!audio) report.missingAudio.push(id);
      if (imageName === 'placeholder.jpg') report.placeholderImages.push(id);
      else if (placeholderCopies.includes(imageName)) report.placeholderCopies.push(id);
      else if (!image) report.missingImages.push(id);
    }
    const spelling = syllables.map(s => s.text).join('');
    if (decoded.replace(/\s/g, '') !== spelling.replace(/\s/g, '')) {
      report.spellingMismatches.push({ id, word: decoded, syllables: spelling });
    }
    return { id, visibility, word: decoded, translation: decodeEntities(translation), image, audio,
      course: String(course), module, lesson, syllables };
  });
  const usedAudio = new Set(wordRows.map(row => row[5]));
  report.unusedAudio = sounds.filter(name => name.endsWith('.mp3') && !usedAudio.has(name)).sort();
  return { data: { words }, report, sourceSyllables: syllableRows.length };
}

async function main() {
  const dump = resolve(process.argv[2] ?? resolve(root, 'dumps/2026-11-07-dump-africa_akan.sql'));
  const source = resolve(process.argv[3] ?? resolve(root, '../akan_game-main/app'));
  const [sql, images, sounds] = await Promise.all([
    readFile(dump, 'utf8'), readdir(resolve(source, 'images')), readdir(resolve(source, 'sounds')),
  ]);
  // Files that are byte-for-byte copies of the original placeholder are not real media.
  const copiesOf = async (type, names, placeholderName, extension) => {
    const placeholder = await readFile(resolve(source, type, placeholderName));
    const copies = [];
    for (const name of names.filter(name => name !== placeholderName && extension.test(name))) {
      if ((await readFile(resolve(source, type, name))).equals(placeholder)) copies.push(name);
    }
    return copies;
  };
  const placeholderCopies = await copiesOf('images', images, 'placeholder.jpg', /\.(jpg|jpeg|png|gif|webp)$/i);
  const placeholderAudio = await copiesOf('sounds', sounds, 'placeholder.mp3', /\.mp3$/i);
  const { data, report, sourceSyllables } = convert(sql, { images, sounds, placeholderCopies, placeholderAudio });
  for (const directory of ['data', 'media/images', 'media/sounds']) await mkdir(resolve(root, directory), { recursive: true });
  const files = new Set(data.words.flatMap(word => [word.image, word.audio]).filter(Boolean));
  files.add('media/images/placeholder.jpg');
  for (const file of files) await copyFile(resolve(source, file.slice('media/'.length)), resolve(root, file));
  // media/ is generated: remove files that the current data no longer references.
  let removed = 0;
  for (const type of ['images', 'sounds']) {
    for (const name of await readdir(resolve(root, 'media', type))) {
      if (!files.has(`media/${type}/${name}`)) { await unlink(resolve(root, 'media', type, name)); removed++; }
    }
  }
  // Different words sharing one recording usually means one of them plays the wrong word.
  const recordings = new Map();
  for (const word of data.words.filter(word => word.visibility === 1 && word.audio)) {
    const hash = createHash('sha256').update(await readFile(resolve(root, word.audio))).digest('hex');
    recordings.set(hash, [...(recordings.get(hash) ?? []), word]);
  }
  report.sharedAudio = [...recordings.values()].filter(group => new Set(group.map(word => word.word)).size > 1)
    .map(group => group.map(word => `${word.id} ${word.word}`));
  await writeFile(resolve(root, 'data/words.json'), JSON.stringify(data, null, 2) + '\n');
  const visible = data.words.filter(word => word.visibility === 1).length;
  console.log(`Converted ${data.words.length} words (${visible} visible, ${data.words.length-visible} hidden), ${sourceSyllables} source syllables.`);
  console.log(`Copied ${files.size} referenced media files, removed ${removed} unreferenced. No user data exported.`);
  for (const [category, items] of Object.entries(report)) console.log(`${category}: ${items.length}\n${JSON.stringify(items)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Conversion failed: ${error.message}`); process.exitCode = 1; });
}
