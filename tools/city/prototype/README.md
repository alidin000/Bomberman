# City rasterizer (prototype)

The Python tool that turned OpenStreetMap extracts into the city arena grids
in `public/maps/city`. It is committed as the method the ODbL asks for
(section 4.6(b)): with the extracts in `tools/city/<city>/osm.json` it rebuilds
every grid, mask, raw raster and overlay. Map data © OpenStreetMap
contributors, ODbL 1.0 (see `tools/city/NOTICE.txt`).

## Setup

Python 3.10 or later, with these packages (pip names):

```bash
pip install shapely pyproj rasterio numpy Pillow
```

The committed grids were built with shapely 2.1, pyproj 3.7, rasterio 1.4,
numpy 1.26 and Pillow 12. Other versions can move a cell where a footprint
sits on a cell edge, so compare the output with the committed files.

## Run

From the repository root:

```bash
python3 tools/city/prototype/build.py rome
python3 tools/city/prototype/build.py rome --out city-try
python3 tools/city/prototype/table.py
```

- `build.py <map>` builds one map: `rome`, `barcelona`, `budapest`,
  `budapest-fallback` or `romeControl`. It writes the grid and mask, the raw
  raster, the overlay image (also copied to `docs/images`) and the
  `transform`, `signature` and `changes` records in the city's `meta.json`,
  and prints what changed.
- `--out <dir>` writes everything into one folder instead, to try a crop.
- `table.py` prints the soft-target metrics for the 7 shipped arenas and the
  city maps.
- `fetch.py <city>` queries the Overpass API once per city, one city after
  another, and overwrites the committed `osm.json` and its `meta.json`
  provenance. Rebuilding never needs it; refetch only to update a city on
  purpose, and keep to the
  [Overpass usage policy](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Files

| File | Does |
| --- | --- |
| `cities.py` | Each map's query box, crop, transform, landmark, block rectangles and hand edits |
| `fetch.py` | One Overpass query per city; writes `osm.json` and its query, box and `timestamp_osm_base` |
| `osmgeo.py` | Assembles the OSM ways and relations into projected layers (buildings, water, streets, paths, crossings, bridges, squares, green areas, trams) |
| `build.py` | The transform, the raster, the landmark and block rules, the hand edits, the gameplay pass, the mask and the overlay |
| `metrics.py` | Grid metrics, measured after the engine's spawn carve |
| `table.py` | The metrics table against the shipped arenas |

## Method

1. **Transform.** Project to UTM, rotate to the main street axis about the
   landmark, scale to 14 m per cell and place the landmark on a chosen board
   cell. A river can be compressed by deleting whole water columns in the
   rotated frame (Budapest keeps 5 of 25).
2. **Raster.** At 8x8 samples a cell, a cell is floor if carved streets cover
   30% of it, otherwise a wall if buildings and water cover 50%. Streets carve
   at least 1.6 cells wide and road bridges 2.6, the plan's width floors (2
   and 3 cells). Underground features, `building=roof`, memorials and tunnels
   are left out. This is `raw.txt`, the baseline for the 30% rule.
3. **Authored rules and hand edits.** A solid landmark becomes a ring with
   arches (Rome); blocks are hollowed, keeping their outline, 2x2 corners and
   gated sides (Barcelona, Budapest); single-cell hand edits follow. Each
   city's `method.md` lists them.
4. **Gameplay pass**, deterministic: a full wall border; each spawn's plus
   shape opened and joined to the main region through the fewest walls, never
   on water; unreachable pockets filled; crates on 26.5% of playable cells,
   on the lowest-hash cells more than 2 steps from any spawn; the fewest
   crates cleared so all spawns share one crate-free lane network; crates
   added so no crate-free straight line runs over 20 cells. No pillar lattice.
5. **Mask.** One render class per cell from the OSM layers: `e` border, `b`
   building, `w` water, `m` the on-board landmark on wall cells; `.` plain,
   `r` road, `p` plaza or pedestrian, `g` green, `d` bridge deck, `x`
   crossing, `t` tram track on floor and crate cells.
