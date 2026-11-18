# Akan Pronunciation Game

A static Twi tone-practice game for Dr. James Essegbey's Akan courses at the University of Florida. Built by Ronit Singh.

## Run locally

The page is ready to serve. There are no packages to install or page build steps.

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080`. Use an HTTP server rather than double-clicking `index.html`, since browsers restrict local ES modules and JSON requests.

## Design and assets

The game uses the approved UF/CLAS blue design in `index.html` and `styles.css`. Alternate designs and the preview gallery have been removed.

The African Studies header follows the new blue theme in `../ufl-main-uni/header.php` and `scss/layout/header.scss`, using the supplied November 2026 screenshot for the branding. The UF vector artwork in `assets/branding/` comes from the local CLAS theme. IBM Plex Sans comes from `../ufl-main-uni/fonts/`; Source Serif 4 is an Adobe font distributed through [Google Fonts](https://github.com/google/fonts). Both fonts ship locally in `assets/fonts/` with their SIL licenses. No live UF requests are used for development or testing.

Icons use [Lucide](https://lucide.dev/guide/static), with its license in `assets/icons/LICENSE`. Header and playback icons are inline SVG; the dropdown chevron is a local SVG file. The dropdowns retain native keyboard behavior and operating-system menus.

## Play

1. Select a course, module and lesson, or choose All. Trial is course 42.
2. Play the recording and select High, Mid or Low for each syllable.
3. Check your answer. Correct syllables remain selected; incorrect ones clear for another attempt. Answers are never revealed after a miss.
4. Use Previous and Next at any time. Each completed word counts once.

Changing any selection resets the score and answers. Reloading starts over. Nothing is saved or sent to a server. Hidden words never enter a practice set.

Tone controls are native radio groups. Use Tab to move between groups, arrow keys to choose a tone, and Enter or Space on buttons. Results include text and a live announcement. The layout adapts to narrow screens and zoom.

## Refresh the source data

Node 22 or later is sufficient; no npm dependencies are needed.

```sh
node scripts/convert.mjs
```

Defaults:

- SQL input: `dumps/2026-11-07-dump-africa_akan.sql`
- Media source: `../akan_game-main/app/images/` and `../akan_game-main/app/sounds/`
- Output: `data/words.json` and referenced files in `media/`

Alternative source paths can be supplied as positional arguments:

```sh
node scripts/convert.mjs /path/to/new-dump.sql /path/to/original/app
```

This command parses only the `words` and `syllables` INSERT streams, decodes text entities, sorts syllables, copies existing referenced media and reports source problems. Files that are byte-for-byte copies of the original `placeholder.jpg` or `placeholder.mp3` are treated as missing. It never exports the users table. The raw dump stays gitignored. The JSON includes visible and hidden words; the game excludes hidden words. Orphan syllables are reported and excluded because they have no associated word.

Rerun the command whenever the source data changes. It overwrites generated data and referenced media, and deletes files in `media/` that the data no longer references.

## Known source problems

The current import contains 423 words, including 407 visible and 16 hidden, and 1,121 source syllables. There are 397 visible AKAN 1130 words and 10 Trial words. There are no visible AKAN 1131 words, so that course is not offered.

- Six visible words have no recording: 247 kasa, 281 asikafo, 308 mema wo akwaaba, 329 dɛ, 360 ɔte and 515 aponkyenam. They remain in the set with an “Audio unavailable” button.
- Five visible words point at copies of the original placeholder recording instead of a real one: 48 wo, 55 onua, 56 onua, 72 amɛrikani and 77 akwasi. They also show “Audio unavailable”.
- Words 398 ɔgyefoɔ and 399 ɔbenim share the same recording, so one of them plays the wrong word.
- 251 visible words reference `placeholder.jpg`, 94 reference numbered copies of that same question mark, and 61 reference missing pictures. All display the original question-mark placeholder, preserving the original game's image area. The placeholder has empty alternative text because it is decorative.
- Only one visible word, `ewia` (sun) in Trial / Module 2 / Lesson 1, has a real picture. Real pictures use the English translation as alternative text.
- Word 58 is `wɔnom`, but its syllables spell `wɔɔnom`.
- Word 478 is `sa (yareɛ)`, but its syllables spell `sa`.
- 14 orphan syllables and 23 unused mp3s are reported by the converter.

Source text and tones are preserved. High, Mid and Low remain available. Decisions about new recordings, spelling corrections or changing tone options belong to the instructor.

## Verify

```sh
node --test
```

Tests cover conversion, entities, filtering, cascading options, grading, retry retention, score reset and navigation. For UI changes, also load the local page, test keyboard controls, check 320px width and 200% zoom, and exercise playback and unavailable media states.

Never request UF domains from scripts, tests or automated browsers. Automated browsers must block `ufl.edu` and its subdomains. All verification should target localhost.

## Deploy

Copy only these runtime files and directories into a static host's document root:

```text
index.html
styles.css
assets/
js/
data/
media/
```

Serve `.mjs` files as JavaScript and `.json` files as JSON. No server application or database is needed. Relative URLs support hosting at a subpath. The page uses a same-origin content security policy and has no CDN resources.

Do not upload the repository wholesale. In particular, do not publish `dumps/`, `.git/`, source SQL, agent instructions or local tooling. The hosting destination remains a CLAS IT / UFIT decision; this version has not been deployed to `game.africa.ufl.edu`.
