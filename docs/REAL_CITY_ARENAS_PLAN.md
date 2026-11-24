# Real City Arenas Plan

Revised 2026-11-22 against `main` at `e64a2e0`; line numbers refer to that
commit. The goal is unchanged from the first version: real-world geography
should make recognisable, tactically interesting arenas, each with its own
tactical character, built from OpenStreetMap (OSM) data and fair to play.

The way there has changed. This revision rests on five pieces of evidence,
named this way below; the appendix holds the key numbers.

- **Code review:** the first version checked against the code, with probes
  run through the engine.
- **OSM survey:** live OSM data for all ten signature areas, rasterized into
  80 test grids at 8–20 m per cell.
- **Prototype:** OSM grids for Budapest, Barcelona, Rome and Tokyo, played
  through the real engine and in the real game.
- **CPU matches:** 2,261 CPU-vs-CPU matches through the game loop with the
  shipped AI.
- **Load test:** the real online server under load, including an emulated
  0.1-CPU quota.

## Feasibility Verdict

Feasible in a narrower form, and the basics already work. In the prototype:

- all 61 grids (7 shipped, 54 generated from OSM) loaded and started, and all
  305 CPU matches on them played to a result;
- Rome came out close to the shipped arenas (79.6% playable cells against
  80.4–87.1%) with a single spawn correction;
- Barcelona gave a clean, recognisable grid once rotated 45° onto its streets;
- Budapest gave a fair two-bank arena once its river was cut from 25 columns
  to 5;
- a 26-line change let the real game play these grids from a city route, with
  no console errors.

The narrower form: three to six city arenas at first, local before online,
each an OSM grid with recorded hand corrections. Players see the real layout
in a round-start overview, on the picker card and in the floor colours, plus
a skyline landmark.

Three things make it hard:

- Uniform rasterization came close to the shipped arenas only in Rome, and
  only 9 of 80 raw test grids had all four fixed spawns open and joined.
- The play camera frames the players, not the board. At round start it shows
  18–27% of the board with the centre off screen, and CPU players spend 69–82%
  of their time in the top 7 rows.
- Real blocks are denser, and real squares emptier, than Bomberman arenas, so
  every map needs a gameplay pass and some hand edits.

The open question is whether real streets add anything beyond a name, colours
and a skyline. A local MVP of about 16–28 dev-days answers it. Six cities
online cost about 30–55 dev-days in all, MVP included.

## What Changed From the First Version, and Why

What held up: the code review found that the first version's identity and
online design fits the code: a separate `ArenaMapId`, an id the server checks,
a grid the server sends, and a protocol bump. Corrections stored as data, OSM
attribution and City Pulse after the static maps also stay.

