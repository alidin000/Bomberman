# City Arena Gates

Written by `npm run gates` on 2026-11-23 (tools/city/README.md says how to run it).
Each map played 420 CPU-hard matches, 2 players, no monsters:
every ordered pair of the 6 fighters 14 times, with the same seeds on every map.
The shipped arenas are re-measured in the same run. Gates and targets are in
docs/REAL_CITY_ARENAS_PLAN.md, "Quality Gates".

## Hard Gates

Seat balance: each seat wins 38.5-61.5% of decided matches (widened: a shipped arena fell outside 40-60%).
Signature on screen: at least half of the signature cells inside the 1366x768
play view for at least 25% of live frames (the countdown does not count).

| Map | Spawns | Spawn carve | Seat balance | Signature on screen | Result |
| --- | --- | --- | --- | --- | --- |
| Rome | pass: joined by crate-free lanes, 0 sealed cells | pass: 0 walls opened, no water at a spawn | pass: seat 1 won 44.5% of 373 decided (95% CI 39.5-49.6) | pass: 68.6% of live frames (board) | PASS |
| Barcelona | pass: joined by crate-free lanes, 0 sealed cells | pass: 0 walls opened, no water at a spawn | pass: seat 1 won 54.4% of 351 decided (95% CI 49.2-59.6) | pass: 43% of live frames (skyline) | PASS |
| Budapest | pass: joined by crate-free lanes, 0 sealed cells | pass: 0 walls opened, no water at a spawn | pass: seat 1 won 45.7% of 357 decided (95% CI 40.6-50.8) | pass: 65.5% of live frames (board) | PASS |
| Rome (control) | pass: joined by crate-free lanes, 0 sealed cells | pass: 0 walls opened, no water at a spawn | pass: seat 1 won 46.3% of 352 decided (95% CI 41.2-51.5) | pass: 34.2% of live frames (skyline) | PASS |

## CPU Matches

Seat 1 starts at (1,1), seat 2 at (13,8). Sudden death: the round reached the
90 s clock. Signature: the board's landmark cells (the mask's `m`),
else the skyline landmark's footprint on the far band, measured at half the landmark's
height (its towers and roofs, not its base); skyline: that measure alone.

| Map | Matches | Decided | Draws | Seat 1 wins (95% CI) | Median match | Sudden death | Signature on screen | Skyline on screen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rome | 420 | 373 | 47 | 44.5% (39.5-49.6) | 43 s | 15.2% | 68.6% (32 cells) | 46.2% |
| Barcelona | 420 | 351 | 69 | 54.4% (49.2-59.6) | 51 s | 20.5% | 43% | 43% |
| Budapest | 420 | 357 | 63 | 45.7% (40.6-50.8) | 50.9 s | 14% | 65.5% (4 cells) | 69.9% |
| Rome (control) | 420 | 352 | 68 | 46.3% (41.2-51.5) | 53.9 s | 19.8% | 34.2% | 34.2% |
| Hidden Leaf Village | 420 | 356 | 64 | 46.3% (41.2-51.5) | 41.3 s | 8.3% | n/a | n/a |
| Hidden Sand Village | 420 | 339 | 81 | 46.3% (41.1-51.6) | 52 s | 19.3% | n/a | n/a |
| Hidden Mist Village | 420 | 380 | 40 | 47.9% (42.9-52.9) | 49.3 s | 17.9% | n/a | n/a |
| Hidden Cloud Village | 420 | 386 | 34 | 49% (44-53.9) | 42.2 s | 13.6% | n/a | n/a |
| Hidden Stone Village | 420 | 324 | 96 | 48.5% (43.1-53.9) | 43.5 s | 14.3% | n/a | n/a |
| Akatsuki Hideout | 420 | 371 | 49 | 61.5% (56.4-66.3) | 44.4 s | 9.8% | n/a | n/a |
| Great Shinobi War | 420 | 352 | 68 | 48.6% (43.4-53.8) | 50.4 s | 17.9% | n/a | n/a |

Soft targets from the shipped arenas in this run: median match 31.3-62 s
(their range ± 10 s), sudden death at most 24.3% (their highest + 5).

## Layout

Measured on the round-start map (the engine's spawn carve, 4 seats), inside the wall
border, crates counted as passable. Wall blob leaves out water and the board's
landmark. Line: the longest straight run of open cells, then of crate-free cells.
Soft targets: playable ≥ 75%, articulation points ≤ 2% of playable,
dead ends ≤ 10, 1-wide cells ≤ 11%, wall blob ≤ 15.

| Map | Playable | Walls | Crates (of playable) | Artic. points | Dead ends | 1-wide | Wall blob | Line | Carve (walls / crates) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rome | 93.3% | 6.7% | 26.5% | 0 (0%) | 0 | 0.7% | 9 | 33 / 18 | 0 / 0 |
| Barcelona | 82% | 18% | 26.5% | 0 (0%) | 0 | 2.9% | 14 | 33 / 18 | 0 / 0 |
| Budapest | 71.8% | 28.2% | 26.3% | 0 (0%) | 0 | 6.6% | 11 | 33 / 16 | 0 / 0 |
| Rome (control) | 83.8% | 16.2% | 26.2% | 0 (0%) | 0 | 1.3% | 15 | 33 / 17 | 0 / 4 |
| Hidden Leaf Village | 87.1% | 12.9% | 26.4% | 0 (0%) | 0 | 0.6% | 15 | 33 / 15 | 0 / 3 |
| Hidden Sand Village | 84.7% | 15.3% | 27.5% | 0 (0%) | 0 | 1.3% | 15 | 33 / 16 | 0 / 3 |
| Hidden Mist Village | 83.7% | 16.3% | 26.8% | 0 (0%) | 0 | 1.1% | 15 | 33 / 20 | 0 / 3 |
| Hidden Cloud Village | 80.4% | 19.6% | 27.1% | 1 (0.1%) | 1 | 10.8% | 15 | 33 / 18 | 2 / 3 |
| Hidden Stone Village | 83.9% | 16.1% | 26.1% | 0 (0%) | 0 | 1.1% | 15 | 33 / 20 | 1 / 4 |
| Akatsuki Hideout | 83.8% | 16.2% | 26.3% | 0 (0%) | 0 | 1.3% | 15 | 33 / 17 | 0 / 3 |
| Great Shinobi War | 85.8% | 14.2% | 27.1% | 0 (0%) | 0 | 0.9% | 15 | 33 / 13 | 0 / 1 |

## Soft-Target Misses

- **Budapest**: playable 71.8% < 75%. Accepted: the Danube alone is about 14% of the interior; the land is about 83% playable.
