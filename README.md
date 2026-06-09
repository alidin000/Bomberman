# Explosive Shinobi Arena

A 3D browser arena game built with React, TypeScript, Three.js, and React Three Fiber. The current build turns a grid-bomb combat loop into a shinobi boss arena with character-specific bombs, themed explosions, village stages, procedural monsters, tailed-beast bosses, story unlocks, and a network-ready engine for future online rooms.

## Current Features

- **3D arena renderer** with textured village floors, animated bombs, optional `.glb` shinobi models, procedural fallbacks, low-poly monsters, warning hazards, and smooth entity movement.
- **Solo boss mode** with procedural tailed-beast models, phase-based abilities, danger-zone warnings, boss health, and story rewards.
- **Campaign route and save/resume flow** with sequential village unlocks, completed-stage tracking, story completion state, and a playable Great Shinobi War route stop.
- **Campaign fog of war** with visible, explored, and hidden map memory driven by character vision radius.
- **Local arena mode** for two or three players with configurable controls and trial targets.
- **Hybrid smooth movement** keeps bombs and explosions grid-based while held direction keys move characters through 0.1-cell decimal steps, with lane-centering and planted-bomb escape like classic Bomberman movement.
- **Six shinobi loadouts**: Deidara, Naruto, Sasuke, Gaara, Minato, and Itachi.
- **Distinct bomb behavior**: clay blasts, clone diagonals, Chidori piercing, sand control, teleport marks, crow illusions, and signature ultimates.
- **Longer ultimate fuses** give players time to escape oversized signature blasts after activating them.
- **Character-specific explosion visuals**: Deidara clay/fire bursts, Naruto Rasengan chakra swirls, Sasuke lightning with black flame accents, Gaara sand clouds, Minato teleport seals, and Itachi genjutsu/crow effects.
- **Character-themed power-up UI** with profile-card and manual notes for every pickup effect, using labels such as Clone Training, FTG Kunai, Sand Armor, Sharingan Timing, and Yata Mirror.
- **Campaign-specific pickup pools** with signature rewards such as Rasengan, Sharingan, FTG Kunai, Crow Feather, Sand Armor, Clay Spider, Chakra Scroll, and Character Fragment while local arena crates keep the generic legacy pool.
- **Verified power-up mechanics** for bomb capacity, blast range, manual detonation, speed boosts, guard shields, phase movement, and placeable cover. Manual bombs use a dedicated detonate key, and cover pickups use a dedicated cover key.
- **Character passives**: Minato has faster movement, while Gaara and Itachi can spend defensive passives to survive an otherwise lethal hit.
- **Character notes** in the roster, manual, and loadout picker explain each shinobi's bomb, ultimate, passive, and playstyle before a match starts.
- **Village-themed enemies** such as Rogue Genin, ANBU, Mist Ninja, Sand Ninja, Cloud Ninja, White Zetsu, and Black Zetsu, each with deterministic ability warning state.
- **Campaign exploration rewards** where destroyed crates can reveal nothing, character-specific rewards, White Zetsu, elite Black Zetsu, rare fragments, or authored hidden-area secrets.
- **Campaign respawn points** with timers, active-enemy caps, and deterministic archetype rotation so solo villages stay dangerous while objectives unfold.
- **Safe round starts** with spawn cells and escape lanes cleared across village maps, including local arena resets.
- **Optimized explosion flow** that computes only affected cells, reduces blast-loop allocations, and avoids unnecessary 3D scene rerenders during explosion timers.
- **Future multiplayer groundwork** through serializable engine actions, replay helpers, and room-selection message types.

## Current Project State vs. v2.0 PRD

The latest product direction is larger than the current implementation. Phases 1 and 2 are implemented across all seven campaign stages, and Phases 3 and 4 now have playable procedural slices: stage-specific objective labels, mini-boss gates, defense HP/failure, deterministic village events, persisted discoveries/fragments/reputation, HUD campaign intel, optional model slots, procedural fallbacks, transformation overlays, boss phase cues, and large-map render optimizations. Fully bespoke hubs, 50x50 maps, custom asset packs, and online multiplayer remain planned work.

Implemented today:

