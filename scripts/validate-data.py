#!/usr/bin/env python3
"""Validate the generated data files.

Checks: JS wrapper is parseable, ids are unique, expected counts per level,
required fields present, video ids look well-formed.

Usage:  python3 scripts/validate-data.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 6th kyu is 19 terms + the 3 nested judogi parts, each with its own checkbox.
EXPECTED = {6: 22, 5: 18, 4: 22, 3: 28, 2: 30, 1: 18}
VIDEO_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

errors = []
warnings = []


def load_window_js(path, var):
    text = path.read_text(encoding="utf-8")
    marker = "window.%s = " % var
    if marker not in text:
        sys.exit("%s: missing '%s'" % (path.name, marker))
    body = text.split(marker, 1)[1].rstrip()
    if not body.endswith(";"):
        sys.exit("%s: payload does not end with ';'" % path.name)
    return json.loads(body[:-1])


def check(cond, msg, bucket=errors):
    if not cond:
        bucket.append(msg)


tech = load_window_js(ROOT / "data" / "techniques.js", "KYU_TECHNIQUES")
vocab = load_window_js(ROOT / "data" / "vocabulary.js", "KYU_VOCABULARY")

levels = tech["levels"]
check(len(levels) == 6, "expected 6 levels, got %d" % len(levels))
check([l["kyu"] for l in levels] == [6, 5, 4, 3, 2, 1], "levels are not ordered 6..1")

ids = {}
video_count = {"exact": 0, "related": 0, "none": 0}

for level in levels:
    kyu = level["kyu"]
    for field in ("slug", "ordinal", "belt", "kind", "itemCount"):
        check(field in level, "%d kyu: missing field '%s'" % (kyu, field))
    check(
        level["itemCount"] == EXPECTED[kyu],
        "%d kyu: expected %d items, got %d" % (kyu, EXPECTED[kyu], level["itemCount"]),
    )

    counted = 0
    for group in level["groups"]:
        check(bool(group["romaji"]), "%d kyu: group without romaji" % kyu)
        check(bool(group["en"]), "%d kyu: group %s without English name" % (kyu, group["romaji"]))
        for t in group["techniques"]:
            counted += 1
            tid = t["id"]
            check(tid not in ids, "duplicate id: %s" % tid)
            ids[tid] = True
            check(bool(t["romaji"]), "%s: empty romaji" % tid)
            check(bool(t["en"]), "%s: empty English name" % tid, warnings)
            check(bool(t["kanji"]), "%s: empty kanji" % tid, warnings)
            check(tid.startswith("%d-kyu/" % kyu), "%s: id does not match level" % tid)

            vid = t["video"]
            video_count[vid["match"]] = video_count.get(vid["match"], 0) + 1
            if vid["id"] is not None:
                check(
                    bool(VIDEO_RE.match(vid["id"])),
                    "%s: malformed video id %r" % (tid, vid["id"]),
                )
            else:
                check(vid["match"] == "none", "%s: null video but match=%s" % (tid, vid["match"]))
            if "escapeVideo" in t:
                check(
                    bool(VIDEO_RE.match(t["escapeVideo"])),
                    "%s: malformed escape video id" % tid,
                )

    if level["kind"] == "techniques":
        check(
            counted == level["itemCount"],
            "%d kyu: itemCount %d != counted %d" % (kyu, level["itemCount"], counted),
        )

total = sum(l["itemCount"] for l in levels if l["kind"] == "techniques")
check(
    tech["totalTechniques"] == total,
    "totalTechniques %d != sum %d" % (tech["totalTechniques"], total),
)

terms = vocab["terms"]
check(len(terms) == vocab["totalTerms"], "vocabulary totalTerms mismatch")
seen_terms = set()
for t in terms:
    for field in ("romaji", "kanji", "syllables", "en", "meaning"):
        check(t.get(field), "term %s: missing '%s'" % (t.get("romaji", "?"), field))
    check(t["romaji"] not in seen_terms, "duplicate term: %s" % t["romaji"])
    seen_terms.add(t["romaji"])
    for child in t.get("children", []):
        for field in ("romaji", "kanji", "syllables", "en"):
            check(child.get(field), "child %s: missing '%s'" % (child.get("romaji", "?"), field))

print("levels     : %d" % len(levels))
print("techniques : %d (unique ids: %d)" % (total, len(ids)))
print("terms      : %d" % len(terms))
print("videos     : %s" % video_count)

if warnings:
    print("\nWARNINGS (%d):" % len(warnings))
    for w in warnings:
        print("  ! %s" % w)

if errors:
    print("\nERRORS (%d):" % len(errors))
    for e in errors:
        print("  x %s" % e)
    sys.exit(1)

print("\nOK - all checks passed")
