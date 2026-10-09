# Explosive Shinobi Arena

A 3D browser arena game built with React, TypeScript, Three.js, and React Three Fiber. It turns a grid-bomb combat loop into a shinobi arena with character-specific bombs, themed explosions, seven village stages, procedural monsters, tailed-beast bosses, a saved campaign, local battles against friends or CPU opponents, and a deterministic engine ready for future online rooms.

Play it at <https://bomberman-zuqb.onrender.com>.

## Current Features

- **3D arena renderer.** Stylized low-poly diorama with toon-shaded, ink-outlined fighters, procedural monsters and bosses, animated bombs with fuse rings, and smooth movement between grid cells.
- **Solo Campaign.** Seven villages unlock in order. Each has objectives (rescue, defend, mini-boss gate, boss), fog of war, and a tailed-beast boss. Story, Normal, and Hard difficulty come with lives.
- **Local Arena.** Two or three players share one keyboard and gamepads.
  - Any seat can be a human or an Easy, Normal, or Hard CPU.
  - A match is one round, or best of 3 or 5.
  - Each round runs on a 90-second clock, then a sudden-death spiral closes the arena.
- **Training Dojo.** Four short rooms (move, bomb and step clear, read a blast, power-up and enemy) teach the loop by playing it, with the player's own keys and pad buttons in each goal line and the explanation only after the room is cleared. A first visit suggests it once; the Shinobi Manual and the Mission Deck link it. Rooms can be skipped or replayed, and progress is saved.
- **Quick starts.** The welcome screen offers Quick Play, which replays your last setup (or starts the campaign on a first visit), and Battle a CPU. The Mission Deck fits a Local Arena setup on one screen of player seat cards.
- **Readable match flow.**
  - Win pips and "Round 2 · First to 2" in the HUD.
  - A round-start line such as "P2 Naruto leads 1–0".
  - A short hold on the deciding moment before the result.
  - Knockouts named by player slot.
  - A sudden-death warning.
- **Gamepad support.** Pads play the match and drive every menu and dialog: the D-pad moves, A selects, B backs out, Start pauses or continues.
- **Accessibility and comfort.** Reduced motion, high contrast, HUD size, screen shake, sound and captions, and a Stage scenery switch for slower devices. Restart and Quit ask for confirmation.
- **Six shinobi loadouts.** Deidara, Naruto, Sasuke, Gaara, Minato, and Itachi.
- **Distinct bomb behavior.** Clay blasts, clone diagonals, Chidori piercing, sand control, teleport marks, crow illusions, and signature ultimates with longer fuses.
- **Character-specific explosion visuals.** Deidara clay and fire bursts, Naruto chakra swirls, Sasuke lightning with black flame accents, Gaara sand clouds, Minato teleport seals, and Itachi genjutsu and crow effects.
- **Character passives.**
  - Minato moves faster.
  - Gaara and Itachi can spend a defensive passive to survive an otherwise lethal hit.
  - Any survival save gives one second of grace.
- **Power-ups.** Bomb capacity, blast range, manual detonation, speed, guard shields and phase movement (both timed), and placeable cover. The campaign uses per-character pickup pools; Local Arena uses a seeded generic pool.
- **Village-themed enemies.** Rogue Genin, ANBU, Mist Ninja, Sand Ninja, Cloud Ninja, White Zetsu, and Black Zetsu. Their abilities are warned on the floor by shape, not only by colour.
- **Campaign exploration.** Destroyed crates can reveal nothing, a reward, White Zetsu, elite Black Zetsu, rare fragments, or hidden-area secrets. Respawn points keep villages dangerous while objectives unfold.
- **Installable web app.** The game ships a web manifest, so supported browsers can install it.
- **Future multiplayer groundwork.** Serializable engine actions, replay helpers, and room message types.

## Tech Stack