- Dense 35x35 campaign maps for Hidden Leaf, Hidden Sand, Hidden Mist, Hidden Cloud, Hidden Stone, Akatsuki Hideout, and Great Shinobi War.
- A saved campaign route that starts at Hidden Leaf, unlocks villages sequentially, stores completed stages, unlocks characters/rewards, and resumes from the last village.
- Phase 1 objective loops for every stage: rescue targets, protect a stage-specific structure, clear a mini-boss gate, open the boss arena, defeat the boss, and earn the reward.
- Campaign runtime state for current village, mission step, objective progress, defense structures, spawn points, discovered secrets, boss arena state, and mission result.
- Versioned story save migration for objective progress, mission results, fragments, reputation, and story completion.
- Map loading and 3D camera/floor support for larger 35x35+ campaign rows while keeping existing compact arena fixtures compatible.
- Solo boss encounters using the existing tailed-beast boss engine.
- Character vision radii, campaign fog of war, Deidara explosion reveal, Sasuke/Itachi/Minato enemy sensing, and Gaara wall sensing.
- Character-themed bomb behavior, ultimate effects, passives, power-up labels, and HUD/manual presentation.
- Per-character campaign pickup pools with PRD signature rewards and procedural 3D pickup fallbacks.
- Hidden-area metadata on every campaign map, including a scroll cache, archive fragment, and elite Zetsu burrow per stage.
- Deterministic destroyed-crate outcome table: 60% nothing, 20% power-up, 15% White Zetsu, 4% elite Zetsu, and 1% rare reward.
- Shinobi enemy archetypes with warned ability state for Kunai Throw, Body Flicker, Water Clone, Sand Spike, Lightning Strike, and Zetsu Ambush.
- Finite enemy awareness so Zetsu, patrols, and mini-boss guards only chase or attack after detecting nearby players; tailed-beast bosses keep full-arena pressure.
- Campaign respawn point state with timers, max-active caps, active monster tracking, and deterministic archetype rotation.
- Active mini-boss gate guards for every campaign stage; the boss arena opens only after the guard is defeated and the gate is reached.
- Deterministic village events such as Nine Tails Alert, Sandstorm, Dense Fog, Lightning Storm, Rockslide, Akatsuki Ambush, and Warfront Surge. Events modify visibility, respawn pressure, or defense damage.
- Persisted discovery tracking for rare scrolls, archive fragments, reputation, and discovered secret IDs.
- HUD campaign intel for active event, reputation, secret progress, fragments, objective progress, structure HP, and boss gate state.
- Procedural transformation/ultimate-ready overlays and boss phase presentation cues that work even when optional `.glb` assets are missing.
- Monster pathfinding optimized with one shared per-tick distance field for smart/fork patrols plus occupied-cell lookup sets.
- Camera tracking avoids per-frame filter/reduce allocations on every render frame.
- Vite build output splits the heavy Three.js/R3F renderer from the app and general vendor code for better caching.
- Local PvP-style arena support for two or three players.
- Shared-screen movement bounds for local multiplayer so players cannot run out of the camera window.
- Streamlined setup with single-match launches and in-game restart using the same map, characters, upgrade, and controls.
- Deterministic engine actions and replay/network type groundwork.

Not implemented yet:

- Fully bespoke 50x50 campaign maps, physical secret-room geometry, and boss arenas hidden inside larger exploration maps.
- Route-specific puzzle mechanics beyond the current touch/defense/mini-boss objective framework.
- Village hubs, NPCs, currency, shops, and conversation flows.
- Bespoke enemy-wave scripts beyond the current respawn-pressure and defense HP systems.
- Lore collectible screens beyond persisted rare scroll and fragment counters.
- Fully bespoke `.glb` pickup and enemy models beyond the current procedural fallbacks.
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
3. Add route-level lazy loading for the heaviest 3D-only screens if real-device profiling still shows slow first loads.
4. Add browser-level smoke tests for canvas rendering once Playwright or another browser runner is installed.
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

- In-game bosses are rendered as simple procedural beast models instead of flat portrait cards.
- Local enemies use procedural ninja/monster silhouettes with overhead name/threat bars.
- Player characters can be upgraded from procedural meshes to optimized `.glb` assets by placing files such as `naruto.glb` or `sasuke.glb` in `public/models/characters/`.
- Imported character models are cached, cloned per player, and can blend idle and movement animation clips when the files include them.
- Boss hazards use anime-inspired telegraphs: sand spikes, blue fire, water cannons, lava bursts, steam rings, acid bubbles, air strikes, tentacle slams, and tailed-beast bombs.
- Tailed-beast bombs and chakra shockwaves inherit the active boss color so each boss encounter reads differently.
- The main roster board and Shinobi Manual stay in sync with the implemented characters, monsters, stages, bosses, and power-up themes.

## Performance Notes

The engine keeps explosion resolution cell-based instead of scanning the full map. Recent optimizations also reduce garbage during chained blasts by using keyed lookups for active explosions and bombs, and the 3D renderer memoizes explosion/tile layers so countdown-only ticks do not rebuild the board.

## Getting Started

Use Node.js 22, matching the Render/runtime configuration in `.node-version`.

```bash
npm install
npm start
```

The Vite dev server opens the game in the browser. Use the config flow to choose mode, stage, character loadout, upgrades, and controls.

## Useful Scripts

```bash
npm run lint
npm test
npm run build
```

## Project Layout

- `src/engine/` contains deterministic, serializable simulation logic for movement, bombs, beasts, bosses, hazards, and round state.
- `src/content/` defines character, boss, stage, and power-up catalogs.
- `src/view/GameScreen/GameScene3D.tsx` renders the 3D arena.
- `src/view/ConfigScreen/` handles mode, village, loadout, upgrade, and key setup.
- `src/story/` stores local story progression and unlock rewards.
- `src/network/` contains replay and future online-room message types.
- `public/maps/` contains stage map layouts.
- `public/models/characters/` contains optional `.glb` character model overrides and the asset pipeline notes.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for deeper architecture notes.

## Controls

Controls are configured in the setup flow. Each player has movement keys plus four action keys: bomb, detonate, ultimate, and cover. Controls can also be reassigned from the pause settings dialog and are saved for the next run.

## License

This project is licensed under the MIT License.
