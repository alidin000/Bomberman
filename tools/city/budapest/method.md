# Budapest: method and hand edits

Map data © OpenStreetMap contributors, ODbL 1.0
(<https://www.openstreetmap.org/copyright>). The Széchenyi Chain Bridge was
designed by William Tierney Clark, and the Parliament on the skyline by Imre
Steindl.

`public/maps/city/budapest.txt` and `budapest.mask.txt` are built from
`osm.json` in this folder by `tools/city/prototype/build.py budapest`. The
fallback variant (`fallback.txt`, `fallback.mask.txt`, `fallback.raw.txt`)
comes from `build.py budapest-fallback`. The parameters and hand edits below
are also in `tools/city/prototype/cities.py`, so a rebuild gives the same
grids.

## Source

- One Overpass query, fetched 2026-11-22, `timestamp_osm_base`
  2026-11-22T21:25:58Z, 1,482 elements. The query and its box are in
  `meta.json`.
- The Chain Bridge is way 197110386 (`man_made=bridge`); the Danube is
  relation 30036, clipped to the box and rebuilt from its centreline.

## Transform

- UTM zone 34N (EPSG 32634), 14 m per cell, rotated 14.4° to the bridge axis,
  so the deck runs along a row and up the board points to bearing 345.6°.
- The bridge outline's centroid lands on row 5.5.
- Water compression: at uniform scale the Danube is 25 columns (350 m) wide.
  Whole river columns are deleted in the rotated frame, 10 on each side of
  the middle, so 5 remain; everything east of a deleted band moves west by
  its width. The deleted bands are 168-28 m west and 42-182 m east of the
  bridge centroid (`meta.json`). The kept columns land on x 7-11; with the
  part-water bank columns the river is 5-6 cells wide (x 6-11 in rows 0-9,
  x 7-11 in rows 10-25, x 7-12 in rows 26-34).
- Rasterizing: a cell is floor if carved streets cover 30% of it; otherwise it
  is a wall if buildings and water cover 50%. Streets carve at least 1.6 cells
  wide (2 cells) and road bridges at least 2.6 (3 cells): the plan's width
  floors. That gives the Chain Bridge its 3-cell deck, on rows 4-6.
- `raw.txt` is this raster before the gameplay pass: the baseline for the 30%
  rule.

## Changes from the raw raster

| Change | Kind | Cells |
| --- | --- | --- |
| Blocks hollowed (below) | Authored | 112 |
| Hand edits (below) | Authored | 17 |
| Spawn plus shape opened: (2,1) | Pass, counted as authored | 1 |
| Wall border | Pass, automatic | 91 |
| Pockets filled | Pass, automatic | 0 |
| Crates, 26.5% of playable cells | Pass, automatic | 207 |
| Crates added to break lines over 20 | Pass, automatic | 0 |
| Crates cleared to join the spawns: (9,6) | Pass, automatic | 1 |

**Blocks hollowed.** Pest blocks that rasterize into wall blobs over 15
cells, and the partial blocks on the east edge, keep their outline as walls
with solid 2x2 corners and a gate in the middle of every side; the inside
becomes floor that the crate pass furnishes. Where the board edge cuts a
block, a lane stays open along the border: `26-29,4-8`, `22-28,10-13`,
`24-28,16-24`, `19-23,17-26`, `26-30,26-30`, `20-25,29-33`, `32-33,5-8`,
`31-33,11-14` (x range, y range).

**Hand edits.**

1. (7-11, 14-16): a second crossing, 3 cells wide, from the Buda bank to the
   Pest street at rows 14-15. It is invented: the next real bridge south,
   the Elisabeth Bridge, is far off the board. The plan asks for at least two
   crossings per river.
2. (24,5): open a notch in the block east of the square into a passage (it
   was a dead end).
3. (33,25): close a one-cell notch on the east edge (a dead end).

**Mask.** The deck cells over the river are `d`, the river `w`. The
compression deleted the bridge's real pylons, so its two pylons stand at the
kept river's edges as `m` on wall cells beside the deck: (7,3), (11,3),
(7,7), (11,7). Grid cells do not change.

## The 30% rule

130 of the 1,089 interior cells (11.9%) switch between wall and floor from
`raw.txt`, crates counted as floor; 108 if cells that end up as crates are
left out. Against a raster without the width floors, 227 (20.8%).

## Soft targets

Measured after the engine's spawn carve with
`tools/city/prototype/table.py`, against the 7 shipped arenas.

| Target | Shipped | Budapest | Fallback |
| --- | --- | --- | --- |
| Playable cells | 80.4–87.1% | 71.8% | 78.1% |
| Articulation points | 0–1 | 0 | 0 |
| Dead ends | 0–1 | 0 | 0 |
| 1-wide cells | 0.6–10.8% | 6.6% | 2.5% |
| Largest wall blob (river exempt) | 15 | 11 | 11 |
| Longest line, no crates / crates | 33 / 13–20 | 33 / 16 | 33 / 15 |
| Start network | 350–513 | 491 | 332 |

Playable misses the 75% threshold because the river is 149 interior cells
(13.7%) of wall; the land alone is 83% playable.

## Seats and the fallback

The river runs between the spawn columns: seats 1 and 3 start on the Buda
bank (x 1-5), seats 2 and 4 on the Pest bank. The Chain Bridge deck (rows
4-6) lies between the spawn rows, and the second crossing is at rows 14-16.

If the 6-column west bank fails the seat-balance gate, the plan moves the
river just east of the spawn block. `fallback.txt` is that variant, from the
same extract: the kept river lands on x 16-20 (water x 15-20 in rows 0-9),
all four seats start on the Buda bank (x 1-14), the deck stays on rows 4-6
and the second crossing is at (16-20, 14-16). Its blocks are
`1-5,20-32` (the Várkert Bazár on the Buda edge), `28-32,17-26`,
`29-33,29-33` and `31-33,3-7`; its pylons are (16,3), (20,3), (16,7) and
(20,7). It switches 92 cells (8.4%; 71 without crate cells; 167 against a
raster without the width floors), and its transform is under `fallback` in
`meta.json`.

## Signature

- On the board: the Chain Bridge, its deck (x 6-11, y 4-6) and pylons, in the
  start view.
- On the skyline: the Parliament, about 1.3 km north on the Pest bank, east
  of the river (x 12 and up at the far edge; x 21 and up in the fallback). It
  is not in this extract.