| Area | Choice |
| --- | --- |
| Language | TypeScript 4.9 (strict) |
| UI | React 18 with React Router 7 |
| 3D | three.js 0.160 through @react-three/fiber 8 (no drei) |
| Menus and HUD | MUI 5 with Emotion; theme colours as `--anime-*` CSS variables in `src/index.css`, light-only |
| Build | Vite 6. The 3D match is a lazy chunk, and three.js and the other dependencies are split into `vendor-three` and `vendor` |
| Tests | Vitest 4 with jsdom, Testing Library, and v8 coverage |
| Lint | ESLint 8 with the Airbnb config and typescript-eslint 7 |
| CI | GitHub Actions on every push and pull request to `main`: lint, test, build, then Playwright browser smoke tests on the build |
| Hosting | Render static site that deploys `main`. `render.yaml` describes the intended setup as a Blueprint: build `npm ci && npm run build`, publish `build/`, the SPA rewrite, and long-lived caching for hashed assets |
| Runtime | Node.js 22 (`.node-version`) |

## Architecture

The game separates a **pure, deterministic engine** from everything that draws it.

```text
keyboard / gamepad / CPU brains
            │  serializable actions (MOVE, DROP_BOMB, USE_ULTIMATE, …)
            ▼
engine loop (src/hooks/engineLoop.ts)
  fixed 50 ms ticks of the pure reducer (src/engine/)
  records motion tracks and render-only cues as it steps
            │
            ├── engine store + selectors ──► React screens and HUD (DOM)
            └── scene state + live state ──► 3D scene (React Three Fiber)
```

- **Engine** (`src/engine/`). A pure reducer over serializable state: players, bombs, flames, monsters, bosses, hazards, the campaign, fog of war, and sudden death.
  - Randomness comes from a seeded generator (`random.ts`), so the same config and action stream always give the same match.
  - `src/network/replay.ts` replays recorded actions under a `REPLAY_VERSION`, which is bumped on every rule change.
- **Engine loop** (`src/hooks/engineLoop.ts`). Runs the simulation outside React.
  - Ticks are fixed at 50 ms, at most four per frame, with frame time capped at 100 ms.
  - Held movement repeats every 28 ms, or 18 ms for Minato or with a speed boost, and buffers turns at intersections.
  - CPU players (`src/ai/`) think after each tick and act only through ordinary actions. The reducer never knows who is a CPU.
- **Motion and cues.** Each step records a short motion track (`motionStore.ts`), so the scene glides fighters between cells at display rate. Plant, hit, ultimate, and knockout poses come from a render-only cue store (`cueStore.ts`) that never writes engine state.
- **React side.**
  - The game screen reads the engine through a store with selectors (`engineStore.ts`). The HUD, the scene, and the countdown announcer are separate leaves, so each re-renders only when something it shows changes.
  - The scene and HUD receive states that keep their identity across clock-only ticks (`useRenderState.ts`). Time-driven visuals such as fuses and flames read the live engine state each frame instead.
- **Input** (`src/input/`). Keyboards are bound per player. One shared gamepad poll serves both play and menus, and a press belongs to one side only.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the state flow, the render pipeline, and the directory map.

## How We Keep It Smooth

Smoothness comes before visual fidelity. A visual change has to show that it costs nothing measurable per frame, or it does not ship. For example, a full-map shadow upgrade was dropped because of its GPU cost.

### Rendering rules

- **No shader compiles during a match.**
  - three.js recompiles every lit material when the number of lights changes. So all dynamic lights come from a fixed pool of five (`scene/LightPool.tsx`), and a raw `<pointLight>` is never added.
  - Every material variant is compiled during the 3-2-1 countdown (`scene/ShaderWarmup.tsx`), with fog on, as in play.
- **Instancing and shared resources.**
  - Floor, walls, crates, and off-grid landmarks are instanced meshes (`scene/StaticTiles.tsx`, `StageLandmarks.tsx`).
  - Geometry, materials, label sprites, and skeletons are shared module-level resources, not per entity.
  - Each fighter's ink outline is one merged inverted-hull mesh: one extra draw call per fighter.
- **Render only what changed.** The canvas runs on demand under a real pause and under the result dialog. Clock-only ticks skip React work. Hazards and other layers are memoised separately.
- **Cheap accessibility.**
  - High contrast retones palettes and materials instead of filtering the canvas.
  - Nothing full-screen is composited over the arena: no `backdrop-filter`, blend modes, or vignettes.
- **Fixed budgets.**
  - Antialiasing is off, and the device pixel ratio is capped at 1.35.
  - The camera frames the players' box against the measured HUD bands (`scene/cameraFraming.ts`), so no player is drawn under the HUD on any screen shape.
