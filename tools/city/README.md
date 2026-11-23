# City Arena Tools

How the city arenas in `public/maps/city` are made and checked. The plan they
follow is `docs/REAL_CITY_ARENAS_PLAN.md`.

| Path | Holds |
| --- | --- |
| `rome/`, `barcelona/`, `budapest/` | Each city's OpenStreetMap extract (`osm.json`), its query and timestamp (`meta.json`), the raw raster (`raw.txt`), the method and every hand edit (`method.md`) and the grid drawn over the OSM footprints (`overlay.png`). Budapest also holds its fallback grid. |
| `prototype/` | The Python rasterizer that builds the grids and masks from the extracts. Its `README.md` says how to run it. |
| `gates.ts` | The CPU-match gates, run with `npm run gates`. |
| `GATES.md` | The last full gate report. |
| `NOTICE.txt` | The ODbL notice for the data in this folder. |
| `docs/images/city-<id>-overlay.png`, `city-<id>-overview.png` | Each city's overlay, and its round-start overview from the game at 1366x768, both with the OSM credit. |

Map data © OpenStreetMap contributors, available under the
[Open Database License](https://www.openstreetmap.org/copyright).

## Gates

Run from the repository root, with Node 22:

```bash
npm run gates
```

It bundles `gates.ts` with esbuild, the way `npm run server:build` bundles the
server, into `tools/city/.build` (ignored by git), then runs it. A full run
plays every city map, the control and the seven shipped arenas: 420 CPU-hard
matches each, 2 players and no monsters, every ordered pair of the 6 fighters
14 times, with the same seeds on every map. It takes about a minute on 4
worker threads. It prints the report and writes it to `GATES.md`. It exits
with 1 when a city map fails a hard gate.

Commit the new `GATES.md` with any change to a city grid or mask, a city
look's skyline, or the engine, CPU or camera code the gates run on.

What it checks, from the plan's "Quality Gates":

- **Spawns and the spawn carve** (hard). All four spawns are joined by
  crate-free lanes at round start, no open cell is sealed, the engine's spawn
  carve opens no wall with 2 to 4 seats, and no spawn or spawn neighbour is
  water. `src/content/arenaMaps.test.ts` checks the same in `npm test`.
- **Seat balance** (hard). Each seat wins 40-60% of decided matches. The
  shipped arenas are re-measured in every run; if one falls outside the band,
  the band widens to include it, and the report says so.
- **Signature on screen** (hard). At least half of a map's signature cells are
  inside the 1366x768 play view for at least 25% of live frames, using the
  game's own camera framing (`scene/cameraFraming.ts`, as `CameraRig` frames
  the players). The signature is the board's landmark, the mask's `m` cells;
  a map without one uses its skyline landmark's footprint on the far band,
  where `scene/landmarkPlacement.ts` puts it, measured at half the
  landmark's height: its towers and roofs, not the base that the board's top
  edge often shows alone.
- **Soft targets.** Playable cells, articulation points, dead ends, 1-wide
  cells and the largest wall shape, measured after the spawn carve, plus the
  median match length and the sudden-death share against the shipped
  arenas in the same run. A miss is listed with its reason from
  `SOFT_MISS_REASONS` in `gates.ts`, or flagged when it has none.

Options, after `--`:

| Option | Does |
| --- | --- |
| `--reps N` | Plays 30 x N matches a map (default 14) |
| `--workers N` | Worker threads (default up to 4, leaving 2 cores free) |
| `--maps a,b` | Plays only these catalog maps |
| `--grid id=path` | Plays a grid file in place of a map's own, with the `.mask.txt` beside it as its mask |
| `--monsters` | Shipped arenas keep their versus monsters, for a with-monster baseline |
| `--out path` | Writes the report to `path` |
| `--no-write` | Prints the report only |

Only a run with none of `--reps`, `--maps`, `--grid` and `--monsters`
writes `GATES.md` by default. For example, to try Budapest's fallback
against the shipped arenas without touching the committed files:

```bash
npm run gates -- --grid budapest=tools/city/budapest/fallback.txt --maps budapest,hiddenLeaf,hiddenSand,hiddenMist,hiddenCloud,hiddenStone,akatsukiHideout,greatShinobiWar
```

CPU play shows how the mechanics behave, not whether a map is fun. The
playtest decides that.

## Playtest

The control, `romeControl`, is Akatsuki Hideout mirrored left to right
(`prototype/cities.py`), dressed as Rome. Leave Akatsuki Hideout out of the
playtest's shipped pairings, so no tester has already played its layout. The
Mission Deck lists the control only at `/config?playtest=1`.
