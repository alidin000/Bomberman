"""Grid metrics for 35x35 arena maps (cells: ' ' floor, 'W' wall, 'B' crate).

Engine facts mirrored here (read on main e64a2e07d8):
- spawns: PLAYER_SPAWNS = (1,1),(13,8),(1,8),(13,1)  src/engine/constants.ts
- spawn clearing: cell + 4 orthogonal neighbours become Empty unless on the
  boundary row/column                               src/engine/initialState.ts

Usage: metrics.py <map.txt> [<mask.txt>]
"""
from collections import deque

SPAWNS = [(1, 1), (13, 8), (1, 8), (13, 1)]
PLUS = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]
N4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def read_map(path):
    rows = [r.rstrip('\n').rstrip() for r in open(path, encoding='utf8')]
    rows = [r for r in rows if r.strip()]
    w = max(len(r) for r in rows)
    out = []
    for r in rows:
        if len(r) < w:  # mapLoader.normalizeMapData pads before the last W
            r = (r[:-1] + ' ' * (w - len(r)) + r[-1]) if (r[0] == 'W' and r[-1] == 'W') else r + ' ' * (w - len(r))
        out.append(list(r))
    return out


def engine_spawn_clear(g, n_players=4):
    g = [row[:] for row in g]
    H, W = len(g), len(g[0])
    for (sx, sy) in SPAWNS[:n_players]:
        for dx, dy in PLUS:
            x, y = sx + dx, sy + dy
            if 0 < x < W - 1 and 0 < y < H - 1:
                g[y][x] = ' '
    return g


def bfs(g, start, passable):
    H, W = len(g), len(g[0])
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in N4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in dist and passable(g[ny][nx]):
                dist[(nx, ny)] = dist[(x, y)] + 1
                q.append((nx, ny))
    return dist


def components(g, passable):
    H, W = len(g), len(g[0])
    seen = {}
    comps = []
    for y in range(H):
        for x in range(W):
            if passable(g[y][x]) and (x, y) not in seen:
                d = bfs(g, (x, y), passable)
                cid = len(comps)
                for c in d:
                    seen[c] = cid
                comps.append(len(d))
    return comps, seen


def articulation_points(g, passable):
    """Iterative Tarjan over the 4-neighbour graph of passable cells."""
    H, W = len(g), len(g[0])
    nodes = [(x, y) for y in range(H) for x in range(W) if passable(g[y][x])]
    disc, low, parent = {}, {}, {}
    aps = set()
    t = 0
    for root in nodes:
        if root in disc:
            continue
        parent[root] = None
        disc[root] = low[root] = t; t += 1
        children = 0
        stack = [(root, iter(N4))]
        while stack:
            v, it = stack[-1]
            advanced = False
            for dx, dy in it:
                u = (v[0] + dx, v[1] + dy)
                if not (0 <= u[0] < W and 0 <= u[1] < H) or not passable(g[u[1]][u[0]]):
                    continue
                if u not in disc:
                    parent[u] = v
                    disc[u] = low[u] = t; t += 1
                    if v == root:
                        children += 1
                    stack.append((u, iter(N4)))
                    advanced = True
                    break
                elif u != parent[v]:
                    low[v] = min(low[v], disc[u])
            if not advanced:
                stack.pop()
                if stack:
                    p = stack[-1][0]
                    low[p] = min(low[p], low[v])
                    if p != root and low[v] >= disc[p]:
                        aps.add(p)
        if children > 1:
            aps.add(root)
    return aps


def open_square_width(g, passable):
    """Side of the largest all-passable square containing each passable cell."""
    H, W = len(g), len(g[0])
    dp = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if passable(g[y][x]):
                dp[y][x] = 1 if (x == 0 or y == 0) else 1 + min(dp[y - 1][x], dp[y][x - 1], dp[y - 1][x - 1])
    best = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            s = dp[y][x]
            if s:
                for yy in range(y - s + 1, y + 1):
                    for xx in range(x - s + 1, x + 1):
                        if best[yy][xx] < s:
                            best[yy][xx] = s
    return best


def longest_run(g, passable):
    H, W = len(g), len(g[0])
    best = 0
    for y in range(H):
        run = 0
        for x in range(W):
            run = run + 1 if passable(g[y][x]) else 0
            best = max(best, run)
    for x in range(W):
        run = 0
        for y in range(H):
            run = run + 1 if passable(g[y][x]) else 0
            best = max(best, run)
    return best


