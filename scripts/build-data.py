#!/usr/bin/env python3
"""Build data/techniques.js and data/vocabulary.js from the source files.

Inputs:
  kyu.txt                         - the original grading list (repo root)
  data/source/playlist.json       - Kodokan "100 Techniques" playlist snapshot
  data/source/english-names.json  - English names / group translations
  data/source/vocabulary-source.json - the glossary (manual)
  data/source/video-overrides.json   - manual video fixes, applied last

Outputs (plain .js so the site works from file:// without a server):
  data/techniques.js  -> window.KYU_TECHNIQUES
  data/vocabulary.js  -> window.KYU_VOCABULARY

Usage:  python3 scripts/build-data.py
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source"
OUT = ROOT / "data"

BELTS = {
    # Belt hues are desaturated to sit inside the cool midnight palette. They
    # only ever appear as a small dot and the progress-bar fill, never as a
    # filled surface, so no paired foreground colour is needed.
    6: {"name": "White", "hex": "#dfe7f2"},
    5: {"name": "Yellow", "hex": "#d8bd6a"},
    4: {"name": "Orange", "hex": "#cf8352"},
    3: {"name": "Green", "hex": "#5f9e79"},
    2: {"name": "Blue", "hex": "#5b8fc9"},
    1: {"name": "Brown", "hex": "#9c7a5f"},
}

ORDINAL = {6: "6th", 5: "5th", 4: "4th", 3: "3rd", 2: "2nd", 1: "1st"}

# Technique blocks in kyu.txt appear in this order (block 0 = glossary = 6th kyu)
BLOCK_ORDER = [5, 4, 3, 2, 1]

# Source document name -> official Kodokan name
ALIAS = {
    "Hon-kesa-gatame": "Kesa-gatame",
    "Kata-ha-jime": "Kataha-jime",
    "Kouchi-gake": "Ko-uchi-makikomi",
    "Kuchiki-daoshi": "Kuchiki-taoshi",
    "De-ashi-barai": "De-ashi-harai",
    "Okuri-ashi-barai": "Okuri-ashi-harai",
    "Hikkomi-gaeshi": "Hikikomi-gaeshi",
}

# No dedicated Kodokan video -> closest related video
RELATED = {
    "Te-guruma": "Sukui-nage",
    "Morote-seoi-nage": "Seoi-nage",
    "Kesa-ude-hishigi-gatame": "Ude-hishigi-juji-gatame",
    "Kesa-ude-garami": "Ude-garami",
    "Ushiro-waki-gatame": "Ude-hishigi-waki-gatame",
    "Makura-kesa-gatame": "Kuzure-kesa-gatame",
    "Kuzure-yoko-shiho-gatame": "Yoko-shiho-gatame",
    "Kuzure-tate-shiho-gatame": "Tate-shiho-gatame",
    "Tomoe-jime": "Tomoe-nage",
    "Daki-age": "Daki-wakare",
}

# Listed under the wrong group in the source document
REGROUP = {
    "Ryote-jime": "Shime-waza",
    "Sode-guruma-jime": "Shime-waza",
}

GROUP_PARENT = {
    "Osaekomi-waza": "Katame-waza",
    "Shime-waza": "Katame-waza",
    "Kansetsu-waza": "Katame-waza",
    "Tachi-waza": None,
}

GROUP_SEQUENCE = ["Osaekomi-waza", "Shime-waza", "Kansetsu-waza", "Tachi-waza"]


def norm(name):
    """Normalise a romaji name so spelling variants match."""
    s = unicodedata.normalize("NFKD", name).lower()
    s = re.sub(r"[^a-z]+", "", s)
    for a, b in (
        ("barai", "harai"),
        ("daoshi", "taoshi"),
        ("hikkomi", "hikikomi"),
        ("siho", "shiho"),
    ):
        s = s.replace(a, b)
    return s


def slugify(name):
    s = unicodedata.normalize("NFKD", name).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def load_json(path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def build_video_index(playlist):
    """Return (main, escapes) lookup tables keyed by normalised romaji."""
    main, escapes = {}, {}
    for item in playlist["videos"]:
        romaji = item["romaji"]
        if item["title"].startswith("KODOKAN JUDO"):
            continue
        if "Escapes" in romaji:
            escapes[norm(romaji.replace("Escapes", ""))] = item["videoId"]
        else:
            main[norm(romaji)] = {
                "videoId": item["videoId"],
                "romaji": romaji,
                "kanji": item["kanji"],
            }
    return main, escapes


def parse_kyu_txt(path):
    """Parse kyu.txt into {kyu: [{group, name, variant}]}."""
    text = path.read_text(encoding="utf-8")
    blocks = [b for b in re.split(r"\n{5,}", text)[1:] if b.strip()]
    if len(blocks) != len(BLOCK_ORDER):
        sys.exit("expected %d technique blocks, found %d" % (len(BLOCK_ORDER), len(blocks)))

    levels = {}
    for kyu, block in zip(BLOCK_ORDER, blocks):
        current = None
        rows = []
        for raw in block.strip().splitlines():
            line = raw.strip()
            if not line:
                continue
            head = re.match(r"^(Osaekomi|Shime|Kansetsu|Tachi)-waza", line)
            if head:
                current = head.group(1) + "-waza"
                continue
            if line.startswith("Katame-waza"):
                continue
            m = re.match(r"^([A-Za-z][A-Za-z-]*)", line)
            if not m or current is None:
                continue
            # The source writes both "вариант 1" and "(1 вариант)".
            vm = re.search(r"[Вв]ариант\s*(\d)", line) or re.search(
                r"(\d)\s*[Вв]ариант", line
            )
            rows.append(
                {
                    "group": current,
                    "name": m.group(1).rstrip("-"),
                    "variant": int(vm.group(1)) if vm else None,
                }
            )
        levels[kyu] = rows
    return levels


def build_technique(row, kyu, videos, escapes, en_names, overrides, seen, missing_en):
    source_name = row["name"]
    official = ALIAS.get(source_name, source_name)

    hit = videos.get(norm(official))
    match = "exact"
    if hit is None:
        target = RELATED.get(source_name) or RELATED.get(official)
        if target:
            hit = videos.get(norm(target))
            match = "related"
    if hit is None:
        match = "none"

    display = hit["romaji"] if (hit and match == "exact") else official
    base_slug = slugify(display)

    variant = row["variant"]
    key = (kyu, base_slug)
    seen[key] = seen.get(key, 0) + 1
    if variant is None and seen[key] > 1:
        variant = seen[key]

    tech_id = "%d-kyu/%s" % (kyu, base_slug)
    if variant:
        tech_id += "/variant-%d" % variant

    en = en_names.get(display) or en_names.get(official) or en_names.get(source_name)
    if not en:
        missing_en.append(display)
        en = ""

    # Never inherit kanji from a related video - it belongs to another technique.
    if match == "exact":
        kanji = hit["kanji"]
    else:
        kanji = EXTRA_KANJI.get(display) or EXTRA_KANJI.get(official) or ""

    entry = {
        "id": tech_id,
        "romaji": display,
        "kanji": kanji,
        "en": en,
    }
    if variant:
        entry["variant"] = variant
    if norm(source_name) != norm(display):
        entry["alsoKnownAs"] = source_name

    if hit:
        entry["video"] = {"id": hit["videoId"], "match": match}
        if match == "related":
            entry["video"]["relatedTo"] = hit["romaji"]
    else:
        entry["video"] = {"id": None, "match": "none"}

    esc = escapes.get(norm(display)) or escapes.get(norm(official))
    if esc:
        entry["escapeVideo"] = esc

    ov = overrides.get(tech_id)
    if ov:
        entry["video"] = {"id": ov.get("videoId"), "match": ov.get("match", "exact")}

    return entry, match


def build_groups(rows, kyu, videos, escapes, en_names, overrides, missing_en, stats):
    buckets = {}
    seen = {}
    for row in rows:
        group = REGROUP.get(row["name"], row["group"])
        entry, match = build_technique(
            row, kyu, videos, escapes, en_names, overrides, seen, missing_en
        )
        stats[match] += 1
        if "escapeVideo" in entry:
            stats["escapes"] += 1
        buckets.setdefault(group, []).append(entry)

    groups = []
    for gname in GROUP_SEQUENCE:
        if gname not in buckets:
            continue
        parent = GROUP_PARENT.get(gname)
        groups.append(
            {
                "id": slugify(gname),
                "romaji": gname,
                "kanji": GROUP_KANJI.get(gname, ""),
                "en": GROUP_EN.get(gname, ""),
                "parent": parent,
                "parentKanji": GROUP_KANJI.get(parent, "") if parent else "",
                "parentEn": GROUP_EN.get(parent, "") if parent else "",
                "techniques": buckets[gname],
            }
        )
    return groups


def write_js(path, var, payload):
    body = json.dumps(payload, ensure_ascii=False, indent=1)
    header = (
        "/* AUTO-GENERATED by scripts/build-data.py - do not edit by hand.\n"
        "   To fix or add a video link, use data/source/video-overrides.json. */\n"
    )
    path.write_text("%swindow.%s = %s;\n" % (header, var, body), encoding="utf-8")


def main():
    global GROUP_EN, GROUP_KANJI

    playlist = load_json(SRC / "playlist.json")
    english = load_json(SRC / "english-names.json")
    vocab_src = load_json(SRC / "vocabulary-source.json")
    overrides = load_json(SRC / "video-overrides.json").get("overrides", {})

    en_names = english["names"]
    GROUP_EN = english["groups"]
    GROUP_KANJI = english["groupKanji"]
    EXTRA_KANJI.update(
        {k: v for k, v in english.get("extraKanji", {}).items() if not k.startswith("_")}
    )

    videos, escapes = build_video_index(playlist)
    parsed = parse_kyu_txt(ROOT / "kyu.txt")

    stats = {"exact": 0, "related": 0, "none": 0, "escapes": 0}
    missing_en = []
    levels_out = []

    terms = vocab_src["terms"]
    # Nested terms (the judogi parts) get their own checkbox, so they count too.
    vocab_count = sum(
        1 + len(t.get("children", [])) for t in terms if t.get("kyu") == 6
    )
    levels_out.append(
        {
            "kyu": 6,
            "slug": "6-kyu",
            "ordinal": ORDINAL[6],
            "belt": BELTS[6],
            "kind": "vocabulary",
            "itemCount": vocab_count,
            "topLevelTerms": sum(1 for t in terms if t.get("kyu") == 6),
            "groups": [],
        }
    )

    for kyu in BLOCK_ORDER:
        groups = build_groups(
            parsed[kyu], kyu, videos, escapes, en_names, overrides, missing_en, stats
        )
        levels_out.append(
            {
                "kyu": kyu,
                "slug": "%d-kyu" % kyu,
                "ordinal": ORDINAL[kyu],
                "belt": BELTS[kyu],
                "kind": "techniques",
                "itemCount": sum(len(g["techniques"]) for g in groups),
                "groups": groups,
            }
        )

    levels_out.sort(key=lambda lvl: -lvl["kyu"])

    total_tech = sum(l["itemCount"] for l in levels_out if l["kind"] == "techniques")

    write_js(
        OUT / "techniques.js",
        "KYU_TECHNIQUES",
        {
            "generated": True,
            "playlistId": playlist["playlistId"],
            "totalTechniques": total_tech,
            "levels": levels_out,
        },
    )
    write_js(
        OUT / "vocabulary.js",
        "KYU_VOCABULARY",
        {"generated": True, "totalTerms": len(terms), "terms": terms},
    )

    nested = sum(len(t.get("children", [])) for t in terms)
    print("techniques :", total_tech)
    print("terms      : %d (+%d nested)" % (len(terms), nested))
    print("videos     :", stats)
    if missing_en:
        print("MISSING EN :", sorted(set(missing_en)))
    for level in levels_out:
        print(
            "  %4s kyu  %-7s %3d items"
            % (level["ordinal"], level["belt"]["name"], level["itemCount"])
        )


GROUP_EN = {}
GROUP_KANJI = {}
EXTRA_KANJI = {}

if __name__ == "__main__":
    main()