- **Fast first load.**
  - The 3D match is a lazy chunk, prefetched when the title screen is idle and when the Mission Deck opens.
  - The title paints from static HTML before React loads.
  - Images are WebP, and the stage maps are bundled instead of fetched.

### How changes are verified

- **Behaviour tests.** Every bug fix or rule change comes with a behaviour-level test that fails on the old code and passes on the new. Key fixes are also checked the other way round: undo the fix, and the test must fail.
- **Production-build measurements.** Performance claims are measured on production builds, never the dev server, in headless Chromium. The metrics transfer across machines:
  - shader programs, and compiles after the round goes live;
  - draw calls and triangles;
  - frame script time and long tasks;
  - React components rendered per engine tick.
- **Seeded simulations for AI and balance.** Seeded CPU-vs-CPU and simulated-human matches across all seven maps check AI and balance changes. Examples: own-bomb deaths per difficulty, and how often a scripted human beats each level.

### Measured effects (headless Chromium, production builds)

| Change | Before | After |
| --- | --- | --- |
| Instanced tiles | 445 draw calls (versus) | 115 |
| Fixed light pool plus shader warmup | 1–2 s freezes when a light appeared | no compiles after the round goes live |
| Render-state identity | about 30 scene components per tick | 5–7 |
| Leaf components on the game screen | about 10 DOM components per tick | about 4 |
| On-demand canvas | GPU process about 550% CPU with Settings open | about 1% |
| Lazy match chunk plus static first paint (slow 4G) | welcome JS 449 KB, largest paint 5.5 s | 196 KB, 1.2 s |

## Current Project State vs. v2.0 PRD

The latest product direction is larger than the current implementation.
- **Phases 1 and 2** are implemented across all seven campaign stages.
- **Phases 3 and 4** have playable procedural slices:
  - stage-specific objective labels and mini-boss gates;
  - defense HP and failure;
  - deterministic village events;
  - persisted discoveries, fragments and reputation;
  - HUD campaign intel;
  - optional model slots with procedural fallbacks;
  - transformation overlays and boss phase cues;
  - large-map render optimizations.
- **Still planned:** fully bespoke hubs, 50x50 maps, custom asset packs, and online multiplayer.

Implemented today:

- **Maps:** dense 35x35 campaign maps for Hidden Leaf, Hidden Sand, Hidden Mist, Hidden Cloud, Hidden Stone, Akatsuki Hideout, and Great Shinobi War.
- **Campaign route and saves:**
  - The route starts at Hidden Leaf, unlocks villages in order, stores completed stages, unlocks characters and rewards, and resumes from the last village.
  - Campaign runtime state covers current village, mission step, objective progress, defense structures, spawn points, discovered secrets, boss arena state, and mission result.
  - Story saves are versioned and migrate objective progress, mission results, fragments, reputation, and story completion.
- **Objective loop (Phase 1), every stage:** rescue targets, protect a stage-specific structure, clear a mini-boss gate, open the boss arena, defeat the boss, and earn the reward.
- **Rendering and maps:**
  - Map loading and 3D camera/floor support for 35x35+ campaign rows, while the compact arena fixtures stay compatible.
  - Per-stage looks: sky gradient, fog, light colours, and instanced landmark silhouettes outside the playable grid.
  - The menus, the 3D match, and the vendor code load as separate chunks.
- **Bosses:** solo boss encounters on the tailed-beast boss engine.
- **Vision and fog of war:** character vision radii, Deidara explosion reveal, Sasuke/Itachi/Minato enemy sensing, and Gaara wall sensing.
- **Characters:**
  - Character-themed bomb behaviour, ultimate effects, passives, power-up labels, and HUD/manual presentation.
  - Per-character campaign pickup pools with PRD signature rewards, and a distinct procedural 3D model for every pickup type.
- **Exploration:**
  - Hidden-area metadata on every campaign map: a scroll cache, an archive fragment, and an elite Zetsu burrow per stage.
  - A deterministic destroyed-crate outcome table: 60% nothing, 20% power-up, 15% White Zetsu, 4% elite Zetsu, and 1% rare reward.
  - Persisted discovery tracking for rare scrolls, archive fragments, reputation, and discovered secret IDs.
