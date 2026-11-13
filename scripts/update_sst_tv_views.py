#!/usr/bin/env python3
"""Refresh public YouTube lifetime view counts for SST TV."""
import datetime
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "sst-tv/catalogo/index.html"
EXTRA = ROOT / "sst-tv/catalogo/extra.js"
OUTPUT = ROOT / "sst-tv/catalogo/views.json"

def main():
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        sys.exit("Missing YOUTUBE_API_KEY secret")
    html = CATALOG.read_text(encoding="utf-8")
    extra = EXTRA.read_text(encoding="utf-8")
    ids = list(dict.fromkeys(re.findall(r'"id":"([A-Za-z0-9_-]{11})"', html + extra)))
    if not ids:
        sys.exit("No video IDs found; refusing to overwrite existing data")
    counts = {}
    for offset in range(0, len(ids), 50):
        batch = ids[offset:offset+50]
        params = urllib.parse.urlencode({"part": "statistics", "id": ",".join(batch), "key": key})
        request = urllib.request.Request("https://www.googleapis.com/youtube/v3/videos?" + params,
                                         headers={"User-Agent": "LaMovidaSST-TV/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
        for item in payload.get("items", []):
            value = item.get("statistics", {}).get("viewCount")
            if value is not None:
                counts[item["id"]] = int(value)
    if not counts:
        sys.exit("YouTube returned no view counts; keeping prior data")
    result = {"updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
              "source": "YouTube Data API v3", "counts": counts}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Updated {len(counts)} of {len(ids)} videos")

if __name__ == "__main__":
    main()
