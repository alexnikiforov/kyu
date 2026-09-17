#!/bin/bash
# Check that every video id referenced in data/techniques.js is still playable.
# Uses YouTube oEmbed (no API key). Network access is done with curl because the
# system python has no SSL certificates on this machine.
#
# Usage:  bash scripts/check-videos.sh

set -u
cd "$(dirname "$0")/.." || exit 1

ids=$(python3 - <<'PY'
import json
raw = open('data/techniques.js', encoding='utf-8').read()
data = json.loads(raw.split('window.KYU_TECHNIQUES = ', 1)[1].rstrip().rstrip(';'))
out = set()
for level in data['levels']:
    for group in level.get('groups', []):
        for t in group['techniques']:
            if t['video']['id']:
                out.add(t['video']['id'])
            if t.get('escapeVideo'):
                out.add(t['escapeVideo'])
print('\n'.join(sorted(out)))
PY
)

total=0
bad=0
for id in $ids; do
  total=$((total + 1))
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$id&format=json")
  if [ "$code" != "200" ]; then
    echo "DEAD ($code): $id"
    bad=$((bad + 1))
  fi
done

echo "checked $total unique videos, $bad dead"
[ "$bad" -eq 0 ] || exit 1
