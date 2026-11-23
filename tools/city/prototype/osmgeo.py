"""Parse an Overpass JSON extract into projected shapely layers.

Each layer is a list of (geometry, tags) in UTM metres, clipped to the query
box. Buildings and highways come with full geometry (`out geom`); water comes
clipped to the box (`out geom(bbox)`), so split river polygons are rebuilt
from the box edge and the river centreline.
"""
import json
import math
import re

import pyproj
from shapely.geometry import LineString, Polygon, box
from shapely.ops import polygonize, unary_union
from shapely.validation import make_valid

# Highway values that are not ground a player could walk on.
DROP_HIGHWAY = {
    'proposed', 'construction', 'abandoned', 'razed', 'elevator', 'corridor', 'via_ferrata',
    'bus_stop', 'platform', 'emergency_bay', 'rest_area', 'services',
}
# Footpaths: carved like streets, but drawn as their surroundings in the mask.
PATH_HIGHWAY = {'footway', 'path', 'cycleway', 'steps', 'bridleway', 'track'}
# Carved corridor width in metres when no width or lanes tag says otherwise.
DEFAULT_WIDTH = {
    'motorway': 14, 'trunk': 12, 'primary': 11, 'secondary': 10, 'tertiary': 8,
    'motorway_link': 7, 'trunk_link': 7, 'primary_link': 7, 'secondary_link': 7,
    'tertiary_link': 6, 'residential': 7, 'unclassified': 6, 'living_street': 6,
    'pedestrian': 6, 'service': 4, 'road': 6, 'busway': 7, 'footway': 3, 'path': 2.5,
    'cycleway': 2.5, 'steps': 3, 'track': 3, 'bridleway': 2.5,
}
GREEN = (
    ('leisure', 'park'), ('leisure', 'garden'), ('landuse', 'grass'), ('landuse', 'forest'),
    ('landuse', 'meadow'), ('landuse', 'recreation_ground'), ('landuse', 'village_green'),
    ('natural', 'wood'), ('natural', 'scrub'), ('natural', 'grassland'),
)
LAYERS = (
    'building', 'water', 'road', 'path', 'pedestrian', 'crossing', 'bridge_road', 'plaza',
    'park', 'tram', 'bridge_area', 'river_line',
)


def utm_for(lon, lat):
    zone = int(math.floor((lon + 180) / 6)) + 1
    epsg = (32600 if lat >= 0 else 32700) + zone
    return epsg, pyproj.Transformer.from_crs(4326, epsg, always_xy=True)


def num(value):
    if value is None:
        return None
    match = re.match(r'^\s*(-?[0-9]+(?:[.,][0-9]+)?)', str(value))
    return float(match.group(1).replace(',', '.')) if match else None


def runs(geom_list, tr):
    """Contiguous coordinate runs (a clipped geometry contains nulls)."""
    out, cur = [], []
    for p in geom_list or []:
        if p is None:
            if len(cur) >= 2:
                out.append(cur)
            cur = []
        else:
            cur.append(tr.transform(p['lon'], p['lat']))
    if len(cur) >= 2:
        out.append(cur)
    return out


def closed(ring):
    return len(ring) >= 4 and abs(ring[0][0] - ring[-1][0]) < 1e-6 and abs(ring[0][1] - ring[-1][1]) < 1e-6


def _noded(lines):
    merged = unary_union(lines)
    return list(getattr(merged, 'geoms', [merged]))


def faces_from_lines(lines, clip, river_lines):
    """A clipped water polygon: split the box by its boundary lines and keep the
    faces a river centreline runs through."""
    if not lines or river_lines is None or river_lines.is_empty:
        return Polygon()
    merged = unary_union([line.intersection(clip) for line in lines] + [clip.exterior])
    keep = [f for f in polygonize(merged) if f.buffer(-1).intersects(river_lines)]
    return unary_union(keep) if keep else Polygon()


def assemble_area(el, tr, clip, river_lines=None):
    """Polygon(s) for an area way or multipolygon relation, clipped to `clip`."""
    if el['type'] == 'way':
        rs = runs(el.get('geometry'), tr)
        if len(rs) == 1 and closed(rs[0]):
            return make_valid(Polygon(rs[0])).intersection(clip)
        return faces_from_lines([LineString(r) for r in rs], clip, river_lines)
    outers, inners, partial = [], [], False
    for member in el.get('members', []):
        if member.get('type') != 'way':
            continue
        rs = runs(member.get('geometry'), tr)
        geom = member.get('geometry') or []
        if len(rs) != 1 or any(p is None for p in geom):
            partial = True
        for r in rs:
            (inners if member.get('role') == 'inner' else outers).append(LineString(r))
    if not partial:
        # Members are joined by noding first: a relation's outer ring is often
        # split across many ways (the Sagrada Familia has 26 outer members).
        outer = unary_union(list(polygonize(_noded(outers)))) if outers else Polygon()
        inner = unary_union(list(polygonize(_noded(inners)))) if inners else Polygon()
        if not outer.is_empty:
            return make_valid(outer.difference(inner)).intersection(clip)
    return faces_from_lines(outers + inners, clip, river_lines)