- **Enemies:**
  - Shinobi archetypes with warned abilities: Kunai Throw, Body Flicker, Water Clone, Sand Spike, Lightning Strike, and Zetsu Ambush.
  - Finite awareness: Zetsu, patrols, and mini-boss guards only chase or attack after detecting nearby players. Tailed-beast bosses keep full-arena pressure.
  - Danger-map monster AI that steers around bombs and chain reactions.
  - Respawn point state with timers, max-active caps, active monster tracking, and deterministic archetype rotation.
  - Active mini-boss gate guards for every stage. The boss arena opens only after the guard is defeated and the gate is reached.
- **Village events:** Nine Tails Alert, Sandstorm, Dense Fog, Lightning Storm, Rockslide, Akatsuki Ambush, and Warfront Surge. Events change visibility, respawn pressure, or defense damage.
- **HUD campaign intel:** active event, reputation, secret progress, fragments, objective progress, structure HP, and boss gate state.
- **Presentation:** procedural transformation and ultimate-ready overlays, and boss phase cues, that work even when optional `.glb` assets are missing.
- **Local Arena:**
  - Two or three players, any seat human or CPU, with best-of-1/3/5 matches, a round clock, and a sudden-death spiral.
  - Shared-screen movement bounds keep players inside one camera window (12x8 cells, stretched 1.5x while a player escapes danger).
  - Quick Play and in-game restart reuse the same map, characters, upgrade, controls, CPU seats, and round count.
- **Engine:** deterministic actions, seeded randomness, and replay/network type groundwork.

Not implemented yet:

- Fully bespoke 50x50 campaign maps, physical secret-room geometry, and boss arenas hidden inside larger exploration maps.
- Route-specific puzzle mechanics beyond the current touch/defense/mini-boss objective framework.
- Village hubs, NPCs, currency, shops, and conversation flows.
- Bespoke enemy-wave scripts beyond the current respawn-pressure and defense HP systems.
- Lore collectible screens beyond persisted rare scroll and fragment counters.
- Fully bespoke `.glb` pickup and enemy models beyond the current procedural fallbacks.
- Touch controls for phones. Phones render the arena but need a keyboard or gamepad today.
- Boss intro/death cinematics, custom boss models for every beast, and online multiplayer.

## Implementation Plan

This is the working plan for implementing the v2.0 PRD in a way that matches the current codebase.

### Phase 1 - Campaign Foundation

Goal: turn the existing saved boss route into a real campaign loop without breaking the deterministic engine.

1. Add a data-driven campaign mission catalog in `src/content/` for villages, districts, objective types, defense structures, mini-boss gates, and boss unlock requirements.
2. Add campaign runtime state to `src/engine/types.ts`: current village, mission step, objective progress, structures, spawn points, discovered secrets, and mission result.
3. Keep all objective changes reducer-driven through serializable actions so future online mode can replay them.
4. Expand map loading to support larger 35x35+ maps while keeping current arena maps as compatibility fixtures.
5. Implement full stage loops across all campaign maps: exploration, rescue targets, protect structures, mini-boss gates, boss arenas, and rewards.
6. Version the save schema in `src/story/` so old local saves migrate cleanly into objective progress, fragments, reputation, and story completion.
7. Extend fog of war with PRD-specific sensing: Sasuke hidden enemy reveal, Itachi enemy outlines, Minato proximity sensing, Gaara wall sensing, and Deidara explosion reveal.

Exit criteria:

- A new player can start any campaign stage, complete objectives, unlock the boss, earn the reward, and resume after reload.
- Campaign logic has reducer tests for objective progress, save migration, fog reveal, and boss unlock gates.

### Phase 2 - Powerups, Enemies, and Exploration Rewards

Status: implemented across all seven campaign stages.

Goal: make exploration feel dangerous and character-specific.

