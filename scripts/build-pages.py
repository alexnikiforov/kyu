#!/usr/bin/env python3
"""Generate the level pages (6-kyu.html .. 1-kyu.html) and glossary.html.

The pages are plain static HTML committed to the repo - this script only keeps
their headings, counts and prev/next links in sync with the generated data.

Usage:  python3 scripts/build-pages.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#05060f">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body data-page="{page}"{body_attrs}>

<div class="wrap">
  <header class="site-header">
    <a class="brand" href="index.html">JC Dojo Kyiv Kyu Guide</a>
    <span class="spacer"></span>
    <a class="btn" href="glossary.html">Glossary</a>
  </header>

  <nav class="breadcrumb"><a href="index.html">All levels</a> &rsaquo; {crumb}</nav>

  <p class="notice" data-storage-notice hidden></p>

  <section class="page-head" data-page-head style="--belt: {belt_hex};">
    <p class="eyebrow is-start">{eyebrow}</p>
    <h1>{heading}</h1>
    <p class="sub">{sub}</p>
    <div class="progress" data-level-progress>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-label"></div>
    </div>
  </section>

  <div class="toolbar">
    <input class="search-input" type="search" data-search placeholder="{placeholder}" aria-label="{placeholder}">
    <label class="toggle">
      <input type="checkbox" data-unlearned>
      <span>Not learned only</span>
    </label>
    <button class="btn" type="button" data-reset-level>Reset</button>
  </div>

  <p class="empty" data-empty hidden>Nothing matches your filters.</p>
"""

FOOT = """
  <nav class="level-nav">
    {prev}
    {next}
  </nav>
</div>

<footer class="site-footer">
  <div class="wrap">
    <p>
      Videos by the
      <a href="https://www.youtube.com/@kodokanjudoinstitute" target="_blank" rel="noopener noreferrer">Kodokan Judo Institute</a>.
      Tap <strong>Say it</strong> to hear a name in Japanese - your device needs a Japanese voice installed.
    </p>
  </div>
</footer>

<script src="data/techniques.js"></script>
<script src="data/vocabulary.js"></script>
<script src="assets/js/store.js"></script>
<script src="assets/js/speech.js"></script>
<script src="assets/js/render.js"></script>
<script src="assets/js/app.js"></script>
</body>
</html>
"""


def load_window_js(name, var):
    raw = (ROOT / "data" / name).read_text(encoding="utf-8")
    return json.loads(raw.split("window.%s = " % var, 1)[1].rstrip().rstrip(";"))


def nav_link(level, rel):
    if level is None:
        return "<span></span>"
    arrow = "&larr; " if rel == "prev" else ""
    tail = " &rarr;" if rel == "next" else ""
    return '<a href="%s.html">%s%s kyu%s</a>' % (level["slug"], arrow, level["ordinal"], tail)


def build_level_page(level, prev_level, next_level):
    belt = level["belt"]

    if level["kind"] == "vocabulary":
        terms = level.get("topLevelTerms", level["itemCount"])
        sub = (
            "The %s kyu grading is all vocabulary: %d Japanese terms every judoka "
            "needs, including the three parts of the judogi."
            % (level["ordinal"], terms)
        )
        description = (
            "The %d Japanese judo terms required for the %s kyu grading (%s belt), "
            "with meanings and Japanese pronunciation."
            % (terms, level["ordinal"], belt["name"].lower())
        )
        placeholder = "Search terms..."
        body = '\n  <ul class="tech-list" data-terms></ul>\n'
    else:
        groups = ", ".join(g["romaji"] for g in level["groups"])
        sub = (
            "%d techniques across %s. Each one links to the Kodokan demonstration "
            "video." % (level["itemCount"], groups)
        )
        description = (
            "The %d judo techniques required for the %s kyu grading (%s belt), with "
            "Kodokan videos and Japanese pronunciation."
            % (level["itemCount"], level["ordinal"], belt["name"].lower())
        )
        placeholder = "Search techniques..."
        body = "\n  <div data-groups></div>\n"

    html = HEAD.format(
        title="%s kyu - %s belt - JC Dojo Kyiv Kyu Guide"
        % (level["ordinal"], belt["name"]),
        description=description,
        page="level",
        body_attrs=' data-kyu="%d"' % level["kyu"],
        crumb="%s kyu" % level["ordinal"],
        belt_hex=belt["hex"],
        eyebrow="Grading %d of 6" % (7 - level["kyu"]),
        heading='%s kyu <span class="belt-chip">%s belt</span>'
        % (level["ordinal"], belt["name"]),
        sub=sub,
        placeholder=placeholder,
    )
    html += body
    html += FOOT.format(prev=nav_link(prev_level, "prev"), next=nav_link(next_level, "next"))

    path = ROOT / ("%s.html" % level["slug"])
    path.write_text(html, encoding="utf-8")
    return path.name


def build_glossary(total_terms):
    html = HEAD.format(
        title="Glossary - every judo term - JC Dojo Kyiv Kyu Guide",
        description="Every Japanese judo term used across the kyu gradings, in "
        "alphabetical order, with kanji, meaning and pronunciation.",
        page="glossary",
        body_attrs="",
        crumb="Glossary",
        belt_hex="#c7d3ea",
        eyebrow="Every term, A to Z",
        heading="Glossary",
        sub="All %d terms in alphabetical order, with kanji, syllables and meaning. "
        "Tap <strong>Say it</strong> to hear the Japanese pronunciation." % total_terms,
        placeholder="Search the glossary...",
    )
    html += '\n  <ul class="tech-list" data-glossary></ul>\n'
    html += FOOT.format(
        prev='<a href="index.html">&larr; All levels</a>',
        next='<a href="6-kyu.html">6th kyu &rarr;</a>',
    )
    path = ROOT / "glossary.html"
    path.write_text(html, encoding="utf-8")
    return path.name


def main():
    levels = load_window_js("techniques.js", "KYU_TECHNIQUES")["levels"]

    written = []
    for i, level in enumerate(levels):
        written.append(
            build_level_page(
                level,
                levels[i - 1] if i > 0 else None,
                levels[i + 1] if i + 1 < len(levels) else None,
            )
        )

    vocab = load_window_js("vocabulary.js", "KYU_VOCABULARY")
    total = len(vocab["terms"]) + sum(len(t.get("children", [])) for t in vocab["terms"])
    written.append(build_glossary(total))

    for name in written:
        print("wrote", name)


if __name__ == "__main__":
    main()
