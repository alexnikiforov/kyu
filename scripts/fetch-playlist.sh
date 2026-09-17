#!/bin/bash
# Refresh data/source/playlist.json from the Kodokan "100 Techniques" playlist.
#
# Scrapes the public playlist page (ytInitialData) and follows the InnerTube
# continuation to get all pages. curl is used for the network because the system
# python on this machine has no SSL certificates.
#
# Usage:  bash scripts/fetch-playlist.sh

set -eu
cd "$(dirname "$0")/.." || exit 1

PLAYLIST_ID="PLtz539PTepc16H2iu5F3Q3D7_He1EYlIQ"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "fetching playlist page..."
curl -sL -A "$UA" -H 'Accept-Language: en-US,en;q=0.9' \
  "https://www.youtube.com/playlist?list=$PLAYLIST_ID" -o "$TMP/page.html"

python3 - "$TMP" "$PLAYLIST_ID" <<'PY'
import json
import re
import subprocess
import sys

tmp, playlist_id = sys.argv[1], sys.argv[2]
html = open(tmp + '/page.html', encoding='utf-8', errors='replace').read()

m = re.search(r'ytInitialData\s*=\s*(\{.*?\});</script>', html, re.S)
if not m:
    sys.exit('could not find ytInitialData - YouTube markup changed')
data = json.loads(m.group(1))

key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
ver = re.search(r'"clientVersion":"([\d.]+)"', html)

videos = []
seen = set()
# A playlist page contains several continuation tokens (shelves, related feeds).
# Only one of them paginates the videos, and it is not always the last one, so
# every new token is queued and tried instead of guessing.
queue = []
tried = set()


def harvest(node):
    """Collect lockupViewModel entries and queue any continuation tokens."""
    if isinstance(node, dict):
        lock = node.get('lockupViewModel')
        if lock and lock.get('contentType') == 'LOCKUP_CONTENT_TYPE_VIDEO':
            vid = lock.get('contentId')
            meta = lock.get('metadata', {}).get('lockupMetadataViewModel', {})
            title = meta.get('title', {}).get('content') or ''
            if vid and vid not in seen:
                seen.add(vid)
                videos.append((vid, title))
        if 'continuationCommand' in node:
            tok = node['continuationCommand'].get('token')
            if tok and tok not in tried and tok not in queue:
                queue.append(tok)
        for value in node.values():
            harvest(value)
    elif isinstance(node, list):
        for value in node:
            harvest(value)


harvest(data)
print('page 1: %d videos' % len(videos))

api_key = key.group(1) if key else None
client_version = ver.group(1) if ver else '2.20240101.00.00'

while queue and api_key:
    token = queue.pop(0)
    tried.add(token)
    body = {
        'context': {'client': {'clientName': 'WEB', 'clientVersion': client_version}},
        'continuation': token,
    }
    out = subprocess.run(
        ['curl', '-s', '-X', 'POST',
         'https://www.youtube.com/youtubei/v1/browse?key=' + api_key,
         '-H', 'Content-Type: application/json',
         '--data-binary', '@-'],
        input=json.dumps(body).encode(), capture_output=True,
    )
    if out.returncode != 0 or not out.stdout:
        continue
    try:
        payload_page = json.loads(out.stdout)
    except ValueError:
        continue
    if isinstance(payload_page, dict) and 'error' in payload_page:
        continue
    before = len(videos)
    harvest(payload_page)
    if len(videos) != before:
        print('continuation: +%d (total %d)' % (len(videos) - before, len(videos)))

records = []
for vid, title in videos:
    if not title:
        continue
    parts = [p.strip() for p in title.split('/')]
    records.append({
        'videoId': vid,
        'title': title,
        'kanji': parts[0] if len(parts) > 1 else '',
        'romaji': parts[-1],
    })

payload = {
    'playlistId': playlist_id,
    'channel': 'KODOKAN',
    'channelId': 'UCtF6tu7GuZYkZzht5MIv8UQ',
    'playlistTitle': 'KODOKAN JUDO 100 Techniques',
    'videoCount': len(records),
    'videos': records,
}
with open('data/source/playlist.json', 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, ensure_ascii=False, indent=1)
print('wrote data/source/playlist.json with %d videos' % len(records))
PY

echo "now run: python3 scripts/build-data.py"
