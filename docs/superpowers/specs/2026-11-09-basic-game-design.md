# Basic Akan pronunciation game

Build the essentials specified in AGENTS.md as a static page for students practising Twi tones. The existing PHP app is a behavioral reference only. Use plain HTML, CSS, ES modules and the supplied media, with no packages or external runtime services.

The screen has a compact course identity, heading, cascading Course / Module / Lesson selects, a score, a word card with its translation and available picture, a play button, syllable radio groups and Previous / Next controls. Use a navy, cream and orange palette, clear typography and generous spacing. Per the user's follow-up, preserve the original image area: show the original question-mark placeholder where a real picture is unavailable. Missing audio has a visible unavailable state. Start with All selected at each level, as the original did.

Keep High, Mid and Low. Grade every syllable on submission, retain correct answers, clear incorrect selections for another attempt and give text feedback without revealing answers. Keep session state in memory only. Each fully correct word counts once. Selection changes reset all attempts and scores. Navigation does not require completing a word.

The Node converter reads only words and syllables from the current SQL dump, decodes entities, orders syllables, audits source problems and copies referenced available media. The generated JSON contains word data and associated syllables only. Missing and placeholder images become null. Preserve source spelling and tone values. Ignore user-table content entirely.

Use real labels, fieldsets and radio controls, visible focus, live feedback, non-color result text and responsive wrapping. Verify with built-in Node tests, a locally served browser check at desktop and 320px, keyboard interaction and zoom. Block UF hosts during automated browser checks. No commits, pushes, deployment, additional features or dependencies.