1. Replace generic campaign pickup pools with per-character pools while preserving existing generic powers for local arena compatibility.
2. Add pickup definitions for Rasengan, Sharingan, FTG Kunai, Crow Feather, Sand Armor, Clay Spider, and other PRD items.
3. Add 3D pickup rendering hooks in `GameScene3D` using procedural fallbacks first, then optional `.glb` assets.
4. Add hidden-area metadata to maps so destroyed boxes/walls can reveal secret rooms, scrolls, fragments, rare rewards, or enemies.
5. Implement the Zetsu spawn table from destroyed walls: nothing, power-up, White Zetsu, Elite Zetsu, rare reward.
6. Convert current monsters into shinobi enemy archetypes with deterministic ability state: kunai throw, body flicker, water clone, sand spike, lightning strike, and Zetsu melee.
7. Add respawn point state with timers and max-active limits.

Exit criteria:

- Exploration creates meaningful uncertainty through secrets, Zetsu spawns, and character-specific rewards.
- Enemy abilities are tested in engine-level reducer tests and render with readable warnings.

### Phase 3 - Mission Variety

Status: implemented as a deterministic procedural campaign layer, with deeper bespoke mission scripting still available for future polish.

Goal: make villages feel like places with changing objectives rather than boss menus.

1. Implement mini-boss entities and objective gates for Iruka, Kankuro, Haku, Darui, Akatsuchi, Obito, and other route defenders.
2. Add village defense missions with structure HP, enemy wave timers, success/fail conditions, and reward resolution.
3. Add deterministic village events such as Nine Tails Alert, Sandstorm, Dense Fog, Lightning Storm, and Rockslide.
4. Add reputation and character fragment progression to `src/story/`.
5. Add campaign UI panels for objective tracker, structure HP, wave timers, fragments, reputation, and reward summary.

Exit criteria:

- At least two villages have different objective chains and one defense mission each.
- Failing and retrying a mission preserves appropriate campaign progress without corrupting saves.

### Phase 4 - Visual and Asset Upgrade

Status: implemented with optional asset slots and procedural fallback presentation; bespoke external asset production remains future work.

Goal: upgrade presentation without tying core gameplay to licensed or heavy assets.

1. Define asset slots for character models, enemy models, mini-bosses, boss models, defense structures, village props, pickup models, and transformation overlays.
2. Add procedural fallbacks for every required asset slot.
3. Add transformation overlays as a visual/state layer, not separate playable characters.
4. Add boss intro, phase transition, death, and reward presentation components.
5. Optimize large-map rendering with memoized visibility groups, shared visibility sets, and lower-allocation camera/pathfinding hot paths.

Exit criteria:

- Missing assets never break gameplay.
- Transformations, boss phases, and pickups are visible, performant, and covered by smoke tests.

### Phase 5 - Online Multiplayer

Goal: use the existing deterministic architecture for online play.

1. Finalize serializable action contracts for campaign co-op, arena PvP, boss raids, and lobby setup.
2. Add room lifecycle types for friend lobbies, private rooms, readiness, character selection, and stage selection.
3. Add deterministic replay validation for campaign objectives, enemy AI, pickups, and boss hazards.
4. Build a network adapter after local deterministic replay is stable.
5. Add co-op campaign and boss raid UI flows.

Exit criteria:

- Local replay and networked replay produce the same state for the same action stream.
- Co-op campaign can reconnect or recover from saved action/state snapshots.

## Immediate Next Slice

The next engineering slice should be **bespoke Phase 4 polish before Phase 5**:

1. Add real hub screens for village NPCs, shops, loadout changes, and lore discoveries.
2. Build route-specific puzzle mechanics beyond touch targets, such as shrine activation orders, bridge switches, earth-seal collection, and puppet tower disabling rules.
3. Add touch controls for phones, built on the same input path as keyboards and gamepads.
4. Add browser-level smoke tests for canvas rendering to CI.
5. Start custom `.glb` enemy, pickup, structure, and boss asset production against the existing asset slots.

## Character Loadouts

| Character | Basic Bomb | Ultimate | Gameplay Identity |
| --- | --- | --- | --- |
| Deidara | Clay Spider Bomb | C3 Giant Bomb | Area bomber with fast clay fuses, pure explosive visuals, and huge raw blast coverage |
| Naruto | Shadow Clone Bomb | Rasenshuriken | Clone pressure with extra marks and Rasengan-style blue chakra explosion swirls |
| Sasuke | Chidori Mine | Kirin | Lightning control with electric lanes, piercing bombs, and black flame explosion accents |
| Gaara | Sand Coffin Trap | Sand Tsunami | Sand control, enemy-delay effects, sand-cloud explosions, and one automatic sand shield |
| Minato | Flying Thunder Mark | Instant Teleport | Speed and seal play with quick Flying Thunder God marks, teleport effects, and blink pressure |
| Itachi | Crow Clone | Tsukuyomi | Genjutsu traps with awkward crow-clone angles, red illusion bursts, and one illusion dodge |

