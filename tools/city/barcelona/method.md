# Barcelona: method and hand edits

Map data © OpenStreetMap contributors, ODbL 1.0
(<https://www.openstreetmap.org/copyright>).

`public/maps/city/barcelona.txt` and `barcelona.mask.txt` are built from
`osm.json` in this folder by `tools/city/prototype/build.py barcelona`. The
parameters below are also in `tools/city/prototype/cities.py`, so a rebuild
gives the same grid.

## Source

- One Overpass query, fetched 2026-11-22, `timestamp_osm_base`
  2026-11-22T21:22:51Z, 2,248 elements. The query and its box are in
  `meta.json`.
- The Basílica de la Sagrada Família is relation 9194723 (26 outer members).

## Transform

- UTM zone 31N (EPSG 32631), 14 m per cell, rotated 135°: the Eixample's
  streets run along the rows and columns, and up the board points south-west
  (bearing 225°).
- The rotation is the plan's 45° street alignment plus a quarter turn. The
  quarter turn chooses which side of the basilica the board covers: at 135°
  the basilica stands just past the far edge with Plaça de Gaudí and its pond
  on the board in front of it, the postcard view across the pond. At 45° the
  basilica's row of blocks, both squares included, would run along the far
  edge, off the board.
- The basilica's centroid lands on board cell (7.0, -3.6). Its footprint spans
  x 3.3-11.0 and y -7.0 to -0.3: just past the top edge, above the spawn
  block, where the skyline landmark stands. The board's corners are in
  `meta.json`.
- Rasterizing: a cell is floor if carved streets cover 30% of it; otherwise it
  is a wall if buildings and water cover 50%. Streets carve at least 1.6 cells
  wide, so every street is at least 2 cells (the plan's width floors).
- `raw.txt` is this raster before the gameplay pass: the baseline for the 30%
  rule.

## Changes from the raw raster

| Change | Kind | Cells |
| --- | --- | --- |
| Blocks hollowed (below) | Authored | 184 |
| Hand edits | Authored | 0 |
| Spawn plus shape opened: (13,7), (13,8), (13,9) | Pass, counted as authored | 3 |
| Wall border | Pass, automatic | 61 |
| Pockets filled: (17,4), (18,4), (18,5) | Pass, automatic | 3 |
| Crates, 26.5% of playable cells | Pass, automatic | 237 |
| Crates added to break lines over 20 | Pass, automatic | 0 |
| Crates cleared to join the spawns | Pass, automatic | 0 |

**Blocks hollowed into crate fields.** The streets run along rows 1-2, 10-12,
20-21 and 29-30 and columns 1-2, 10-11, 20-21 and 30-31. Each block
rectangle below keeps its outline as walls, with its corners as 2x2 squares
and a 2-cell gate in the middle of each side (two gates on a side of 13 cells
or more). Everything inside becomes floor that the crate pass furnishes.
Only cells that were walls in `raw.txt` stay walls, so a chamfered corner
stays chamfered. Where the board edge cuts a block, the cut side has no
outline and a lane stays open along the border.

`22-29,4-10`, `32-33,4-10`, `3-9,12-18`, `12-19,13-19`, `22-29,13-19`,
`32-33,13-19`, `3-9,22-28`, `12-19,22-28`, `22-29,22-28`, `32-33,22-28`,
`3-9,31-33`, `12-19,31-33`, `22-29,31-33`, `32-33,31-33` (x range, y range).

Plaça de Gaudí (3-9, 3-9) stays a park with its pond (mask `w`). The block
that Avinguda de Gaudí cuts diagonally (12-19, 3-9) is left as the raster
made it: the 2-cell avenue already opens it.

## The 30% rule

190 of the 1,089 interior cells (17.4%) switch between wall and floor from
`raw.txt`, crates counted as floor; 131 if cells that end up as crates are
left out. Against a raster without the width floors, 305 (28.0%).

## Soft targets

Measured after the engine's spawn carve with
`tools/city/prototype/table.py`, against the 7 shipped arenas.

| Target | Shipped | Barcelona |
| --- | --- | --- |
| Playable cells | 80.4–87.1% | 82.0% |
| Articulation points | 0–1 | 0 |
| Dead ends | 0–1 | 0 |
| 1-wide cells | 0.6–10.8% | 2.9% |
| Largest wall blob (pond exempt) | 15 | 14 |
| Longest line, no crates / crates | 33 / 13–20 | 33 / 18 |
| Start network | 350–513 | 444 |

All within the shipped range.

## Signature

- On the skyline: the Sagrada Família, where it really stands (board centroid
  (7.0, -3.6), recorded in `meta.json`). It is not drawn on the board, so it
  is not shown twice.
- On the board: no landmark cells (mask `m`). Plaça de Gaudí, its pond and
  Avinguda de Gaudí are in the start view.
