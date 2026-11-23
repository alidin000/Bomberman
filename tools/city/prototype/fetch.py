"""Fetch one city's OSM extract from the Overpass API, once.

Usage: fetch.py <city> [<city> ...]

Writes tools/city/<city>/osm.json (the raw response) and meta.json (the query,
box and timestamp_osm_base). Cities run one after another with a pause, as
the Overpass usage policy asks; a failed request is retried once after a
longer pause. The committed extract is the input: rebuilding never fetches.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cities  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
ENDPOINT = 'https://overpass-api.de/api/interpreter'
USER_AGENT = 'city-arena-extract/1.0'
PAUSE_S = 20
RETRY_PAUSE_S = 90


def query(bbox):
    bb = ','.join(f'{v:.5f}' for v in bbox)
    # Buildings, streets and trams come whole (out geom), so a footprint that
    # crosses the box edge stays closed; water is clipped to the box, because
    # a river relation runs for kilometres. Green areas, squares and bridges
    # come whole so their outlines assemble.
    return f"""[out:json][timeout:120][bbox:{bb}];
(way["building"];relation["building"];)->.b;
way["highway"]->.h;
way["railway"="tram"]->.t;
(way["natural"="water"];relation["natural"="water"];
 way["waterway"="riverbank"];relation["waterway"="riverbank"];
 way["water"="river"];relation["water"="river"];
 way["waterway"="river"];)->.w;
(way["leisure"~"^(park|garden)$"];relation["leisure"~"^(park|garden)$"];
 way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green)$"];
 relation["landuse"~"^(grass|forest|meadow|recreation_ground|village_green)$"];
 way["natural"~"^(wood|scrub|grassland)$"];relation["natural"~"^(wood|scrub|grassland)$"];
 way["man_made"="bridge"];relation["man_made"="bridge"];
 way["place"="square"];relation["place"="square"];)->.a;
.b out geom;
.h out geom;
.t out geom;
.w out geom({bb});
.a out geom;
"""


def post(q):
    body = urllib.parse.urlencode({'data': q}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={'User-Agent': USER_AGENT})
    started = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.status, resp.read(), round(time.time() - started, 1)


def fetch(city):
    bbox = cities.FETCH_BBOX[city]
    q = query(bbox)
    attempts = []
    for attempt in range(2):
        if attempt:
            time.sleep(RETRY_PAUSE_S)
        try:
            status, raw, seconds = post(q)
            doc = json.loads(raw)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            attempts.append({'error': repr(exc)[:200]})
            print(city, 'attempt failed:', attempts[-1])
            continue
        remark = doc.get('remark')
        attempts.append({'status': status, 'bytes': len(raw), 'seconds': seconds, 'remark': remark})
        if status == 200 and not remark:
            out = REPO / 'tools' / 'city' / city
            out.mkdir(parents=True, exist_ok=True)
            (out / 'osm.json').write_bytes(raw)
            meta_path = out / 'meta.json'
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            meta.update({
                'city': city,
                'source': '© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright',
                'bbox_swne': list(bbox),
                'query': q,
                'endpoint': ENDPOINT,
                'fetched_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'timestamp_osm_base': doc.get('osm3s', {}).get('timestamp_osm_base'),
                'elements': len(doc.get('elements', [])),
                'bytes': len(raw),
            })
            meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n')
            print(city, 'ok', attempts[-1], meta['timestamp_osm_base'])
            return True
        print(city, 'attempt rejected:', attempts[-1])
    return False


def main():
    ok = True
    for index, city in enumerate(sys.argv[1:]):
        if index:
            time.sleep(PAUSE_S)
        ok = fetch(city) and ok
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