## Visual Direction

- **Fighters** are procedural chibi figures: toon-shaded, with a dark ink outline and slot-coloured floor rings and tags. Short render-only poses show moving, planting, getting hit, using an ultimate, and falling. A KO marker stays where a ninja fell.
- **Stages** each have their own sky, fog, light colours, and a few landmark silhouettes outside the grid. The playable grid itself stays quiet and readable.
- **Enemies and bosses** read by silhouette first: each archetype has its own head shape, carried shape, and motion, and each boss its own base. Overhead nameplates carry name and threat.
- **Hazards** use a stable floor shape per family (line, cross, ring, or diamond). The outline closes as the hazard turns lethal, so danger reads by shape as well as colour.
- **Optional `.glb` models.** The renderer can load character and boss models from `public/models/characters/`. That path is switched off (`USE_ARCHIVE_MODELS = false` in `GameScene3D.tsx`), so the game ships with procedural figures only.
- **Original art only.** The visual language borrows shinobi grammar (silhouette, ink, paper, smoke) and avoids copying franchise emblems, costumes, or signature poses.
- **Shared content.** The roster board and Shinobi Manual stay in sync with the implemented characters, monsters, stages, bosses, and power-ups.

## Getting Started

Use Node.js 22, matching `.node-version` and the Render runtime.

```bash
npm install
npm start
```

The Vite dev server opens the game in the browser.

Judge performance on a production build: `npm run build && npm run preview`. In development, React StrictMode runs effects twice, and the development build of React is several times slower on the overlay UI.

## Useful Scripts

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

- **Browser tests.** `npm run test:e2e` builds the game and runs the Playwright smoke tests in `e2e/` in headless Chromium. Install the browser once with `npx playwright install chromium`.

## Project Layout

| Path | Responsibility |
| --- | --- |
| `src/engine/` | Deterministic simulation: reducer, players, bombs, monsters, bosses, hazards, campaign, fog of war, sudden death, seeded randomness |
| `src/ai/` | CPU players for Local Arena (Easy, Normal, Hard) and their per-seat controllers |
| `src/hooks/` | Engine loop, engine store, motion and cue stores, React bridges (`useGameEngine`, `useRenderState`), gamepad input |
| `src/input/` | Keyboard bindings, shared gamepad poll, and gamepad menu navigation |
| `src/content/` | Character, stage, stage look, enemy, boss, campaign, and power-up catalogs |
| `src/story/` | Saved campaign progress and unlocks |
| `src/network/` | Replay helpers and future online-room message types |
| `src/view/WelcomeScreen/`, `ConfigScreen/`, `InstructionsScreen/` | Title screen, Mission Deck setup, and Shinobi Manual |
| `src/view/GameScreen/` | Match screen, HUD, result dialog, settings, and the 3D scene (`GameScene3D.tsx`) |
| `src/view/GameScreen/scene/` | Scene building blocks: light pool, shader warmup, instanced tiles, camera framing, stage atmosphere and landmarks, figures, outlines, telegraphs, cues |
| `public/maps/` | Text map layouts for the stages |
| `public/models/characters/` | Optional `.glb` model slots and asset notes |

## Controls

Each player has four movement keys and four actions: bomb, detonate, ultimate, and cover.

| Player | Move | Bomb | Detonate | Ultimate | Cover |
| --- | --- | --- | --- | --- | --- |
| P1 | W A S D | 2 | 1 | 3 | 4 |
| P2 | Arrow keys | O | I | P | [ |
| P3 | U H J K | 7 | 6 | 8 | 9 |

- **Rebinding.** Keys can be changed in the Mission Deck or from Settings in the pause menu, and are saved for the next run. CPU seats need no keys.
- **Gamepads.** The first gamepad plays the first human seat, the second gamepad the next human seat, and CPU seats are skipped. Esc or Start pauses the game.

## License

This project is licensed under the MIT License.