| Change | Why |
| --- | --- |
| A local MVP comes first: three cities, a control map, kill rules | The first version planned to build all ten cities, the tool and online play before anyone played a city (about 45–80 dev-days by the code review's sizing) |
| Maps are built around the fixed spawns, the 12x8 leash and the camera | A landmark-centred crop leaves the landmark 9–16 cells from every spawn, where play rarely goes |
| Gates come from the 7 shipped arenas, not Budapest; fairness gates are hard, feel targets soft | Budapest fails at every uniform scale, so it is the outlier; village density as a hard gate would erase the geography |
| CPU matches and a human playtest decide | Static map metrics did not predict how layouts play |
| The transform rotates and compresses water | Barcelona north-up is 42 pieces at 16 m, rotated 45° it is 8; the Danube is 25 of 35 columns at 14 m |
| The gameplay pass is specified, with no pillar lattice and a landmark rule | Raw grids sealed spawns, and a lattice turned Rome's plazas into 1-wide mazes |
| The real layout is shown: a round-start overview, a top-down picker card, and floor and water colours from a render-only mask | The play camera shows 18–27% of the board at round start; the grid has no water cell, so the prototype's Danube drew as rows of hedge walls |
| Each city gets one code-built skyline landmark | Fog and the off-board rule hide most scenery, and the game downloads no mesh files |
| The route sets the map id; each map states its monster rule, `none` for cities by default | Three ids can disagree today, and a city gets no monsters only because its id is unknown |
| The performance budget has numbers | The code has no numeric budget and no playable 15x10 arena, so this plan sets numbers and compares cities with the village arenas |
| Online comes right after the MVP maps ship, before more cities | Once the catalog exists, online adds a protocol bump and a lobby choice; server limits affect village rooms equally |
| Licensing is classified and refined | The intermediate data must be offered under ODbL 4.6, one reference link is a fork, one repo has no licence, and the first version's review before release becomes a decision |
| The converter is a decision; no candidate ranking, overlay UI or 3D preview | A prototype rasterizer works, the committed grid is the artifact, and a static overlay image per map replaces the overlay UI |

## Boundaries

Kept from the first version: cities are their own arena family, and village
arenas and the campaign do not change. Cities are player-versus-player by
default, with no versus monsters (see the monster rule). Each city gets one
static map, where buildings and water are ordinary walls and roads and bridges
are floor. No map data is requested from OSM or any other service at runtime,
players cannot make cities, and no Google Maps geometry or bulk-downloaded
rendered OSM tiles are used. City Pulse and destructible buildings or bridges
come later.

## MVP: Test the Idea First

**Question:** does real geography give arenas that players recognise and want
to play, beyond a city name, colours and a skyline?

**Scope:** local only, three cities and a control map, no TypeScript
converter: the prototype rasterizer does the rasterizing. About 16–28
dev-days, in two tracks so both developers work at once: 7–12.5 on the
content track, 7.5–14.5 on the code track and 1 for the playtest. Calendar
time depends on each developer's hobby hours. Sizes marked * come from the
code review; the rest are our estimates.

### Build Status (2026-11-23)

Steps 1–4 are built. Step 5, the playtest, is next.

- **Maps:** Rome, Barcelona and Budapest come from OSM extracts fetched on
  2026-11-22. The control is Akatsuki Hideout, mirrored, so leave Akatsuki
  Hideout out of the playtest. Barcelona is rotated 135° instead of 45°: the
  same street axes plus a quarter turn, so the basilica falls just past the far
  edge. Budapest's fallback layout was not needed.
- **Gates:** `npm run gates` plays 420 CPU-hard matches a map and writes
  `tools/city/GATES.md`. Every city passes every hard gate. Rome is more open
  than any shipped arena (93% playable cells). Budapest misses the playable
  target (71.8% against 75%) because of the river.
- **Budget:** in the same browser run, the city maps drew at most 32 calls
  against hiddenLeaf's 54. They use the same 17 shader programs and link none
  after GO.
- **Showing the map:** the round-start overview, the top-down card, mask
  colours and flat water, a skyline landmark and a loading card. The credits
  link to OSM and to the method in `tools/city`.
- **Board-size probe:** Rome cut to 25x19 kept its signature on screen for 96%
  of live time, against 69% at 35x35.
- **Open:** Rome's skyline model is the Vittoriano, whose centre is the Altare
  della Patria, a memorial, while this plan excludes memorials. Keep it as
  stylised massing, or pick another landmark north-west of the Colosseum.

### Build Order

Each step ends in something playable.

| Step | Content track (dev-days) | Code track (dev-days) | Then you can play |
| --- | --- | --- | --- |
| 1. Day one | Copy the prototype's grids, raw rasters, OSM extracts and rasterizer into the repo (0.5) | Put the prototype's 26-line route change (`loadCityMapRows` in `src/engine/mapLoader.ts`, plus `GameScreen.tsx`) on a branch; step 2 replaces it (0.5) | `/game/3/1/rome` on the prototype's Rome grid |
| 2. Rome and its control | Re-crop Rome to its brief and pass the hard gates (1.5–3*); build the control (0.5); the structural checks and `npm run gates` (1–2); the board-size probe: one smaller grid, for example Rome at 25x19, through the engine and the harness (0.5) | The local catalog: `ArenaMapId`, the route-authoritative id, the monster rule and an arena choice in the Mission Deck (2–4, our share of the code review's 4–6); Rome's look and skyline landmark (2–4*) | Rome against its control, from the Mission Deck |
| 3. The other two | Barcelona, then Budapest (1.5–3* each) | The mask's colours and flat water (1–2); the round-start overview (0.5–1); the top-down card, loading view and OSM credit (0.5–1); two more looks (0.5–1 each) | All three cities, with water and the overview |
| 4. Final run | Run the gates on every map | Fixes | A gate report for every map |
| 5. Playtest | Run and record it (1) | | Kill or continue |

### Map Briefs

Targets for curation; the gates have the final say. Three terms used below:

- the spawn block, x 1–13 and y 1–8, where all four seats start;
- the start view, about x 0–21 and y 0–10, what a laptop shows at round start;
- the far band, the strip past the board's top edge where skyline landmarks
  stand.

| Map | Crop | On the board | On the skyline |
| --- | --- | --- | --- |
| Rome | 14 m, north-up | The Colosseum as a ring of about 13x11 cells with arch openings, at about x 15–28, y 1–11: beside the spawn block and half inside the start view | A second landmark, for example the Vittoriano, which stands to the north-west |
| Barcelona | 14 m, rotated 45° | Eixample blocks hollowed into crate fields, with the chamfered corners as 2x2 squares | The Sagrada Família where it really stands: crop so it falls just past the far edge |
| Budapest | 14 m, rotated 14.4° to the bridge axis, river cut to 5 columns | The Danube between the x=1 and x=13 spawn columns (for example x 7–11), so seats start on opposite banks; a 3-cell Chain Bridge deck inside rows 1–8; a second crossing further south | Parliament, which stands north on the Pest bank |
| Control | A shipped village grid, mirrored | Built like the shipped arenas by definition | Rome's name, look and skyline |

Rules for every brief:

- A shape that plays (a river and bridge, a ring with openings) goes on the
  board. A tall building whose footprint is only a block goes on the skyline,
  with the board covering the real streets beside it.
- Never show the same landmark on the board and on the skyline.
- If Budapest's 6-column west bank fails the seat-balance gate, move the river
  just east of the spawn block and keep the bridge inside rows 1–8. In the
  prototype the bridge sat at row 17, and CPU players never crossed.
- Pick a control village whose mirror passes the hard gates, and leave that
  village out of the playtest.

The alternative plaza city is Paris (the Étoile). It has no OSM prototype
yet; on a synthetic Étoile layout, its diagonal avenues cut Giant Clay's reach
by 29% and Kirin's by 35%.

### What Gets Committed

The prototype's grids, rasterizer, CPU harness and screenshots live outside
the repo today. Commit them in this layout:

| Path | Contents |
| --- | --- |
| `public/maps/city/<id>.txt` | The playable grid |
| `public/maps/city/<id>.mask.txt` | The render classes (see The Visual Mask) |
| `public/maps/city/NOTICE.txt`, `tools/city/NOTICE.txt` | The ODbL notice, beside both sets of city data |
| `tools/city/<id>/` | `osm.json`, the raw extract; `meta.json`, its query and `timestamp_osm_base`; `raw.txt`, the raw raster and the baseline for counting changes; `method.md`, the method and the hand edits; `overlay.png`, the grid over the OSM footprints |
| `tools/city/prototype/` | The prototype rasterizer (about 1,000 lines of Python using shapely, rasterio and pyproj), or a note that describes its algorithm. Either meets ODbL 4.6(b) in our reading |
| `tools/city/gates.ts` | The CPU harness |
| `docs/images/` | One overlay and one in-game overview per MVP city, captioned "© OpenStreetMap contributors" |

The raw extracts stay out of `public/`, so megabytes of OSM JSON are not
served with the game. The structural checks are an ordinary vitest file beside
the catalog (`src/content/arenaMaps.test.ts`), so `npm test` always runs them.
`npm run gates` bundles the harness with esbuild, as `server:build` bundles the
maps (`--loader:.txt=text`), plays every city, the control and the 7 shipped
maps, and prints the gate table.

### Acceptance

- From the Mission Deck, each city and the control can be picked and played to
  a result with 2 and 3 players.
- A city route gets its catalog grid, look and monster rule, whatever is
  stored.
- On every city map the engine's spawn carve changes no `W` cell, no spawn or
  spawn neighbour is water in the mask, and all spawns are joined.
- Mask and grid match in size, and water sits only on `W` cells.
- Each map passes the hard gates, with the shipped maps re-measured in the
  same run; soft-target misses are listed with a reason.
- Village arenas and campaign rendering are unchanged (existing look tests).
- Saved city setups and Quick Play keep the city id.
- A city match links no shader program after GO (extend `roundEnd.spec.ts`)
  and stays within the draw-call and triangle budget.
- The overview shows in the first round only, can be skipped, and cuts under
  reduced motion.
- The looks, mask colours and overview are checked with scenery on and off,
  high contrast and reduced motion.
- The city card and loading view show the OSM credit.
- The playtest results are recorded against the kill rules.

### Playtest

6–8 people over 2–3 sessions, with shipped arenas mixed in. Each city is
paired with one shipped arena.

1. **Naming, before testers see any city name.** For each city and the
   control, show a round-start overview screenshot with the HUD hidden, then
   the top-down card, and ask "Where is this?". A name counts if it names the
   city or its landmark.
2. **Play.** Each tester plays every city, its paired shipped arena, and the
   control.
3. **Choices.** After each pair: "Which do you want to play next?" After Rome
   and the control: "Which one is laid out like the real Rome?"
4. **One open question:** "What did you notice about this map?"

The CPU harness measures how long each signature is on screen, so the MVP
needs no position log.

### Kill or Continue

Counts are for 8 testers; scale them for fewer.

- **Keep a map** if at least 4 of 8 testers name its city or landmark from
  the overview screenshot, and it is picked to play next at least as often as
  its paired shipped arena. Drop only the maps that fail.
- **Keep building from OSM** if at least 6 of 8 pick the real Rome when asked
  which is laid out like the real Rome, or at least 5 of 8 would rather play
  the real Rome than the control next. Otherwise city themes can still ship as
  hand-made maps.
- **Drop the pipeline, but keep hand-made city themes,** if a map's committed
  grid has more than 30% of its interior cells (about 330) switched between
  wall and floor from its raw raster, by the pass or by hand. Crates do not
  count.
- **One retry:** a map that misses a keep rule by one tester gets one round of
  fixes and one retest.
- **Continue** with the maps that pass: phase 1a ships them.

## Decisions for the Owners

The PRD wants the game to feel like "70% Naruto Adventure" (line 26), and its
success line is "I am exploring and surviving inside the Naruto world" (line
1130). Arena mode is already the PRD's story-free versus mode: "Local PvP. …
Players fight each other. … No story progression." (lines 115–125), with seven
village maps today. Cities add to Arena mode, not to the story.

### Decide Now

| Decision | Recommended | Because | Alternative |
| --- | --- | --- | --- |
| Where cities fit | A bonus arena family in Arena mode, outside the story | Arena mode already has no story, and the campaign does not change | A story reason for the cities, or a note in the PRD |
| The three MVP cities | Barcelona, Rome and Budapest | One per layout type, and the best measured of each | Paris instead of Rome for the plaza type |
| Versus monsters on city maps | `none`, as the first version specified | The CPU baseline has no monsters, and a city room without monsters mints no hazard ids online | An existing village set per city, so every arena follows one rule; it needs a with-monster baseline, and the hazard-id fix before cities go online |
| Spawn approach | Crop to the fixed spawns | No rule change and no version bump | Per-map spawn profiles (2–4 dev-days and a `REPLAY_VERSION` bump); with monsters, per-map monster cells too |
| Showing the real map | The round-start overview, the top-down card, and floor and water colours, all in the MVP | The play camera shows 18–27% of the board, and all three change only rendering | A name, colours and a skyline only |
| Prototype rasterizer | Commit it under `tools/city/prototype/` | Re-cropping needs it, and it is the method ODbL 4.6(b) asks for | A method note that describes the algorithm |

### After the Playtest

| Decision | Recommended | Because | Alternative |
| --- | --- | --- | --- |
| Shipping the MVP maps | Ship the maps that pass the kill rules (phase 1a) | Otherwise the work never reaches players | Keep them internal |
| Licensing review | Follow the OSMF guidelines as read here; get a review before any commercial use | The OSMF attribution guideline has a section for games, and the plan credits OSM and publishes its method | A review before phase 1a, as the first version asked |
| Online timing | Phase 1b, right after the MVP maps ship | The catalog already exists, and city rooms cost the same as village rooms | After more cities |
| Converter | Hand-curate up to six cities with the prototype rasterizer | Curation costs 1.5–3 dev-days a city either way; the tool adds 15–25 as sized for the first version | A TypeScript tool, if all ten cities or regular refreshes are wanted |
| Board size | Decide from the MVP's board-size probe | A smaller board keeps more of the map near the spawns and on screen | Keep 35x35 |

## Delivery After the MVP

Each phase ends in a release players can use.

| Phase | Delivers | Dev-days |
| --- | --- | --- |
| MVP | Three cities and a control, local only, and the playtest | about 16–28 |
| 1a | The MVP maps that passed, shipped to players: mask detail within the budget, a credits page with the OSM credit (1–2*), picker polish, and device and end-to-end checks (3–5*) | about 6–10 |
| 1b | Online: the client error fix, then city ids in rooms (the online share of the catalog's 4–6*) | about 3–5 |
| 1c | Up to three more cities, hand-curated (1.5–3* each, plus a look each) | about 6–12 |
| 2 | The remaining cities, dropping any that fail (Istanbul, Prague and Tokyo are the likeliest); optional extruded scenery (3–5*) | about 8–16, plus 3–5 |
| Later | City Pulse | 10–20* |
| If chosen | Per-map spawn profiles and a version bump (2–4*), only if a map worth keeping cannot meet the on-screen gate by cropping; a TypeScript converter (15–25*, sized for the first version's tool with an overlay UI and 3D preview; a smaller tool is not sized) | |

Sizes marked * come from the code review; the rest are our estimates. Six
cities online, hand-curated, come to about 30–55 dev-days, MVP included. The
other four cities add about 8–16 by hand, or about 23–41 with the TypeScript
tool. City Pulse adds 10–20.

**The TypeScript converter, if chosen,** is a small Node/TS tool in
`tools/city/`, tested with vitest. It reads committed raw OSM JSON and writes
the grid, mask and manifest, using osmtogeojson, turf, polygon-clipping and
three's earcut (the repo has no geometry library today). It handles the
pitfalls in Appendix B and never fetches in CI; pinned inputs can come from
BBBike or Geofabrik extracts cut with osmium. Curation costs about the same
with or without it, since the prototype rasterizer already rasterizes. The
tool buys one toolchain, tests and reproducible builds.

## Constraints the Plan Designs Around

All verified in the code or by running it.

| Constraint | Where | What it means for city maps |
| --- | --- | --- |
| Arena spawns are always (1,1), (13,8), (1,8), (13,1), on any board size | `constants.ts:26-31`, `initialState.ts:41-46` | The spawn block (x 1–13, y 1–8) must be good ground. Only 9 of 80 raw test grids had all four spawns open and joined. |
| `createSpawnSafeMap` empties each spawn and its 4 neighbours, walls included, except border cells, and never reports a problem | `initialState.ts:32-38, 82-98` | A spawn sealed in a river pocket passes silently. The tool must check. |
| A shared-screen leash keeps players within 12x8 cells (18x12 while escaping) in every multiplayer mode except co-op, which runs as mode `solo` | `players.ts:44-49, 208-232`; co-op at `onlineServer.ts:191` | Local and online arena are leashed. Players never spread across the city, and players spawned further apart can never widen the gap. |
| The camera frames the players, not the board | `GameScene3D.tsx:2377-2430`, `cameraFraming.ts:20-25` | At round start a 1366x768 laptop shows about x 0–21, y 0–10 (18% of the board), a portrait phone 27%. The centre is off screen. In CPU matches 69–82% of player-time is in the top 7 rows, 3–8% in the central 11x11, 0–2.4% in the bottom half. |
| Every round opens with a 3 s countdown that freezes the arena | `initialState.ts:31`, `reducer.ts:207-216` | There is time to show the whole board before play starts. |
| Landmarks stand only off the board, on the far band and the upper sides; fog is full 3.5–7 units past the far edge | `landmarkPlacement.ts:10-14, 88-113`, `landmarkPlacement.test.ts:113-140`, `StageAtmosphere.tsx:10-43` | A landmark on the board is just walls. The far skyline is what players see at spawn; distant scenery fades out. |
| Cells are `' '`, `W`, `B`, `P` (plus campaign `C`, `H`, `G`); any other character throws. `look.water` is a plane under the slab | `mapLoader.ts:82-109`, `StageLandmarks.tsx:21-36` | No water or building cell: a river is walls in the village wall shape. Water can surround the board, not cross it. |
| Versus monsters are keyed by the route's map id; an unknown id gets none | `initialState.ts:215-229`, `monsterSpawns.ts:151-152` | The 7 shipped arenas spawn 2–4 monsters. A city gets none today only because its id is unknown. |
| Three map identities can disagree: the route `selectedMap` (monsters), the stored `selectedMap` (grid), `setup.stageId` (look) | `GameScreen.tsx:353-378`, `launchGame.ts:82-113` | Reproduced: Sand monsters on the Leaf grid with the Leaf look. |
| 14 hand-filled `Record<StageId, …>` tables in 13 production files | `git grep "Record<StageId"` (19 lines; the rest are `Partial<…>` or the derived `STAGE_LOOKS`) | A city must never become a `StageId`. Saved setups and Quick Play drop unknown stage ids (`launchGame.ts:177`). |
| Local Arena has 2–3 players; online rooms seat 4 | `props.tsx:26-30`, `launchGame.ts:182`, `protocol.ts:8` | A hand-typed `/game/4/...` local URL crashes (`GameScreen.tsx:536-546`). |
| No mesh files are downloaded; no shader program may compile after GO | `ARCHITECTURE.md:267`, `roundEnd.spec.ts:51-64` | City scenery is built in code on shared materials. |
| No numeric performance budget, only partial caps such as 6 landmark draws a stage | `landmarkPlacement.test.ts:182-186` | This plan sets one. |
| The 15x10 maps cannot be selected; a 15x10 default map is only the fallback for a missing or corrupt stored grid | `mapLoader.ts:28-36, 123-127` | Compare cities with the 7 village arenas. |

## Geography

### Per-City Fit

Measured in the OSM survey on 2026-11-22, rasterizing each landmark's area at
8–20 m per cell, north-up and rotated to the main street axis.

| City | Signature | Fit | Fix |
| --- | --- | --- | --- |
| Budapest | Chain Bridge, Danube | Fails at uniform scale. The river is 358 m (22 cells at 16 m); 64–67% water; 0–2 of 4 spawns walkable. | Compress the river to 5–9 cells, a 3-cell deck, 1–2 invented crossings; or crop the Pest bridgehead. Castle hill is mapped as park and needs a terrain mask. |
| Berlin | Brandenburg Gate, Pariser Platz | Fits; 28% walls at 12 m, but a 16-cell open square (Tiergarten) and 66% of open cells with no wall nearby. | 12 m crop; the gate's 5 passages as 1-cell openings (needs non-uniform scale); exclude the Holocaust memorial. |
| New York | Times Square | Fits only rotated −28°, at 8–12 m. North-up at 16 m: 36 pieces. | Hollow the blocks: 61–67% walls against 13–20% on shipped maps. |
| London | Tower Bridge, Thames | Fails at uniform scale: 50% water at 16 m, 24 pieces. | Thames to about 8 cells; fill the moat and docks; a 2–3-cell deck; a second crossing. |
| Paris | Arc de Triomphe, Étoile | Fits at 12 m: 26–28% walls, 97–98% connected, but an open disc 20 cells wide; 8 of 12 avenues are diagonal. | Islands on the ring; snap avenues to 8 directions. |
| Rome | Colosseum | Fits; 20% walls at 12 m, just above the shipped 13–20%, but an 11-cell open square and 71% of open cells with no wall nearby. The Colosseum is one solid block. | Arch openings; let crates furnish the piazza. |
| Tokyo | Shibuya Crossing | Marginal: 48.5% walls and 23 pieces, rotated 21° at 12 m. | An 8 m crop, rotated; 2-cell alleys; the railway as a wall band. |
| Barcelona | Sagrada Família, Eixample | Best fit once rotated 45°: 52% walls, 8 pieces at 16 m (42 north-up). | Hollow blocks into crate fields; chamfered corners as 2x2 squares. |
| Istanbul | Galata Bridge, Golden Horn | Fails at uniform scale: 67–69% water at 16 m. | Build on the bridge: a 3–5-cell deck as the spine, small squares at each end. |
| Prague | Charles Bridge, Old Town | Fails at uniform scale: about 50% water, 31–34 pieces, 18–21% dead ends at 16 m. | Crop the Old Town bridgehead at 6–8 m; 2-cell lanes; the bridge as a 2-cell lane off the edge. |

### Three Layout Types

| Type | Cities | What fills the crop | Shared fix |
| --- | --- | --- | --- |
| River and bridge | Budapest, London, Istanbul, Prague | Water: 50–69% of the board at 16 m; the banks share one deck 0.6–2.6 cells wide | Compress the water to 5–9 cells or crop one bridgehead; at least 2 crossings |
| Plaza or crossing | Rome, Berlin, Paris | Open space: 20–28% walls at 12 m, but open squares 9–16 cells wide | Crates furnish the square; open up any solid landmark |
| Landmark with a street grid | Barcelona, New York, Tokyo | Blocks: 48.5–67% walls once rotated | Rotate to the street axis; hollow blocks into crate fields |

Times Square and Shibuya are crossings inside dense blocks, so they take the
grid fixes. Rome's crop is an open piazza around one solid landmark, so it
takes the plaza fixes.

So three maps, one per type, test the idea; the other seven are content
production. Start with the best-measured city of each type: Budapest (the only
river city run through the engine), Rome (closest to the shipped metrics) and
Barcelona (the cleanest grid once rotated). Leave the hardest for last or drop
them: Istanbul, Prague and Tokyo (a dead-end maze in the prototype).

## Design Decisions

### Map Identity and Catalog

- One catalog, `content/arenaMaps.ts`, keyed by a typed `ArenaMapId`. An entry
  holds the family (`village` or `city`), name, grid, mask, look id, monster
  rule, signature cells, preview, caption, attribution and, for cities, a
  manifest. Village arenas keep today's ids, grids, monsters and looks. There
  is no `classic` family.
- The route id is the single source of truth: for an arena, `selectedMap` is
  the `ArenaMapId`, and grid, monsters and look all come from its entry, not
  from local storage. The prototype made the route pick the grid with a
  26-line change; routing the look and monsters is part of the catalog work.
- Cities never become `StageId`s. The Mission Deck gets its own arena choice
  (it shares `selectedStage` with the campaign today,
  `ConfigScreen.tsx:212-214`); saved setups and Quick Play check the catalog.
- Re-key `StageLook` to a look id. The look's `stageId` also seeds landmark
  placement (`landmarkPlacement.ts:167`) and keys a cache
  (`StageLandmarks.tsx:193`). Campaign rendering must not change.
- Guard the 4-player local URL crash while the route changes.

**Monster rule.** Each entry names its versus monsters: an existing set, or
`none`. Recommended for cities: `none`, as the first version specified ("Do
not add neutral city NPCs", line 14; "City maps do not accidentally spawn
neutral monsters", line 231). The CPU baseline was measured without monsters,
so `none` maps compare with it directly. A city room with no monsters mints no
hazard ids, so the hazard-id bug (see Online) cannot reach it. The cost: every
shipped arena has 2–4 monsters, so cities would be the only arenas without
them, while the first version also asked for no "city-specific rules that make
the core game inconsistent" (line 21). The alternative gives each city an
existing village set, so one rule holds for every arena. It needs a
with-monster CPU baseline, and the hazard-id fix before cities go online. The
harness runs both ways in about a minute, so run both once it is in (build
step 2), and switch only if city match lengths need monsters to come into
range. Village tables stay as they are, so neither option needs a
`REPLAY_VERSION` bump.

### Spawns and Framing

The signature must sit where play happens: beside the spawn block, inside the
start view, or on the far skyline.

1. **Crop to the spawns (MVP default).** Move and rotate the crop so the
   signature lands next to the spawn block. No engine change.
2. **Per-map spawn profiles** (2–4 dev-days), only if a map worth keeping
   cannot meet the on-screen gate by cropping. Campaign missions already start
   at per-map spawns: since replay version 8, `getPlayerSpawn`
   (`initialState.ts:40-46`) reads each mission's `playerSpawns`. Arena
   profiles would list spawns for 2, 3 and 4 players in the catalog and pass
   them in `GameConfig`. That is a rule change, so it needs a `REPLAY_VERSION`
   bump (10 at `e64a2e0`), which `SIMULATION_VERSION` follows. The roadmap's
   hazard-id fix needs a bump too; ship both in one release, so online players
   see one out-of-date cycle. Each pair of spawns must stay within 12 columns
   and 8 rows: the camera is sized for that spread, and players spawned
   further apart can never widen the gap. With monsters, the village monster
   tables were laid out for the old 15x10 corner (`initialState.ts:100-104`),
   so profiles would need per-map monster cells too.

Either way, the gameplay pass opens every spawn in the grid itself, so the
engine's carve changes no `W` cell on a city map, and a check fails any map
with a spawn on water or cut off. Shipped maps lean on the carve instead: with
3–4 seats every one loses 1–4 crates, hiddenCloud loses 2 walls and
hiddenStone 1. City maps make those edits visible.

**Board size.** Only `mapLoader.test.ts:62-66` enforces 35x35. The fixed
spawns, the camera's 15/10 fallback size and `MAP_OFFSET` come from the 15x10
maps the game started with. A smaller board keeps more of the map near the
spawns and on screen. The MVP probes one through the engine and the harness,
and board size is decided after the playtest.

### The Transform

- Project to UTM and rotate to the main street axis. Measured: Barcelona 45°,
  New York −28°, London −25°, Tokyo 21°, Prague −17°; Budapest 14.4°, to its
  bridge axis.
- Use 10–14 m per cell by default; Tokyo needs about 8 m and Prague 6–8 m.
- Compress water bands with a documented piecewise mapping, or crop to one
  bridgehead. Budapest at 14 m kept 5 of its 25 river columns.
- Record rotation, scale, crop and compression in the manifest. The skyline and
  any later scenery use the same transform; `toWorld` stays axis-aligned.
- Exclude memorials, underground features (`layer<0`,
  `location=underground`), `building=roof` and tunnels. Bridges are roads.
- Width floors: rivers 5–9 cells, major roads 2–3, lanes 2 or more, bridges 3
  or more (2 only with a second crossing nearby), and at least 2 crossings per
  river. A Barrage can seal a 1–2-cell bridge (`characterAbilities.ts:44-56`),
  and Kirin hits every non-wall cell in its row and column, across water too
  (`bombs.ts:236-243`).

### The Gameplay Pass

A deterministic pass, as in the prototype:

1. A full `W` border.
2. Open each spawn's plus shape and link it to the main region through the
   fewest walls, never on water (move the crop instead). These count as
   authored corrections, and they leave the engine's carve nothing to do.
3. Turn unreachable pockets into walls.
4. Put crates on 26.5% of playable cells (the shipped mean), on the
   lowest-hash cells more than 2 steps from any spawn.
5. Clear the fewest crates so all spawns share one lane network at round start.

- **No pillar lattice.** In Rome it added 161 pillars and raised 1-wide cells
  from 1.7% to 69.1%. Crates furnish open squares, as on the shipped maps, and
  crate-free straight lines stay at about 20 cells or less.
- **Landmark footprint rule.** A solid landmark becomes a simplified shape or a
  ring with openings. The Colosseum came out as one 99-cell wall blob; the
  shipped maximum is 15.
- **Corrections are data:** each city's hand edits are listed apart from the
  automatic changes, in the method note for the MVP and as a correction file
  once a converter exists.

### The Visual Mask

A companion file per city, `public/maps/city/<id>.mask.txt`, gives each cell a
render class. `W` cells are building or water; floor and crate cells are road,
plaza, park, bridge, crossing, tram or plain. The gameplay grid keeps only
`' '`, `W` and `B`. Only the client reads the mask, so it needs no protocol or
replay change. New cell characters were rejected: the loader throws on them,
and the server and replays would need compatibility work.

The MVP keeps the mask to colours and flat water. Each cell's colour already
travels as an instance colour (`staticTiles.ts:11-13`), so floor classes
recolour the ground layer without extra draws. Water draws flat in its own
layer with an existing layer's material settings, as the campaign's feature
layers do (`staticTiles.ts:24-25`), so no shader program is added. Phase 1a
adds detail per class (deck edges, tram rails, crossing stripes) within the
budget. Mask colours join the palette that high contrast recolours; water,
floor and buildings stay distinct for colour-blind players, and flames stay
readable on them. Today's only per-cell mask is campaign-only
(`staticTiles.ts:44-80`).

### Showing the Real Map

The play camera frames the players, so a player sees the top-left fifth of the
board at round start and little of its centre all match. Four things show the
real layout instead.

1. **Round-start overview.** Every round starts with a 3 s "Ready" countdown
   (`ROUND_START_COUNTDOWN_MS`, `initialState.ts:31`) while the arena is frozen
   (`reducer.ts:207-216`). In the first round, frame the whole board, then cut
   to the players before GO. Reuse the boss-entrance blend in `CameraRig`
   (`GameScene3D.tsx:2433-2467`), which cuts rather than sweeps across the
   board. Players can skip it; skipping only moves the camera, and the
   countdown runs as before. The prototype's `?overview` framing took 11
   lines.
2. **Top-down card.** A top-down render of the grid and mask is the city's
   picker card and loading view, with the OSM credit.
3. **Floor and water colours** from the mask. Floor tiles always draw, while
   landmarks follow the scenery setting, which is off by default on low-end
   devices (`gamePreferences.ts:91`).
4. **A skyline landmark.** Each city gets a look (sky, fog, lights, palette)
   and one code-built hero landmark on the far band, visible from the spawns.
   A landmark at the board centre would stay below the screen at spawn for any
   height up to 6 cells. A hero landmark is about 15–30 lines in
   `heroLandmarks.ts`, merged onto the shared `LANDMARK_MATERIAL`.

All four change only rendering, so none needs a `REPLAY_VERSION` bump. Where
each signature goes, and the rule against showing a landmark twice, are in
the map briefs. City names use Latin script; the bundled kanji font has only
16 glyphs.

Extruded OSM scenery is optional and late. If it ships, it stands only on the
far band and the upper sides, passes the existing camera test
(`landmarkPlacement.test.ts:113-140`), and has squashed heights: a 366 m tower
would be 23 cells tall at 16 m. It is footprint JSON (estimated 50–300 KB a
city) behind one dynamic `import()` per city, extruded at load and merged onto
the shared material. It casts no shadows, sits behind an error boundary that
falls back to the plain look, and stays out of `src/engine` so esbuild does not
bundle it into the server. No mesh files.

## Quality Gates

Gates come from the 7 shipped arenas. Hard gates decide; soft targets warn,
the developers look, and the playtest decides.

**Hard gates.** Every city map must pass all of them.

| Gate | Rule | Shipped maps |
| --- | --- | --- |
| Spawns | All four open and joined by crate-free lanes at round start; no sealed pockets | All pass |
| Spawn carve | The engine's carve changes no `W` cell, and no spawn or spawn neighbour is water in the mask | Not applied: hiddenCloud and hiddenStone lose walls to the carve |
| Seat balance | In 2-player CPU-hard runs of about 400 matches (every ordered fighter pair), each seat wins 40–60% of decided matches | Seat 1 won 43–52% in the existing 60-match runs; re-measure them in every run, and widen the band if one fails |
| Signature on screen | At least half of the map's signature cells (on the board or the far band) inside the 1366x768 play view for at least 25% of live ticks; the countdown does not count | No signature |

**Soft targets.** Percentages are of the 33x33 interior; crates count as
passable.

| Target | Shipped range | Threshold | Rome | Barcelona | Budapest |
| --- | --- | --- | --- | --- | --- |
| Playable cells | 80.4–87.1% | ≥ 75% | 79.6% | 56.7% | 60.4% |
| Articulation points | 0–1 cells | ≤ 2% of playable | 1.8% | 1.1% | 5.8% |
| Dead ends | 0–1 | ≤ 10 | 4 | 5 | 11 |
| 1-wide cells | 0.6–10.8% | ≤ 11% | 1.7% | 9.4% | 7.4% |
| Largest wall blob | 15 cells | ≤ 15; named landmarks and water exempt | 99 (Colosseum, exempt); 47 otherwise | 63 | 99 (river, exempt); 47 otherwise |
| Median match length | 38–60 s | From repeated shipped runs, with a margin | not run | not run | not run |
| Sudden-death share | 10–18% | From repeated shipped runs, with a margin | not run | not run | not run |

City columns are the 14 m prototype grids (Barcelona rotated 45°, Budapest's
river compressed). All three have their spawns open and joined, and the
engine's carve changes nothing on them. Seat balance, signature time and the
CPU baseline have not been run on them yet. Each misses soft targets:

- Rome needs its 47-cell block broken up, plus the landmark rule for play.
- Barcelona needs hollowed blocks (playable 56.7%, blob 63).
- Budapest needs more playable area (60.4%), a second crossing (articulation
  5.8%), fewer dead ends (11) and its 47-cell block broken up.

**CPU baseline.** 2 CPU-hard players, no monsters, 60 matches a map (every
ordered pair of six fighters, in two runs). Pooled, the shipped maps gave a
median match of 38–60 s and 10–18% of matches decided by sudden death. Single
30-match runs moved a map's median by up to 20 s and its sudden-death share by
up to 23 points. So set those two targets from repeated shipped runs with a
margin, never at one run's extremes, and re-measure the shipped maps in every
run with the same settings and sample size. With monsters on, one 30-match run
gave 36–59 s and 7–23%, so a map with monsters needs its own baseline. The
harness plays matches through `engineLoop` with the shipped AI; 1,332 matches
took about 55 s of compute. On-screen time comes from logged CPU positions and
the game's camera code.

**Static metrics do not predict how a match plays.** A block grid and an open
plaza looked alike on paper (37% and 31% walls, one region each, no dead ends,
the same longest line), yet their CPU matches ran a median 69 s against 48 s,
with sudden death in 35% against 15%. Matches also stay near the spawns and
break only 20–49% of crates, so whole-map numbers mis-measure. CPU play shows
mechanics, not fun, so the human playtest is the final gate.

## Online

Phase 1b. City rooms reuse the arena room flow.

**Built (2026-11-24):** protocol 4. Arena `create` carries an optional
`arenaMapId` (a village or `rome`, `barcelona`, `budapest`; never the
playtest's control), the `lobby` reports it, the server loads the grid from
the catalog, and the lobby's map select lists the villages and the cities.
Online city matches show the overview plate with the OSM credit. The client
error fix this section asks for shipped first (`onlineSession.ts`).

| File | Change |
| --- | --- |
| `onlineSession.ts` | First, fix terminal errors, and ship the fix in a release that still speaks protocol 3. On `upgrade-required` the client clears its seat (`:257-264`); the close handler (`:168-177`) then reconnects when a seat is stored, otherwise it overwrites the error, so "This game is out of date" never shows. Render deploys client and server separately, so every version bump takes this path. |
| `protocol.ts` | Arena `create` and `lobby` carry `arenaMapId`, checked against the catalog instead of the hard-coded stage list (strict keys at `:102-107`, `:137-147`, `:204-208`). Co-op rooms keep `stageId`. `PROTOCOL_VERSION` goes from 3 to 4. |
| `onlineServer.ts` | Rooms store `arenaMapId`; `createConfig` (`:188-203`) loads the grid from the catalog and rejects unknown ids. `start` already sends the grid, so clients never load one online. City grids join the maps the server bundle embeds; masks and looks stay client-only. |
| `OnlineLobbyScreen.tsx` | The text-only "Village" select becomes an arena select. |

New content ids leave `SIMULATION_VERSION` alone; spawn profiles would not.

**Server capacity is not a city prerequisite.** City rooms should cost the
same as village rooms (same 35x35 grid and snapshot shape; not load-tested),
so the free plan's limits apply to all online play and belong with the
roadmap's online work. Appendix E has the load test's numbers: about 3 rooms
run smoothly under an emulated 0.1-CPU quota, and that is an upper bound. One
condition: if `MAX_ROOMS` is lowered to about 3, first fix the bugs that let
rooms be held. Cap open lobby rooms per IP at 2–3, make the lobby deadline
absolute from `createdAt`, remove disconnected lobby guests, and close
finished rooms 1–2 minutes after game over. Otherwise one client, or three
finished rooms left open in browser tabs, blocks all online play.

**Hazard ids.** Arena rooms with versus monsters already mint duplicate hazard
ids when another room starts or changes round (the roadmap's P1 item). A
targeted run saw two live hazards share an id in 75 of 1,633 snapshots; the
untimed load test saw duplicates in 2–4 rooms per 20 s at 25–100 rooms. A city
with no monsters mints no hazard ids, so this does not block cities. If cities
get monsters, land the fix before they go online.

Both online prerequisites above are now fixed. Hazard ids live in match state
(`REPLAY_VERSION` 11), and the client keeps the server's final messages, so
"This game is out of date" shows.

## City Pulse (Later)

After the static maps are stable, add one generic, data-driven city event and
prototype Budapest Tram Rush with it. The first version's other ideas stay as
candidates: Tokyo crossing signals, New York steam vents, and a London bridge
section that closes. Events run in the authoritative simulation, follow from
match state and are telegraphed before they fire. The first version asked for
a viable escape route; this plan tightens that to an escape route from every
affected cell. Events get reducer, replay, multiplayer, balance and
accessibility checks. They can reuse `BossHazard` warning and active windows
(`types.ts:183-197`, `bosses.ts:310-328`), the `line` floor telegraph
(`hazardTelegraph.ts:6-39`) and sudden death's fixed-order board events
(`suddenDeath.ts:53-126`). `HazardKind` is closed (`types.ts:53-64`), so City
Pulse adds a kind. First:

- Land the hazard-id fix (see Online). Keep the counters in state and bump
  `REPLAY_VERSION` (10 at `e64a2e0`); if spawn profiles are also pending, ship
  both in one release.
- Define "spawn protection" as a tested rule. The engine only places versus
  monsters out of detection range of the spawns (`initialState.ts:100-158`);
  nothing protects spawns from hazards or events.

## Licensing and IP

Five actions:

1. Credit "© OpenStreetMap contributors", linked to
   <https://www.openstreetmap.org/copyright>, on the city card, the city's
   loading view and a credits page, and in each manifest with the ODbL link.
   The game has no credits screen yet (`README.md:136-150` holds the credits),
   so phase 1a adds one. The repo is public, so the MVP already needs the card
   credit and the notice.
2. Publish the method: commit the raw extract with its query and
   `timestamp_osm_base`, the rasterizer or a note on its algorithm, the hand
   edits, and an ODbL notice beside the city data.
3. Use stylised massing only, with invented ads and screen content: no
   sculpture, light shows or modern skyline buildings.
4. Exclude Berlin's Holocaust memorial, on ethical grounds and because it is
   likely still in copyright.
5. Credit William Tierney Clark for the Chain Bridge; Hungarian law requires
   naming the author.

Our reading of each output under the ODbL and the OSMF guidelines (not legal
advice):

| Artifact | Status | What we do |
| --- | --- | --- |
| Raw OSM extract | ODbL data, and substantial: every 700 m query box held 79–2,678 buildings and 315–1,056 highway ways | Commit it with the notice, the query and `timestamp_osm_base` |
| Cleaned extract plus corrections | A Derivative Database | Offer it under ODbL 4.6, as action 2 does |
| The grid | Most likely a Produced Work: it is not meant for extracting the data | Attribution where it appears. Share-alike does not reach the code (ODbL 4.5(b)), which stays MIT |
| The mask | A raster at the grid's resolution; treat it like the grid | As for the grid |
| Extruded footprints, if they ship | Treat as a Derivative Database: the exact footprints can be recovered | Publish under ODbL |
| Cards and overview images | Static images of areas over 10,000 m² need attribution | Credit on the image |

Publicly using a Produced Work counts as publicly using the Derivative
Database behind it (ODbL 4.4(c)), so section 4.6 requires offering that
database, a file of all alterations, or the method. In our reading, action 2
meets 4.6(b) before any converter exists. The first version asked for a
licensing review before public release; that is now a decision for after the
playtest.

Landmark law differs by country; Appendix D has the details. Being a
non-commercial fan project (`README.md:148`) lowers these risks but does not
remove them. The bigger exposure is not OSM. The game's characters, names and
village marks belong to Masashi Kishimoto, Shueisha and their licensees
(`README.md:148-150`). If the game is ever distributed beyond a non-commercial
fan project, that matters more than any map data.

## Performance Budget

Measure each city against hiddenLeaf in the same run, on a production build at
1366x768, with `PerfProbe` (`?perf`) read through `perfSampleAfter`
(`e2e/fixtures.ts:111`).

| Measure | Budget |
| --- | --- |
| Draw calls | At most the village arena's + 5 |
| City scenery triangles | ≤ 50,000 |
| Landmark draws | At most 6 instanced draws per look (existing test) |
| Shadows | City meshes cast none; a shadow pass would double their draws |
| Shader programs | None linked after GO; the total no higher than the village arena's |
| Frame time | On the oldest phone either developer owns, the median play-view frame is at most hiddenLeaf's + 10%, and at most 33 ms; checked in phase 1a, not gated in CI |

Reference points: hiddenLeaf's play view drew 73 calls, 76,097 triangles and
17 programs in one SwiftShader sample of a production build
(`ARCHITECTURE.md:315-316` records 67 calls for versus on a production build).
The prototype city grids drew 42–56 calls against 73; the gap is likely the
missing monsters and other actors on screen. Walls are instanced, so draw
calls do not grow with walls, but uniform Budapest's extra walls added 24%
triangles. Barcelona's 700 m box, extruded and merged, was 44,112 triangles.
The +5 and 50,000 figures are plausible for a mid-range phone, but no device
test has run.

## Tests After the MVP

The MVP's own acceptance list is in the MVP section.

### Phase 1

- 1a: the credits page shows the OSM credit and the ODbL link.
- 1a: the frame-time budget holds on the named phone.
- 1a: mask detail stays within the budget, and water and building classes sit
  only on `W` cells.
- 1b: a city id round-trips, an unknown id fails, and a protocol-3 client that
  has the error fix sees "This game is out of date". All seats get the
  server's grid, and resume keeps it.
- 1c: whichever tool builds the grids fails on a missing landmark polygon
  (Colosseum relation 1834818, Sagrada Família relation 9194723), an
  underground wall over Times Square (relation 11171765) or memorial stelae
  in Berlin.
- 1c: each city records its query, `timestamp_osm_base`, bounds, transform,
  hand edits and the ODbL notice.
- With the TypeScript tool: the same raw JSON, corrections and tool version
  give byte-identical outputs.

### Phase 2

- Every city that ships passes the hard gates, with its soft-target misses
  reviewed.
- A failed scenery load leaves the plain look, the same grid and a playable
  match.
- City Pulse: hazard ids do not change with what other rooms do, and every
  event is telegraphed and leaves an escape route from every affected cell.

## Appendix: Evidence

### A. Prototype Grids Against the Shipped Maps

Built from live OSM data, played through the real engine, and measured after
the engine's spawn carve, with crates counted as passable. The CPU median
comes from a different run than the gates: 4 CPUs (mixed hard and normal),
5 matches a map, with no monsters on the city maps and 2–3 on the shipped
maps. Single matches ranged from 7 to 136 s, so the medians are indicative
only.

| Map | Playable | Walls | Articulation points | 1-wide | Dead ends | Longest line, no crates / crates | Start network | Corrections | CPU median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shipped x7 | 80.4–87.1% | 12.9–19.6% | 0–1 | 0.6–10.8% | 0–1 | 33 / 13–20 | 350–513 | – | 37.7–61.4 s |
| Budapest 22 m, uniform | 37.4% | 62.6% | 68 (16.7%) | 24.1% | 25 | 33 / 14 | 65 | 14 manual, 9 pocket | 24.8 s |
| Budapest 14 m, river to 5 columns | 60.4% | 39.6% | 38 (5.8%) | 7.4% | 11 | 33 / 15 | 234 | 2 manual, 13 pocket | 31.0 s |
| Barcelona 14 m, 45° | 56.7% | 43.3% | 7 (1.1%) | 9.4% | 5 | 33 / 13 | 318 | 6 manual, 33 pocket, 5 crates | 38.6 s |
| Rome 14 m, north-up | 79.6% | 20.4% | 16 (1.8%) | 1.7% | 4 | 33 / 18 | 614 | 1 manual, 20 pocket | 64.7 s |
| Tokyo 14 m, north-up | 54.0% | 46.0% | 61 (10.4%) | 16.5% | 31 | 31 / 10 | 245 | 8 manual, 57 pocket | 64.6 s |

Before the pass, raw grids sealed Budapest seats 2 and 4 and north-up
Barcelona's seat 1 in 3–5-cell pockets, and the engine reported nothing. On
synthetic city layouts blast footprints shrank by 3–30%, with no overall
balance shift (per-fighter win rates swing about ±20 points at 20 games each).

### B. OSM Data Pitfalls

| Pitfall | Example | Handling |
| --- | --- | --- |
| Underground "buildings" | New York relation 11171765 is `building=train_station`, `layer=-1`, `location=underground`, 455x379 m | Filter them, or one walls over Times Square |
| Dropped relation members | `out tags geom` strips them; `out geom(bbox)` clips relations with nulls | Query with `out geom` |
| Multipolygon assembly | The Sagrada Família (relation 9194723) has 26 outer members, only 8 closed; a naive join left it hollow. The prototype's first assembler dropped single-ring relations, the Colosseum too | Assemble with osmtogeojson; test that each landmark polygon exists |
| Split rivers | The Danube near the bridge is relation 30036, and bbox clipping cuts rivers | Clip properly or flood-fill |
| Missing heights | The Sagrada Família (172.5 m) has no height tag. Height or level tags cover 2% (Istanbul) to 88% (Barcelona) of central buildings, not counting Berlin's stelae | Author landmark heights; estimate the rest from neighbours, as 3dcity-games does |
| Memorial stelae | Berlin's 2,603 stelae are tagged `building=yes` plus `man_made=stele` and enter crops at 16 m and above | Exclude memorials |
| Overpass limits | 10,000 queries and 1 GB a day, an identifying User-Agent, no parallel scripts; 502 on 7 of 18 attempts | Fetch once and commit the JSON with its query and `timestamp_osm_base`. BBBike covers 9 of 10 cities; Rome needs Geofabrik |

### C. Reference Repos

| Repo | Licence | Use |
| --- | --- | --- |
| ProfRino/pac-maps | MIT | A 2D road-graph Pac-Man on live Overpass roads, as the first version said. Its road filter (drops footways, motorways and driveways) is worth reusing. |
| yourplace3d/3dcity-games | MIT on the Hennes617 fork the first version linked ("Copyright (c) 2026 yourplace3d"); confirm the upstream's LICENSE before linking it | The upstream of that fork. On the fork, it fills missing heights from the median of the nearest neighbours (`src/game/localHeights.ts`; confirm the path upstream) and streams live vector tiles on three 0.187.0 (we use 0.160.1). Use it for the height idea only. |
| donmutti/city | None: no LICENSE file, and the "ISC" in package.json is npm's default | The closest architecture: one build-time Overpass query and a committed `city.json`. It queries `way["building"]` only, so it misses building relations, and has no ODbL notice. Ideas only, no code. |

### D. Landmark Law by Country

FoP means freedom of panorama: the right to depict works in public places.

| Place | Rule | What we do |
| --- | --- | --- |
| Rome, Colosseum | No FoP in Italy. The cultural-heritage code (D.Lgs. 42/2004 arts. 107–108) requires authorisation and fees for commercial reproduction of state heritage; a Palermo court applied it to the Teatro Massimo in 2017. | A real risk if the game is ever commercial. Stylised massing only. |
| Paris | No commercial FoP (L122-5 allows only non-commercial copies by natural persons). The Eiffel Tower operator claims its night lighting. | No light shows, no modern skyline buildings. |
| New York, Times Square | US FoP covers buildings only (§120(a)). Billboards and screens are 2D works and trademarks. | Invented ads. |
| Tokyo, Shibuya | FoP covers buildings; Art. 46(iv) bars copying artworks to sell copies. | Invented screen content. Hachikō statue not checked. |
| Barcelona, Sagrada Família | FoP covers audiovisual use (Art. 35(2)), within the three-step test. The later façade sculpture (Subirachs, Sotoo) is likely in copyright. | Stylised massing, no sculpture. |
| Berlin | §59 UrhG allows copies of works seen from public places only as paintings, drawings, photographs or film; a 3D game is a grey zone. The Pariser Platz buildings date from the 1990s–2000s. | Generic massing. Exclude the Holocaust memorial. |
| Budapest, Chain Bridge | FoP yes; Art. 67(3) requires naming the author. | Credit William Tierney Clark. |
| London, Istanbul, Prague | FoP covers buildings (UK s.62 CDPA, Turkey Law 5846 Art. 40, Czechia Act 121/2000 Art. 33(1)). The UK rule leaves out posters and murals; the Czech one excludes 3D copies, probably physical ones. | No posters or murals. |

### E. Online Server Capacity

The load test ran the real server bundle in docker with `--cpus=0.1`, on a
fast laptop core, with four-player rooms. Render's shared CPU is probably no
faster, so treat these as upper bounds.

| Rooms | Result |
| --- | --- |
| 2–3 | Smooth: p99 gap between snapshots ≤ 53 ms |
| 5 | Marginal |
| 8–12 | Degraded; at 12 the game ran at about 68% of real time |
| 20 | Collapse: every snapshot a 39 KB full state, 0.6 a second |

Memory is not the limit (110 MB at 20 rooms). `MAX_ROOMS` is 100
(`onlineServer.ts:32`), about 30x what the free instance can tick smoothly. A
four-player room sends about 94.5 KB/s of WebSocket traffic, not counting
TCP/IP and TLS headers (0.34 GB an hour). A Hobby workspace's 5 GB a month
therefore covers at most about 15 room-hours before Render charges, or
suspends the service without a payment method. The load test also recommends
making `MAX_ROOMS` an environment setting, sending no empty snapshots while a
room is idle, and not escalating to full states under backpressure.

### F. Sources

- OSM licence: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), [Produced Work](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline), [Substantial](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline), [Attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [copyright](https://www.openstreetmap.org/copyright).
- Data and law: [Overpass API limits](https://wiki.openstreetmap.org/wiki/Overpass_API), [freedom of panorama by country](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory).
- Render: [compute plans](https://render.com/docs/compute-plans), [free plan](https://render.com/docs/free), [outbound bandwidth](https://render.com/docs/outbound-bandwidth).
