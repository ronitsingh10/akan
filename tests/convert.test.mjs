import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, readTable, convert } from '../scripts/convert.mjs';

test('decodes Akan characters and translation entities without rendering markup', () => {
  assert.equal(decodeEntities('w&#596; &#603; &#x025B; &#39; &amp; &lt;b&gt;'), "wɔ ɛ ɛ ' & <b>");
  assert.equal(decodeEntities('&#99999999;'), '&#99999999;');
});

test('reads SQL quoted delimiters, escapes, nulls and multiple inserts', () => {
  const sql = "INSERT INTO `syllables` VALUES (1,'a,;()\\\'b','high',1,4),(2,'it''s','low',2,4);\nINSERT INTO `syllables` VALUES (3,NULL,'mid',3,4);";
  assert.deepEqual(readTable(sql, 'syllables'), [[1,"a,;()'b",'high',1,4],[2,"it's",'low',2,4],[3,null,'mid',3,4]]);
  assert.throws(() => readTable(sql, 'users'), /Unsupported table/);
  assert.throws(() => readTable("INSERT INTO `syllables` VALUES (1,'unfinished", 'syllables'), /Malformed/);
});

test('exports only word and syllable fields, sorts syllables and reports data problems', () => {
  const sql = `INSERT INTO \`unrelated\` VALUES ('PRIVATE_SENTINEL');
INSERT INTO \`words\` VALUES (1,58,'w&#596;nom','drink','placeholder.jpg','58.mp3','1130',2,1),(1,478,'sa(yare&#603;)','treat','missing.jpg','absent.mp3','1130',2,1),(0,9,'a','hidden','9.jpg','9.mp3','42',1,1);
INSERT INTO \`syllables\` VALUES (2,'nom','high',2,58),(1,'w&#596;&#596;','low',1,58),(3,'sa','mid',1,478),(4,'a','high',1,99),(5,'a','low',1,9);`;
  const { data, report } = convert(sql, { images: ['9.jpg'], sounds: ['58.mp3', '9.mp3', 'extra.mp3'] });
  assert.equal(JSON.stringify(data).includes('PRIVATE_SENTINEL'), false);
  assert.equal(data.words.length, 3);
  assert.equal(data.words[0].word, 'wɔnom');
  assert.deepEqual(data.words[0].syllables.map(s => s.text), ['wɔɔ', 'nom']);
  assert.equal(data.words[0].image, null);
  assert.equal(data.words[0].audio, 'media/sounds/58.mp3');
  assert.equal(data.words[1].audio, null);
  assert.equal(data.words[2].visibility, 0);
  assert.deepEqual(report.missingAudio, [478]);
  assert.deepEqual(report.placeholderImages, [58]);
  assert.deepEqual(report.missingImages, [478]);
  assert.deepEqual(report.orphanSyllables, [4]);
  assert.deepEqual(report.unusedAudio, ['extra.mp3']);
  assert.deepEqual(report.spellingMismatches.map(w => w.id), [58, 478]);
});

test('rejects invalid tones and unsafe media names instead of silently changing data', () => {
  const word = "INSERT INTO `words` VALUES (1,1,'a','a','../secret.jpg','1.mp3','42',2,1);";
  assert.throws(() => convert(word + "\nINSERT INTO `syllables` VALUES (1,'a','other',1,1);"), /tone/i);
  assert.throws(() => convert(word + "\nINSERT INTO `syllables` VALUES (1,'a','high',1,1);"), /media/i);
});

test('numbered copies of the placeholder are not labelled as real pictures', () => {
  const sql = `INSERT INTO \`words\` VALUES (1,89,'afia','name','89.jpg','89.mp3','1130',3,3),(1,3,'ewia','sun','sun.png','3.mp3','42',2,1);
INSERT INTO \`syllables\` VALUES (1,'afia','high',1,89),(2,'ewia','low',1,3);`;
  const { data, report } = convert(sql, { images: ['89.jpg', 'sun.png'], placeholderCopies: ['89.jpg'] });
  assert.equal(data.words[0].image, null);
  assert.equal(data.words[1].image, 'media/images/sun.png');
  assert.deepEqual(report.placeholderCopies, [89]);
  assert.deepEqual(report.missingImages, []);
});

test('copies of the placeholder recording are reported and not offered as real audio', () => {
  const sql = `INSERT INTO \`words\` VALUES (1,48,'wo','you','placeholder.jpg','48.mp3','1130',2,1),(1,3,'ewia','sun','placeholder.jpg','3.mp3','42',2,1);
INSERT INTO \`syllables\` VALUES (1,'wo','high',1,48),(2,'ewia','low',1,3);`;
  const { data, report } = convert(sql, { sounds: ['48.mp3', '3.mp3'], placeholderAudio: ['48.mp3'] });
  assert.equal(data.words[0].audio, null);
  assert.equal(data.words[1].audio, 'media/sounds/3.mp3');
  assert.deepEqual(report.placeholderAudio, [48]);
  assert.deepEqual(report.missingAudio, []);
});