def clip_box(bbox_swne, tr, margin=5.0):
    """The largest UTM rectangle inside the lat/lon query box, less a margin."""
    s, w, n, e = bbox_swne
    sw, nw = tr.transform(w, s), tr.transform(w, n)
    se, ne = tr.transform(e, s), tr.transform(e, n)
    return box(max(sw[0], nw[0]) + margin, max(sw[1], se[1]) + margin,
               min(se[0], ne[0]) - margin, min(nw[1], ne[1]) - margin)


def is_building(tags):
    value = tags.get('building')
    if not value or value in ('no', 'roof'):
        return False
    if tags.get('location') == 'underground' or (num(tags.get('layer')) or 0) < 0:
        return False
    # Memorials stay off the board (the plan's licensing and ethics rule).
    return tags.get('historic') != 'memorial' and tags.get('man_made') != 'stele'


def is_green(tags):
    return any(tags.get(k) == v for k, v in GREEN)


def load_layers(path, bbox_swne, floors=None):
    """Projected layers for the extract at `path`, queried with `bbox_swne`.
    `floors` gives a minimum carved width in metres per street layer."""
    with open(path, encoding='utf8') as handle:
        doc = json.load(handle)
    s, w, n, e = bbox_swne
    epsg, tr = utm_for((w + e) / 2, (s + n) / 2)
    clip = clip_box(bbox_swne, tr)
    els = [el for el in doc['elements'] if el['type'] in ('way', 'relation')]
    layers = {k: [] for k in LAYERS}
    for el in els:
        if el['type'] == 'way' and el.get('tags', {}).get('waterway') == 'river':
            for r in runs(el.get('geometry'), tr):
                layers['river_line'].append((LineString(r), el['tags']))
    river_lines = unary_union([g for g, _ in layers['river_line']]) if layers['river_line'] else None
    for el in els:
        tags = el.get('tags', {})
        ident = {'osm_type': el['type'], 'osm_id': el['id']}
        if is_building(tags):
            add_area(layers['building'], el, tr, clip, tags, ident)
            continue
        if tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank' or tags.get('water') == 'river':
            if not (el['type'] == 'way' and tags.get('waterway') == 'river'):
                add_area(layers['water'], el, tr, clip, tags, ident, river_lines)
            continue
        highway = tags.get('highway')
        if highway and el['type'] == 'way' and highway not in DROP_HIGHWAY:
            add_highway(layers, el, tr, clip, tags, highway, floors or {})
            continue
        if tags.get('railway') == 'tram' and el['type'] == 'way':
            if tags.get('tunnel') in (None, 'no'):
                for r in runs(el.get('geometry'), tr):
                    line = LineString(r).intersection(clip)
                    if not line.is_empty:
                        layers['tram'].append((line, tags))
            continue
        if tags.get('man_made') == 'bridge':
            add_area(layers['bridge_area'], el, tr, clip, tags, ident)
            continue
        if tags.get('place') == 'square':
            add_area(layers['plaza'], el, tr, clip, tags, ident)
            continue
        if is_green(tags):
            add_area(layers['park'], el, tr, clip, tags, ident)
    return {'epsg': epsg, 'tr': tr, 'clip': clip, 'layers': layers,
            'osm_base': doc.get('osm3s', {}).get('timestamp_osm_base')}


def add_area(target, el, tr, clip, tags, ident, river_lines=None):
    try:
        geom = assemble_area(el, tr, clip, river_lines)
    except Exception:  # noqa: BLE001 - a broken outline is skipped, never fatal
        geom = Polygon()
    if not geom.is_empty:
        target.append((geom, {**tags, **ident}))


def add_highway(layers, el, tr, clip, tags, highway, floors):
    if tags.get('tunnel') in ('yes', 'culvert', 'building_passage') or tags.get('indoor') == 'yes':
        return
    if (num(tags.get('layer')) or 0) < 0 and tags.get('bridge') in (None, 'no'):
        return
    rs = runs(el.get('geometry'), tr)
    if tags.get('area') == 'yes' and rs and closed(rs[0]):
        geom = make_valid(Polygon(rs[0])).intersection(clip)
        if not geom.is_empty:
            layers['plaza'].append((geom, tags))
        return
    width = num(tags.get('width')) or num(tags.get('est_width'))
    if width is None and num(tags.get('lanes')):
        width = num(tags.get('lanes')) * 3.25 + 2
    if width is None:
        width = DEFAULT_WIDTH.get(highway, 4)
    width = max(2.0, min(width, 30.0))
    if tags.get('bridge') not in (None, 'no'):
        target = 'bridge_road'
        if highway not in PATH_HIGHWAY:
            width = max(width, floors.get('bridge_road', 0))
    elif tags.get('footway') == 'crossing' or tags.get('path') == 'crossing':
        target = 'crossing'
    elif highway == 'pedestrian':
        target = 'pedestrian'
    elif highway in PATH_HIGHWAY:
        target = 'path'
    else:
        target = 'road'
    if target in ('road', 'pedestrian'):
        width = max(width, floors.get(target, 0))
    for r in rs:
        geom = LineString(r).buffer(width / 2, cap_style=2).intersection(clip)
        if not geom.is_empty:
            layers[target].append((geom, tags))
