# Judo Kyu Guide

A static checklist of every judo technique and Japanese term required for each
kyu grading, from 6th kyu (white belt) to 1st kyu (brown belt).

- **116 techniques** and **19 terms** (22 including the parts of the judogi)
- Every technique links to its **Kodokan Judo Institute** demonstration video
- **Japanese pronunciation** via the browser's speech synthesis (reads the kanji)
- **Checkboxes with progress bars**, saved in `localStorage`
- Search, "not learned only" filter, light/dark theme
- No frameworks, no build step, no dependencies - plain HTML, CSS and JS

## Using it

Open `index.html`. It works both from a web server (GitHub Pages) and by
double-clicking the file.

On `file://` two things degrade, by design:

- Chrome and Safari block `localStorage`, so ticks last for the session only and
  a notice explains this. Firefox usually allows it.
- Inline YouTube players are blocked, so only "Kodokan video" links are shown.

Serving locally avoids both:

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## Pronunciation

The **Say it** button speaks the kanji with a `ja-JP` voice. Kanji is used
rather than romaji because a Japanese voice then gets the pitch and vowel
length right. If no Japanese voice is installed the button is disabled instead
of mispronouncing the name with an English voice.

- **macOS/iOS:** System Settings → Accessibility → Spoken Content → System
  Voice → Manage Voices → Japanese (Kyoko).
- **Windows:** Settings → Time & Language → Speech → Add voices → Japanese.
- **Android:** Settings → Accessibility → Text-to-speech → install Japanese.

## Layout

```
index.html            6 belt cards + overall progress
6-kyu.html            vocabulary only (19 terms)
5-kyu.html .. 1-kyu.html   techniques per level
glossary.html         all terms, alphabetical
404.html
assets/css/style.css  one stylesheet, CSS custom properties
assets/js/store.js    localStorage with in-memory fallback, theme
assets/js/speech.js   Japanese speech synthesis
assets/js/render.js   DOM builders (createElement only, never innerHTML)
assets/js/app.js      page controllers, filters, progress
data/techniques.js    GENERATED -> window.KYU_TECHNIQUES
data/vocabulary.js    GENERATED -> window.KYU_VOCABULARY
data/source/          inputs for the generators (see below)
scripts/              regeneration and validation
kyu.txt               the original grading list
```

The data is delivered as `.js` files that assign to `window`, not as JSON,
because `fetch()` of a local JSON file is blocked by CORS on `file://`. This
way the site opens without a server.

## Editing the content

| Want to change | Edit |
| --- | --- |
| A wrong or missing video link | `data/source/video-overrides.json` |
| English name of a technique | `data/source/english-names.json` |
| A term, meaning or kanji | `data/source/vocabulary-source.json` |
| The technique list itself | `kyu.txt`, then rebuild |

Then regenerate:

```bash
python3 scripts/build-data.py       # data/techniques.js, data/vocabulary.js
python3 scripts/build-pages.py      # level pages + glossary (headings, counts)
python3 scripts/validate-data.py    # ids, counts, required fields
bash    scripts/check-videos.sh     # every video id still resolves (network)
```

`video-overrides.json` is applied **last** by the builder, so rebuilding never
overwrites a link you fixed by hand.

## Video matching

Names in the source list are matched against a snapshot of the Kodokan
"100 Techniques" playlist (`data/source/playlist.json`), which also supplies the
kanji. Each technique records how it was matched:

| Match | Count | Meaning |
| --- | --- | --- |
| `exact` | 105 | Its own Kodokan video |
| `related` | 10 | No own video; links the closest technique, labelled in the UI |
| `none` | 1 | `Ashi-hishigi` - not in the playlist |

Kanji is never inherited from a `related` video, since it belongs to a different
technique; those come from `extraKanji` in `english-names.json`.

Holds additionally link an **Escapes** video where the playlist has one.

## Notes on the source document

The original list is in Russian and has a few issues, all fixed in the data with
the original kept in `alsoKnownAs`:

- Typos: `Dubon` → `Zubon`, `Тaketa` → `Toketa`, Cyrillic `Іppon` → `Ippon`
- `Ryote-jime` and `Sode-guruma-jime` were listed under Kansetsu-waza; they are
  strangles, so they are shown under Shime-waza (still on 3rd kyu)
- Names normalised to Kodokan spelling: `Hon-kesa-gatame` → `Kesa-gatame`,
  `De-ashi-barai` → `De-ashi-harai`, `Kuchiki-daoshi` → `Kuchiki-taoshi`, etc.
- Techniques that repeat across levels, and numbered variants, get their own
  checkbox and id (`5-kyu/o-uchi-gaeshi/variant-2`)

## Deploying to GitHub Pages

Push to `main`, then Settings → Pages → Source: *Deploy from a branch* →
`main` / `/ (root)`. `.nojekyll` is included so Jekyll does not touch the files.

## Credits

Videos © [Kodokan Judo Institute](https://www.youtube.com/@kodokanjudoinstitute).
This site only links to and embeds them; it hosts no video content.
