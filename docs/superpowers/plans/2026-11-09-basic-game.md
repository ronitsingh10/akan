# Basic Akan Game Implementation Plan

**Goal:** Rebuild the approved student practice flow as a self-contained static folder.

**Architecture:** A Node conversion script creates JSON and copies existing media. A small pure game module owns filtering, grading and in-memory session state. A browser module renders accessible controls and handles native audio.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-ins.

**Spec:** `docs/superpowers/specs/2026-11-09-basic-game-design.md`, with AGENTS.md as the scope authority.

## Constraints and review focus

- No packages, runtime networks, storage, database, PHP or out-of-scope features.
- Never read user rows into generated data, and never request UF hosts.
- Test SQL quoting and entities, missing media, hidden-word exclusion, cascading selections, incomplete answers, retry retention and score reset.
- Check keyboard focus after submission/navigation, empty sets, load/audio errors, long words, mobile width and zoom in the browser.

## Tasks

- [x] Write converter tests in `tests/convert.test.mjs` using synthetic SQL, including an unrelated table sentinel and escaped text. Run `node --test` and confirm missing implementation fails.
- [x] Implement `scripts/convert.mjs`: whitelist table parsing, entity decoding, validation, source diagnostics, JSON output and existing-media copies. Run the converter against the supplied dump and inspect audit counts.
- [x] Write `tests/game.test.mjs`: filtering, cascade values, all three tones, partial grading, locked correct syllables, repeated submissions, navigation and reset. Run and confirm the missing module fails.
- [x] Implement `js/game.mjs` with pure selection helpers and a memory-only session. Run `node --test`.
- [x] Create `index.html`, `styles.css` and `js/app.mjs` using native controls and DOM text APIs. Include data-loading, empty-set and audio-failure messages.
- [x] Add README usage, conversion, deployment file allowlist and known data problems. Serve locally, check browser interactions, 320px layout, zoom and keyboard operation. Run `node --test` again and review the diff. Leave changes uncommitted.

## Execution notes

Implement directly in this initially empty workspace. The user's request authorizes the basic build; the supplied scope resolves design choices. No publishing is needed to deliver a local version.


## Verification record

- Initial converter and game tests failed because their implementation modules did not exist. Implemented the modules and obtained a green suite.
- Final suite: 12 built-in Node tests, including generated-data field allowlists, every media reference, and grading every visible word.
- Converter audit matched 423 words / 407 visible / 16 hidden / 1,121 source syllables, six missing recordings, 251 placeholder pictures, 61 missing pictures, 14 orphan syllables, 23 unused mp3s and the two documented spelling mismatches.
- Native local browser checks: successful audio playback, partially correct submission, locked correct tones, keyboard retry, completed-word navigation, Trial selection reset, reload reset, image alternative text, 320px responsive layout, 200% zoom and visible keyboard focus.
- Fresh code review found audio-error recovery and focus outside the viewport. Playback now reloads a failed media resource before retrying, and focus uses normal browser scrolling. A simulated offline recording request failed visibly; after restoring connectivity, the same Play button successfully requested the recording and played it. Mobile keyboard focus was visually checked after the fix.
- Main text contrast ratios were checked numerically and exceeded 4.5:1. These checks are not a full assistive-technology conformance audit.
- Only localhost was used for browser verification. No UF URL was requested. No new packages, commits, pushes or deployment.
