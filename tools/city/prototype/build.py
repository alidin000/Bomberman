"""Build one city arena from its committed OSM extract.

Usage: build.py <map> [--out <dir>] [--extract <osm.json> --bbox <s,w,n,e>]

<map> is a key of cities.CITIES. Reads tools/city/<city>/osm.json and the
query box in its meta.json. Writes the grid and mask, the raw raster, the
overlay image (paths in cities.py) and the transform, signature and changes
records in meta.json, and prints the change counts that
tools/city/<city>/method.md records. --out writes everything into one folder
instead, for trying a crop; --extract and --bbox try another extract.
"""
import argparse
import hashlib
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rasterio import features
from rasterio.transform import Affine
from shapely import affinity
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cities  # noqa: E402
import metrics  # noqa: E402
import osmgeo  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
N = 35
SS = 8                 # supersamples per cell side
SPAWNS = metrics.SPAWNS
ROAD_FLOOR = 0.30      # a cell this much covered by a carved street is floor
SOLID_WALL = 0.50      # else a cell this much building + water is wall
CRATE_SHARE = 0.265    # mean crate share of playable cells on the 7 shipped arenas
SPAWN_SAFE = 2         # no crate within this many steps of a spawn
MAX_OPEN_LINE = 20     # longest crate-free straight line at round start
STREET_LAYERS = ('road', 'path', 'pedestrian', 'crossing', 'bridge_road')
# The plan's width floors, in cells: streets carve at least 2 cells, a road
# bridge at least 3 (a strip 1.6 cells wide always covers 2 cells by ROAD_FLOOR).
STREET_FLOOR = 1.6
BRIDGE_FLOOR = 2.6