def wall_shapes(g, exempt=frozenset()):
    """Interior wall blobs (4-connected, excluding the border ring). Cells in
    `exempt` (named landmarks and water) are left out of `max_blob_rated`."""
    H, W = len(g), len(g[0])
    inner = [[(g[y][x] if 0 < x < W - 1 and 0 < y < H - 1 else ' ') for x in range(W)] for y in range(H)]
    comps, _ = components(inner, lambda c: c == 'W')
    rated = [[(' ' if (x, y) in exempt else inner[y][x]) for x in range(W)] for y in range(H)]
    rated_comps, _ = components(rated, lambda c: c == 'W')
    singles = sum(1 for c in comps if c == 1)
    return {'blobs': len(comps), 'single_pillars': singles,
            'mean_blob': round(sum(comps) / len(comps), 1) if comps else 0,
            'max_blob': max(comps) if comps else 0,
            'max_blob_rated': max(rated_comps) if rated_comps else 0}


def measure(g, n_players=4, exempt=frozenset()):
    H, W = len(g), len(g[0])
    ge = engine_spawn_clear(g, n_players)
    interior = [(x, y) for y in range(1, H - 1) for x in range(1, W - 1)]
    n_int = len(interior)
    cnt = lambda ch: sum(1 for (x, y) in interior if ge[y][x] == ch)
    walls, crates, floor = cnt('W'), cnt('B'), cnt(' ')
    playable = crates + floor
    struct = lambda c: c != 'W'          # crates are destructible: structural graph
    opening = lambda c: c == ' '         # crates block at round start
    comps, cid = components(ge, struct)
    comps_sorted = sorted(comps, reverse=True)
    spawn_comp = [cid.get(s) for s in SPAWNS[:n_players]]
    same = len(set(spawn_comp)) == 1 and spawn_comp[0] is not None
    dists = {}
    for i in range(n_players):
        d = bfs(ge, SPAWNS[i], struct)
        for j in range(i + 1, n_players):
            dists[f'{i+1}-{j+1}'] = d.get(SPAWNS[j])
    open_reach = [len(bfs(ge, s, opening)) for s in SPAWNS[:n_players]]
    aps = articulation_points(ge, struct)
    width = open_square_width(ge, struct)
    hist = {'1': 0, '2': 0, '3': 0, '4-6': 0, '7+': 0}
    for (x, y) in interior:
        if struct(ge[y][x]):
            w = width[y][x]
            k = '1' if w == 1 else '2' if w == 2 else '3' if w == 3 else '4-6' if w <= 6 else '7+'
            hist[k] += 1
    dead = 0
    for (x, y) in interior:
        if struct(ge[y][x]):
            nb = sum(1 for dx, dy in N4 if struct(ge[y + dy][x + dx]))
            if nb <= 1:
                dead += 1
    open_area = sum(1 for (x, y) in interior if struct(ge[y][x]) and width[y][x] >= 3)
    pct = lambda a, b: round(100.0 * a / b, 1) if b else 0.0
    return {
        'walls_pct': pct(walls, n_int), 'crates_pct': pct(crates, n_int), 'floor_pct': pct(floor, n_int),
        'playable': playable, 'playable_pct': pct(playable, n_int),
        'crate_share_of_playable_pct': pct(crates, playable),
        'components': len(comps), 'largest': comps_sorted[0] if comps else 0,
        'cells_outside_largest': playable - (comps_sorted[0] if comps else 0),
        'spawns_share_component': same,
        'spawn_paths': dists,
        'opening_reach': open_reach,
        'articulation_points': len(aps), 'ap_pct_of_playable': pct(len(aps), playable),
        'width_hist_pct': {k: pct(v, playable) for k, v in hist.items()},
        'dead_ends': dead,
        'longest_line_struct': longest_run(ge, struct),
        'longest_line_opening': longest_run(ge, opening),
        'open_area_pct': pct(open_area, playable),
        'wall_shapes': wall_shapes(ge, exempt),
    }


def exempt_cells(mask_rows):
    """Wall cells the blob target exempts: water and the on-board landmark."""
    return frozenset((x, y) for y, row in enumerate(mask_rows) for x, c in enumerate(row) if c in 'wm')


if __name__ == '__main__':
    import json, sys
    grid = read_map(sys.argv[1])
    exempt = exempt_cells(read_map(sys.argv[2])) if len(sys.argv) > 2 else frozenset()
    print(sys.argv[1], json.dumps(measure(grid, exempt=exempt)))
