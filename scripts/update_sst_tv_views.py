#!/usr/bin/env python3
"""Refresh public YouTube lifetime view counts for SST TV."""
import datetime
import json
import os
import pathlib
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "sst-tv/catalogo/index.html"
EXTRA = ROOT / "sst-tv/catalogo/extra.js"
OUTPUT = ROOT / "sst-tv/catalogo/views.json"
VISIBILITY = ROOT / "sst-tv/catalogo/visibilidad.json"


def youtube_get(resource, **params):
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        sys.exit("Missing YOUTUBE_API_KEY secret")
    query = urllib.parse.urlencode({**params, "key": key})
    request = urllib.request.Request("https://www.googleapis.com/youtube/v3/" + resource + "?" + query,
                                     headers={"User-Agent": "LaMovidaSST-TV/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def normalize(text):
    value = unicodedata.normalize("NFKD", str(text or "").casefold())
    return "".join(char for char in value if not unicodedata.combining(char))


def playlist_exclusions(channel_id, catalog_ids):
    """Resolve publicly accessible excluded playlists by title or ID."""
    settings = json.loads(VISIBILITY.read_text(encoding="utf-8"))
    hidden_config = settings.get("playlistsOcultas", {})
    title_rules = hidden_config.get("reglasDeTitulo", [])
    explicit_ids = set(hidden_config.get("ids", []))
    explicit_videos = set(settings.get("videosOcultos", []))
    matches = []
    page_token = None
    while True:
        params = {"part": "snippet", "channelId": channel_id, "maxResults": 50}
        if page_token:
            params["pageToken"] = page_token
        page = youtube_get("playlists", **params)
        for item in page.get("items", []):
            playlist_id = item["id"]
            title = item.get("snippet", {}).get("title", "")
            norm_title = normalize(title)
            by_rule = any(all(normalize(term) in norm_title for term in group) for group in title_rules)
            if by_rule or playlist_id in explicit_ids:
                matches.append({"id": playlist_id, "title": title})
                explicit_ids.discard(playlist_id)
        page_token = page.get("nextPageToken")
        if not page_token:
            break
    for playlist_id in sorted(explicit_ids):
        matches.append({"id": playlist_id, "title": "(ID configurado manualmente)"})
    excluded = set(explicit_videos)
    for playlist in matches:
        page_token = None
        while True:
            params = {"part": "contentDetails", "playlistId": playlist["id"], "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token
            page = youtube_get("playlistItems", **params)
            for item in page.get("items", []):
                video_id = item.get("contentDetails", {}).get("videoId")
                if video_id:
                    excluded.add(video_id)
            page_token = page.get("nextPageToken")
            if not page_token:
                break
    filtered = sorted(excluded.intersection(catalog_ids))
    print(f"Playlist exclusions: {len(matches)} matching playlists; {len(filtered)} catalog videos hidden.")
    if title_rules and not matches:
        print("WARNING: no matching public playlist found. Set its ID in visibilidad.json if unlisted.")
    return matches, filtered


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
    channel_params = urllib.parse.urlencode({"part": "statistics", "forHandle": "movidasst", "key": key})
    channel_request = urllib.request.Request("https://www.googleapis.com/youtube/v3/channels?" + channel_params,
                                            headers={"User-Agent": "LaMovidaSST-TV/1.0"})
    with urllib.request.urlopen(channel_request, timeout=30) as response:
        channel_payload = json.load(response)
    channel_items = channel_payload.get("items", [])
    if not channel_items or "viewCount" not in channel_items[0].get("statistics", {}):
        sys.exit("Could not retrieve official channel lifetime view count; keeping prior data")
    channel_views = int(channel_items[0]["statistics"]["viewCount"])
    excluded_playlists, excluded_video_ids = playlist_exclusions(channel_items[0]["id"], set(ids))
    result = {"channelViews": channel_views, "channelId": channel_items[0]["id"],
              "hiddenPlaylists": excluded_playlists, "hiddenVideoIds": excluded_video_ids,
              "catalogVisibleCount": len(ids) - len(excluded_video_ids), "catalogTotalCount": len(ids),
              "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
              "source": "YouTube Data API v3", "counts": counts}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Updated {len(counts)} of {len(ids)} videos")

if __name__ == "__main__":
    main()