def h01(*parts):
    """Deterministic per-cell hash in [0, 1]: the crate order."""
    return int(hashlib.sha256(':'.join(map(str, parts)).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def parse_cells(spec):
    """'x0-x1,y0-y1;x,y' -> [(x, y), ...] (inclusive ranges)."""
    out = []
    for part in spec.split(';'):
        xs, ys = part.strip().split(',')
        x0, x1 = (int(v) for v in (xs.split('-') if '-' in xs else (xs, xs)))
        y0, y1 = (int(v) for v in (ys.split('-') if '-' in ys else (ys, ys)))
        out += [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    return out


# --- transform ---------------------------------------------------------------

class Frame:
    """UTM metres -> board cells: rotate about the anchor, scale, flip y so rows
    run north to south (in the rotated frame), then place the anchor."""

    def __init__(self, anchor_xy, rotation_deg, cell_m, anchor_cell):
        self.ax, self.ay = anchor_xy
        self.rot = rotation_deg
        self.cell = cell_m
        self.cx, self.cy = anchor_cell
        self.bands = []      # dropped water columns, as [x0, x1) in canvas cells
        self.window_x0 = 0   # canvas column of board column 0

    def canvas(self, geom):
        g = affinity.translate(geom, -self.ax, -self.ay)
        if self.rot:
            g = affinity.rotate(g, -self.rot, origin=(0, 0))
        g = affinity.scale(g, 1 / self.cell, -1 / self.cell, origin=(0, 0))
        return affinity.translate(g, self.cx, self.cy)

    def board(self, geom):
        """Canvas cells -> board cells: drop the water bands, then window."""
        g = self.canvas(geom)
        for x0, x1 in sorted(self.bands, reverse=True):
            left = g.intersection(box(-1e6, -1e6, x0, 1e6))
            right = affinity.translate(g.intersection(box(x1, -1e6, 1e6, 1e6)), -(x1 - x0), 0)
            g = unary_union([part for part in (left, right) if not part.is_empty] or [left])
        return affinity.translate(g, -self.window_x0, 0)

    def board_to_utm(self, bx, by):
        """Inverse for points outside the dropped bands (corners, landmarks)."""
        x = bx + self.window_x0
        for x0, x1 in sorted(self.bands):
            if x >= x0:
                x += x1 - x0
        mx, my = (x - self.cx) * self.cell, -(by - self.cy) * self.cell
        r = math.radians(self.rot)
        return (self.ax + mx * math.cos(r) - my * math.sin(r), self.ay + mx * math.sin(r) + my * math.cos(r))


def coverage(geoms, x0=0, cols=N, rows=N):
    """Share of each cell covered by `geoms` (board or canvas cells)."""
    geoms = [g for g in geoms if not g.is_empty]
    if not geoms:
        return np.zeros((rows, cols))
    arr = features.rasterize([(g, 1) for g in geoms], out_shape=(rows * SS, cols * SS),
                             transform=Affine(1 / SS, 0, x0, 0, 1 / SS, 0), fill=0, dtype='uint8')
    return arr.reshape(rows, SS, cols, SS).mean(axis=(1, 3))


def find_water_bands(frame, water, spec):
    """Columns of the river to drop so `keep` remain, with the first kept column
    landing on board column `at` (a documented piecewise x mapping)."""
    x0, cols = -60, 160
    wcov = coverage([frame.canvas(g) for g in water], x0, cols)
    river = [x0 + i for i in range(cols) if (wcov[:, i] >= 0.5).mean() >= 0.75]
    runs, cur = [], []
    for c in river:
        if cur and c != cur[-1] + 1:
            runs.append(cur)
            cur = []
        cur.append(c)
    if cur:
        runs.append(cur)
    main = max(runs, key=len)
    k0 = (len(main) - spec['keep']) // 2
    kept = main[k0:k0 + spec['keep']]
    bands = []
    if main[0] < kept[0]:
        bands.append((main[0], kept[0]))
    if kept[-1] < main[-1]:
        bands.append((kept[-1] + 1, main[-1] + 1))
    dropped_before_kept = kept[0] - main[0]
    window_x0 = kept[0] - dropped_before_kept - spec['at']
    return bands, window_x0, {'river_columns_uniform': len(main), 'kept': spec['keep'],
                              'river_m_uniform': round(len(main) * frame.cell)}


# --- gameplay pass -------------------------------------------------------------

def bfs01(g, start, targets, cost):
    """Cheapest path from `start` to any of `targets`; cost(x, y) is 0, 1 or None."""
    INF = 10 ** 9
    dist, prev, dq = {start: 0}, {}, deque([start])
    while dq:
        x, y = dq.popleft()
        if (x, y) in targets:
            path, cur = [], (x, y)
            while cur in prev:
                path.append(cur)
                cur = prev[cur]
            return path
        for dx, dy in metrics.N4:
            nx, ny = x + dx, y + dy
            if not (0 < nx < N - 1 and 0 < ny < N - 1):
                continue
            w = cost(nx, ny)
            if w is None:
                continue
            nd = dist[(x, y)] + w
            if nd < dist.get((nx, ny), INF):
                dist[(nx, ny)] = nd
                prev[(nx, ny)] = (x, y)
                (dq.appendleft if w == 0 else dq.append)((nx, ny))
    return None


def near_spawn(x, y):
    return any(abs(x - sx) + abs(y - sy) <= SPAWN_SAFE for sx, sy in SPAWNS)


def main_region(g):
    comps, cid = metrics.components(g, lambda c: c != 'W')
    main = max(range(len(comps)), key=lambda i: comps[i])
    return {c for c, i in cid.items() if i == main}


def longest_open_run(g):
    """(length, cells) of the longest crate-free straight line of floor."""
    best = (0, [])
    for horizontal in (True, False):
        for a in range(N):
            run = []
            for b in range(N + 1):
                x, y = (b, a) if horizontal else (a, b)
                if b < N and g[y][x] == ' ':
                    run.append((x, y))
                else:
                    if len(run) > best[0]:
                        best = (len(run), run)
                    run = []
    return best


def gameplay_pass(raw, water, key, log):
    """The plan's deterministic pass on a raw grid (rows of ' '/'W')."""
    g = [row[:] for row in raw]
    changed = log['cells']

    def put(x, y, c, step):
        if g[y][x] != c:
            changed.setdefault(step, []).append((x, y))
            g[y][x] = c

    for y in range(N):
        for x in range(N):
            if x in (0, N - 1) or y in (0, N - 1):
                put(x, y, 'W', 'border')
    # Open each spawn's plus shape (never water: move the crop instead), then
    # link it to the main region through the fewest walls.
    for sx, sy in SPAWNS:
        for dx, dy in metrics.PLUS:
            x, y = sx + dx, sy + dy
            if 0 < x < N - 1 and 0 < y < N - 1:
                if water[y][x]:
                    raise SystemExit(f'spawn ({sx},{sy}) touches water at ({x},{y}): move the crop')
                put(x, y, ' ', 'spawn_plus')
    for s in SPAWNS:
        region = main_region(g)
        if s in region:
            continue
        path = bfs01(g, s, region, lambda x, y: None if water[y][x] else (1 if g[y][x] == 'W' else 0))
        if path is None:
            raise SystemExit(f'spawn {s} cannot reach the main region without crossing water')
        for x, y in path:
            put(x, y, ' ', 'spawn_link')
    region = main_region(g)
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            if g[y][x] != 'W' and (x, y) not in region:
                put(x, y, 'W', 'pocket_fill')
    playable = sum(1 for y in range(1, N - 1) for x in range(1, N - 1) if g[y][x] != 'W')
    eligible = sorted((h01(key, x, y), x, y) for y in range(1, N - 1) for x in range(1, N - 1)
                      if g[y][x] == ' ' and not near_spawn(x, y))
    for _, x, y in eligible[:round(CRATE_SHARE * playable)]:
        put(x, y, 'B', 'crates')
    # All spawns share one crate-free lane network at round start.
    for s in SPAWNS[1:]:
        reach = metrics.bfs(g, SPAWNS[0], lambda c: c == ' ')
        if s in reach:
            continue
        path = bfs01(g, s, set(reach), lambda x, y: None if g[y][x] == 'W' else (1 if g[y][x] == 'B' else 0))
        for x, y in path or []:
            if g[y][x] == 'B':
                put(x, y, ' ', 'crates_cleared')
    # Crates furnish open squares: no crate-free straight line above the cap,
    # and no line crate may cut the spawns' lane network.
    def network_holds():
        reach = metrics.bfs(g, SPAWNS[0], lambda c: c == ' ')
        return all(s in reach for s in SPAWNS[1:])

    while True:
        length, run = longest_open_run(g)
        if length <= MAX_OPEN_LINE:
            break
        options = sorted((h01(key, 'line', x, y), x, y) for x, y in run[3:-3] if not near_spawn(x, y))
        for _, x, y in options:
            g[y][x] = 'B'
            if network_holds():
                g[y][x] = ' '
                put(x, y, 'B', 'line_crates')
                break
            g[y][x] = ' '
        else:
            break
    return g


# --- landmark and block rules ---------------------------------------------------

def landmark_rule(rule, centre, lm_cov, put):
    """A solid landmark becomes a one-cell elliptical ring of `size` cells, centred
    on its OSM footprint, with openings; its inside is open floor."""
    cx, cy = centre
    a, b = rule['size'][0] / 2, rule['size'][1] / 2
    ellipse = {(x, y) for y in range(N) for x in range(N)
               if ((x + 0.5 - cx) / a) ** 2 + ((y + 0.5 - cy) / b) ** 2 <= 1}
    ring = {(x, y) for x, y in ellipse
            if any((x + dx, y + dy) not in ellipse for dx in (-1, 0, 1) for dy in (-1, 0, 1))}
    walls = ring - set(parse_cells(rule['openings']))
    footprint = ellipse | {(x, y) for y in range(N) for x in range(N) if lm_cov[y, x] >= 0.5}
    for x, y in sorted(footprint):
        put(x, y, 'W' if (x, y) in walls else ' ', 'landmark_rule')
    return walls, footprint - walls


def side_gates(cells, count):
    """`count` two-cell gates spread evenly along one side's cells."""
    gates = set()
    for i in range(count):
        mid = int((i + 1) * len(cells) / (count + 1))
        gates |= set(cells[max(0, mid - 1):mid + 1])
    return gates


def hollow_block(block, raw, put, solid_corners=False):
    """A city block keeps its outline walls, with the corners as 2x2 squares and
    two-cell gates along each side; its inside becomes open floor that the
    crate pass furnishes. Sides on the board edge have no outline and leave a
    lane along the border, and cells that were open in the raw raster stay
    open (so a chamfered corner stays chamfered) unless `solid_corners`."""
    spec = block if isinstance(block, dict) else {'cells': block}
    rect = parse_cells(spec['cells'])
    (x0, y0), (x1, y1) = rect[0], rect[-1]
    real = {'n': y0 > 1, 's': y1 < N - 2, 'w': x0 > 1, 'e': x1 < N - 2}
    sides = {'n': [(x, y0) for x in range(x0, x1 + 1)], 's': [(x, y1) for x in range(x0, x1 + 1)],
             'w': [(x0, y) for y in range(y0, y1 + 1)], 'e': [(x1, y) for y in range(y0, y1 + 1)]}
    walls, gates, corners = set(), set(), set()
    for side, cells in sides.items():
        if not real[side]:
            continue
        walls |= set(cells)
        count = spec.get('gates', 0 if len(cells) < 6 else 1 if len(cells) < 13 else 2)
        inner = cells[2:-2] if len(cells) > 4 else []
        gates |= side_gates(inner, count) if inner else set()
    for (cx, dx, sx) in ((x0, 1, 'w'), (x1, -1, 'e')):
        for (cy, dy, sy) in ((y0, 1, 'n'), (y1, -1, 's')):
            if real[sx] and real[sy]:
                corners |= {(cx, cy), (cx + dx, cy), (cx, cy + dy), (cx + dx, cy + dy)}
    walls = (walls | corners) - gates
    # Where the board edge cuts a block, a lane stays open along the border.
    lane = {'n': lambda x, y: y == 1, 's': lambda x, y: y == N - 2,
            'w': lambda x, y: x == 1, 'e': lambda x, y: x == N - 2}
    walls = {(x, y) for x, y in walls if not any(not real[k] and lane[k](x, y) for k in lane)}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            solid = solid_corners and (x, y) in corners
            put(x, y, 'W' if (x, y) in walls and (raw[y][x] == 'W' or solid) else ' ', 'blocks')


# --- mask ----------------------------------------------------------------------

def make_mask(grid, cov, water, signature, arena_floor, decks):
    """Render classes: on W cells e/b/w/m, on floor and crates ./r/p/g/d/x/t."""
    mask = []
    for y in range(N):
        row = []
        for x in range(N):
            c = grid[y][x]
            if x in (0, N - 1) or y in (0, N - 1):
                row.append('e')
            elif c == 'W':
                row.append('m' if (x, y) in signature else 'w' if water[y][x] else 'b')
            elif (x, y) in arena_floor:
                row.append('p')
            elif (x, y) in decks or cov['bridge_area'][y, x] >= 0.4 or cov['bridge_road'][y, x] >= 0.3:
                row.append('d')
            elif cov['tram'][y, x] > 0:
                row.append('t')
            elif cov['crossing'][y, x] > 0.1:
                row.append('x')
            elif cov['pedestrian'][y, x] + cov['plaza'][y, x] >= 0.4:
                row.append('p')
            elif cov['park'][y, x] >= 0.4:
                row.append('g')
            elif cov['road'][y, x] >= 0.3:
                row.append('r')
            else:
                row.append('.')
        mask.append(row)
    return mask


def tram_cells(lines):
    """Cells a tram line runs through (lines burn their supersamples)."""
    lines = [g for g in lines if not g.is_empty]
    if not lines:
        return np.zeros((N, N))
    arr = features.rasterize([(g, 1) for g in lines], out_shape=(N * SS, N * SS),
                             transform=Affine(1 / SS, 0, 0, 0, 1 / SS, 0), fill=0, dtype='uint8')
    return arr.reshape(N, SS, N, SS).max(axis=(1, 3)).astype(float)


# --- overlay -----------------------------------------------------------------

def render_overlay(path, loc, grid, mask, title):
    """The grid over the OSM footprints, with the OSM credit as its caption."""
    px = 16
    cap = 26
    img = Image.new('RGB', (N * px, N * px + cap), (236, 232, 220))
    d = ImageDraw.Draw(img, 'RGBA')

    def poly(geom, fill):
        for p in getattr(geom, 'geoms', [geom]):
            if p.geom_type != 'Polygon' or p.is_empty:
                continue
            d.polygon([(x * px, y * px) for x, y in p.exterior.coords], fill=fill)
            for hole in p.interiors:
                d.polygon([(x * px, y * px) for x, y in hole.coords], fill=(236, 232, 220))

    for key, col in (('park', (170, 210, 150)), ('plaza', (225, 215, 195)), ('pedestrian', (225, 215, 195)),
                     ('water', (120, 170, 220)), ('road', (255, 255, 255)), ('path', (250, 250, 245)),
                     ('crossing', (255, 255, 255)), ('bridge_road', (255, 255, 255)),
                     ('bridge_area', (200, 170, 120, 170)), ('building', (125, 115, 110))):
        for geom, _ in loc[key]:
            poly(geom, col)
    for geom, _ in loc['tram']:
        for line in getattr(geom, 'geoms', [geom]):
            if line.geom_type == 'LineString':
                d.line([(x * px, y * px) for x, y in line.coords], fill=(200, 40, 40), width=2)
    for y in range(N):
        for x in range(N):
            c, m = grid[y][x], mask[y][x]
            col = None
            if c == 'W':
                col = (190, 30, 30, 150) if m == 'm' else (20, 60, 140, 110) if m == 'w' else (25, 25, 25, 125)
            elif c == 'B':
                col = (205, 120, 40, 165)
            if col:
                d.rectangle([x * px + 3, y * px + 3, x * px + px - 4, y * px + px - 4], fill=col)
    for sx, sy in SPAWNS:
        d.ellipse([sx * px + 2, sy * px + 2, sx * px + px - 2, sy * px + px - 2], outline=(220, 0, 160), width=3)
    for i in range(N + 1):
        d.line([(i * px, 0), (i * px, N * px)], fill=(0, 0, 0, 40))
        d.line([(0, i * px), (N * px, i * px)], fill=(0, 0, 0, 40))
    d.rectangle([0, N * px, N * px, N * px + cap], fill=(255, 255, 255))
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 11)
    except OSError:
        font = ImageFont.load_default()
    d.text((6, N * px + 5), f'{title}. Map data © OpenStreetMap contributors, ODbL', fill=(0, 0, 0), font=font)
    img = img.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
    img.save(path, optimize=True)


# --- build -------------------------------------------------------------------

def find_landmark(layers, ref):
    osm_type, osm_id = ref
    hits = [g for k in ('building', 'bridge_area') for g, t in layers[k]
            if t.get('osm_type') == osm_type and t.get('osm_id') == osm_id]
    if not hits:
        raise SystemExit(f'landmark {osm_type} {osm_id} is missing from the extract')
    return unary_union(hits)


def rows_text(rows):
    return '\n'.join(''.join(r) for r in rows) + '\n'


def rasterize(geo, frame):
    """Board-cell layers, class coverage, the raw grid and its water cells."""
    loc = {k: [(frame.board(g), t) for g, t in v] for k, v in geo['layers'].items() if k != 'river_line'}
    frame_box = box(0, 0, N, N)
    cov = {k: coverage([g.intersection(frame_box) for g, _ in loc[k]]) for k in loc if k != 'tram'}
    cov['tram'] = tram_cells([g for g, _ in loc['tram']])
    street = np.clip(sum(cov[k] for k in STREET_LAYERS), 0, 1)
    solid = cov['building'] + cov['water']
    raw = [[' ' if street[y, x] >= ROAD_FLOOR else 'W' if solid[y, x] >= SOLID_WALL else ' '
            for x in range(N)] for y in range(N)]
    water = [[raw[y][x] == 'W' and cov['water'][y, x] >= max(0.25, cov['building'][y, x])
              for x in range(N)] for y in range(N)]
    return loc, cov, raw, water


def switched_cells(raw, grid):
    """Interior cells switched between wall and floor: crates counted as floor,
    and with the cells that end up as crates left out."""
    interior = [(x, y) for y in range(1, N - 1) for x in range(1, N - 1)]
    changed = [(x, y) for x, y in interior if (raw[y][x] == 'W') != (grid[y][x] == 'W')]
    return len(changed), sum(1 for x, y in changed if grid[y][x] != 'B')


def build_mirror(map_id, cfg, out_dir):
    """The control: a shipped village arena, mirrored, with a plain mask."""
    rows = metrics.read_map(REPO / 'public' / 'maps' / f"{cfg['mirror']}.txt")
    grid = [row[::-1] for row in rows] if cfg['axis'] == 'x' else rows[::-1]
    mask = [['e' if x in (0, N - 1) or y in (0, N - 1) else 'b' if c == 'W' else '.'
             for x, c in enumerate(row)] for y, row in enumerate(grid)]
    paths = cfg['outputs']
    for name, rows_out in (('grid', grid), ('mask', mask)):
        path = Path(out_dir) / f'{map_id}.{name}.txt' if out_dir else REPO / paths[name]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rows_text(rows_out))
    m = metrics.measure(grid)
    print(json.dumps({'map': map_id, 'mirror': cfg['mirror'], 'axis': cfg['axis']}))
    print('  metrics:', json.dumps({k: m[k] for k in ('playable_pct', 'walls_pct', 'articulation_points',
                                                       'dead_ends', 'longest_line_opening', 'opening_reach')}))
    return {'map': map_id, 'metrics': m}


def build(map_id, out_dir=None, extract=None, bbox=None):
    cfg = cities.CITIES[map_id]
    if cfg.get('mirror'):
        return build_mirror(map_id, cfg, out_dir)
    city_dir = REPO / 'tools' / 'city' / cfg['city']
    meta_path = city_dir / 'meta.json'
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    bbox = bbox or meta['bbox_swne']
    extract = extract or city_dir / 'osm.json'
    cell = cfg['cell_m']
    floors = {'road': STREET_FLOOR * cell, 'pedestrian': STREET_FLOOR * cell, 'bridge_road': BRIDGE_FLOOR * cell}
    geo = osmgeo.load_layers(extract, bbox, floors)
    landmark = find_landmark(geo['layers'], cfg['landmark'])
    frame = Frame((landmark.centroid.x, landmark.centroid.y), cfg['rotation_deg'], cell, cfg['anchor_cell'])
    water_info = None
    if cfg.get('water'):
        frame.bands, frame.window_x0, water_info = find_water_bands(
            frame, [g for g, _ in geo['layers']['water']], cfg['water'])
    if not geo['clip'].contains(board_outline(frame)):
        if not out_dir:
            raise SystemExit('the board reaches outside the extract: fetch a bigger box')
        print('warning: the board reaches outside the extract')
    loc, cov, raw, water = rasterize(geo, frame)
    log = {'cells': {}}
    g = [row[:] for row in raw]

    def put(x, y, c, step):
        if g[y][x] != c:
            log['cells'].setdefault(step, []).append((x, y))
            g[y][x] = c

    signature, arena_floor = set(), set()
    if cfg.get('landmark_rule'):
        signature, arena_floor = landmark_rule(cfg['landmark_rule'], cfg['anchor_cell'],
                                               coverage([frame.board(landmark)]), put)
    for block in cfg.get('blocks', []):
        hollow_block(block, raw, put, cfg.get('solid_corners', False))
    decks = set()
    for edit in cfg.get('edits', []):
        for x, y in parse_cells(edit['cells']):
            if edit['set'] != 'W' and water[y][x]:
                water[y][x] = False  # a deck or crossing over the river
                decks.add((x, y))
            elif edit['set'] == 'W' and edit.get('water'):
                water[y][x] = True
            put(x, y, edit['set'], 'hand')
    played = gameplay_pass(g, water, map_id, log)
    # Signature structure drawn on wall cells, such as a bridge's pylons.
    structure = cfg['signature'].get('structure')
    for x, y in parse_cells(structure) if structure else []:
        if played[y][x] != 'W':
            raise SystemExit(f'signature structure cell ({x},{y}) is not a wall')
        signature.add((x, y))
    mask = make_mask(played, cov, water, signature, arena_floor, decks)
    m = metrics.measure(played, exempt=metrics.exempt_cells(mask))
    switched, switched_no_crates = switched_cells(raw, played)
    # The same count against a raster without the width floors, for comparison.
    plain = osmgeo.load_layers(extract, bbox)
    switched_plain, _ = switched_cells(rasterize(plain, frame)[2], played)
    summary = {'map': map_id, 'counts': {k: len(v) for k, v in log['cells'].items()},
               'switched_wall_floor': switched, 'switched_excluding_crate_cells': switched_no_crates,
               'switched_vs_raster_without_width_floors': switched_plain,
               'switched_pct_of_interior': round(100 * switched / (N - 2) ** 2, 1),
               'water': water_info, 'metrics': m,
               'cells': {k: ';'.join(f'{x},{y}' for x, y in v) for k, v in log['cells'].items()
                         if k not in ('border', 'crates')}}
    outputs = cfg['outputs']
    if out_dir:
        Path(out_dir).mkdir(parents=True, exist_ok=True)

        def dest(name):
            return Path(out_dir) / f'{map_id}.{name}{Path(outputs[name]).suffix}'
    else:
        def dest(name):
            return REPO / outputs[name]
    dest('grid').write_text(rows_text(played))
    dest('mask').write_text(rows_text(mask))
    dest('raw').write_text(rows_text(raw))
    if 'overlay' in outputs:
        render_overlay(dest('overlay'), loc, played, mask, cfg['title'])
        for extra in outputs.get('overlay_copies', []):
            if not out_dir:
                (REPO / extra).write_bytes(dest('overlay').read_bytes())
    transform = transform_record(frame, geo, landmark, cfg, water_info)
    record = {'transform': transform, 'signature': signature_record(cfg, frame, landmark, signature),
              'changes': {k: summary[k] for k in ('counts', 'switched_wall_floor', 'switched_excluding_crate_cells',
                                                   'switched_vs_raster_without_width_floors')}}
    if out_dir:
        (Path(out_dir) / f'{map_id}.summary.json').write_text(
            json.dumps({**summary, **record}, indent=1, ensure_ascii=False))
    else:
        if outputs['meta_key']:
            meta[outputs['meta_key']] = record
        else:
            meta.update(record)
        meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n')
    print(json.dumps({k: summary[k] for k in ('map', 'counts', 'switched_wall_floor', 'switched_excluding_crate_cells',
                                               'switched_vs_raster_without_width_floors', 'switched_pct_of_interior')},
                     ensure_ascii=False))
    pick = ('playable_pct', 'walls_pct', 'crate_share_of_playable_pct', 'components', 'spawns_share_component',
            'articulation_points', 'ap_pct_of_playable', 'dead_ends', 'longest_line_struct', 'longest_line_opening',
            'opening_reach')
    print('  metrics:', json.dumps({k: m[k] for k in pick}), 'width1', m['width_hist_pct']['1'],
          'blobs', json.dumps(m['wall_shapes']))
    return summary


def signature_record(cfg, frame, landmark, ring):
    """Where the map's signature is: on the board (its cells) or on the skyline."""
    sig = dict(cfg['signature'])
    if sig['on'] == 'skyline' and sig.get('from_extract'):
        b = frame.board(landmark)
        sig['board_centroid'] = [round(b.centroid.x, 2), round(b.centroid.y, 2)]
        sig['board_bounds'] = [round(v, 2) for v in b.bounds]
        del sig['from_extract']
    def cells_text(cells):
        return ';'.join(f'{x},{y}' for x, y in sorted(cells, key=lambda c: (c[1], c[0])))

    if sig['on'] == 'board':
        sig['cells'] = cells_text(ring if sig['cells'] == 'ring' else parse_cells(sig['cells']))
    if sig.get('structure'):
        sig['structure'] = cells_text(parse_cells(sig['structure']))
    return sig


def board_outline(frame):
    """The board's footprint in UTM metres (for the extract coverage check)."""
    return Polygon([frame.board_to_utm(x, y) for x, y in ((0, 0), (N, 0), (N, N), (0, N))])


def lonlat(geo, x, y):
    lon, lat = geo['tr'].transform(x, y, direction='INVERSE')
    return [round(lon, 7), round(lat, 7)]


def transform_record(frame, geo, landmark, cfg, water_info):
    corners = {name: lonlat(geo, *frame.board_to_utm(bx, by))
               for name, (bx, by) in (('top_left', (0, 0)), ('top_right', (N, 0)),
                                       ('bottom_right', (N, N)), ('bottom_left', (0, N)))}
    rec = {
        'epsg': geo['epsg'],
        'cell_m': frame.cell,
        'rotation_deg': frame.rot,
        'up_bearing_deg': round((-frame.rot) % 360, 1),
        'right_bearing_deg': round((90 - frame.rot) % 360, 1),
        'anchor': {'what': cfg['anchor_what'], 'osm': f"{cfg['landmark'][0]} {cfg['landmark'][1]}",
                   'utm': [round(landmark.centroid.x, 1), round(landmark.centroid.y, 1)],
                   'lonlat': lonlat(geo, landmark.centroid.x, landmark.centroid.y),
                   'board_cell': list(cfg['anchor_cell']) if not water_info else None},
        'crop_origin': {'what': 'top-left corner of cell (0,0)', 'lonlat': corners['top_left'],
                        'utm': [round(v, 1) for v in frame.board_to_utm(0, 0)]},
        'board_corners_lonlat': corners,
        'water_compression': None,
    }
    if water_info:
        rec['water_compression'] = {
            **water_info,
            'kept_board_columns': [cfg['water']['at'], cfg['water']['at'] + cfg['water']['keep'] - 1],
            'dropped_m_east_of_anchor': [[round((x0 - frame.cx) * frame.cell, 1), round((x1 - frame.cx) * frame.cell, 1)]
                                          for x0, x1 in frame.bands],
            'note': 'whole river columns are deleted in the rotated frame; everything east of a '
                    'deleted band moves west by its width',
        }
        rec['anchor']['board_cell_before_compression'] = list(cfg['anchor_cell'])
        rec['anchor']['window_x0'] = frame.window_x0
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('map', choices=sorted(cities.CITIES))
    ap.add_argument('--out')
    ap.add_argument('--extract')
    ap.add_argument('--bbox')
    a = ap.parse_args()
    bbox = [float(v) for v in a.bbox.split(',')] if a.bbox else None
    build(a.map, a.out, a.extract, bbox)


if __name__ == '__main__':
    main()
