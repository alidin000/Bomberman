# Rome: method and hand edits

Map data © OpenStreetMap contributors, ODbL 1.0
(<https://www.openstreetmap.org/copyright>).

`public/maps/city/rome.txt` and `rome.mask.txt` are built from `osm.json` in
this folder by `tools/city/prototype/build.py rome`. The parameters and hand
edits below are also in `tools/city/prototype/cities.py`, so a rebuild gives
the same grid.

## Source

- One Overpass query, fetched 2026-11-22, `timestamp_osm_base`
  2026-11-22T21:21:48Z, 1,406 elements. The query and its box are in
  `meta.json`.
- The Colosseum is relation 1834818 (`building=amphitheatre`).

## Transform

- UTM zone 33N (EPSG 32633), 14 m per cell, north up.
- The Colosseum's footprint centroid lands on board cell (21.5, 7.5), so the
  board runs about 300 m west, 190 m east, 105 m north and 385 m south of it.
  The board's corners are in `meta.json`.
- Rasterizing: a cell is floor if carved streets cover 30% of it; otherwise it
  is a wall if buildings and water cover 50%. Streets carve at least 1.6 cells
  wide, so every street is at least 2 cells (the plan's width floors).
- `raw.txt` is this raster before the gameplay pass: the baseline for the 30%
  rule.

## Changes from the raw raster

| Change | Kind | Cells |
| --- | --- | --- |
| Colosseum ring (below) | Landmark rule, authored | 89 |
| Hand edits (below) | Authored | 5 |
| Spawn plus shapes opened: (2,1), (1,7) | Pass, counted as authored | 2 |
| Wall border | Pass, automatic | 119 |
| Pockets filled | Pass, automatic | 0 |
| Crates, 26.5% of playable cells | Pass, automatic | 269 |
| Crates added to break lines over 20 | Pass, automatic | 0 |
| Crates cleared to join the spawns | Pass, automatic | 0 |

**Colosseum ring.** The plan's landmark footprint rule: the solid footprint
(a 91-cell wall blob in `raw.txt`) becomes a one-cell elliptical ring, 13x11
cells (the full 189x156 m at 14 m), centred on the OSM footprint at x 15-27,
y 2-12. Four 3-cell arches open it on its axes: x 20-22 on rows 2 and 12,
and y 6-8 on columns 15 and 27. The 32 ring walls are the mask's `m` cells;
the arena inside is plaza (`p`).

**Hand edits.**

1. (31-33, 15): reopen the street between the two Celio blocks on the east
   edge, which the raster closed; it breaks a 19-cell wall blob.
2. (23, 31-32): split the building complex at the bottom (an 18-cell blob)
   in two. (23, 33) was already open.

## The 30% rule

96 of the 1,089 interior cells (8.8%) switch between wall and floor from
`raw.txt`, crates counted as floor; 73 if cells that end up as crates are
left out. Against a raster without the width floors, 116 (10.7%).

## Soft targets

Measured after the engine's spawn carve with
`tools/city/prototype/table.py`, against the 7 shipped arenas.

| Target | Shipped | Rome |
| --- | --- | --- |
| Playable cells | 80.4–87.1% | 93.3% |
| Articulation points | 0–1 | 0 |
| Dead ends | 0–1 | 0 |
| 1-wide cells | 0.6–10.8% | 0.7% |
| Largest wall blob (ring exempt) | 15 | 9 |
| Longest line, no crates / crates | 33 / 13–20 | 33 / 18 |
| Start network | 350–513 | 659 |

Playable is above the shipped range: the crop is the Palatine, the Celio and
the open ground round the Colosseum, which OSM maps as park and paths. The
plan's threshold is a minimum, so it passes, but the map plays more open than
any shipped arena. Crates furnish the open ground; no walls were invented.

## Signature

- On the board: the Colosseum ring (mask `m`), half inside the start view.
- On the skyline: the Vittoriano, about 1 km north-west of the Colosseum. It
  is not in this extract.
