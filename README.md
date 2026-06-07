# Explosive Shinobi Arena

A 3D browser arena game built with React, TypeScript, Three.js, and React Three Fiber. The current build turns a grid-bomb combat loop into a shinobi boss arena with character-specific bombs, themed explosions, village stages, procedural monsters, tailed-beast bosses, story unlocks, and a network-ready engine for future online rooms.

## Current Features

- **3D arena renderer** with textured village floors, animated bombs, optional `.glb` shinobi models, procedural fallbacks, low-poly monsters, warning hazards, and smooth entity movement.
- **Solo boss mode** with procedural tailed-beast models, phase-based abilities, danger-zone warnings, boss health, and story rewards.
- **Local arena mode** for two or three players with configurable controls and trial targets.
- **Hybrid smooth movement** keeps bombs and explosions grid-based while held direction keys move characters through 0.1-cell decimal steps, with lane-centering and planted-bomb escape like classic Bomberman movement.
- **Six shinobi loadouts**: Deidara, Naruto, Sasuke, Gaara, Minato, and Itachi.
- **Distinct bomb behavior**: clay blasts, clone diagonals, Chidori piercing, sand control, teleport marks, crow illusions, and signature ultimates.
- **Longer ultimate fuses** give players time to escape oversized signature blasts after activating them.
- **Character-specific explosion visuals**: Deidara clay/fire bursts, Naruto Rasengan chakra swirls, Sasuke lightning with black flame accents, Gaara sand clouds, Minato teleport seals, and Itachi genjutsu/crow effects.
- **Character-themed power-up UI** with profile-card and manual notes for every pickup effect, using labels such as Clone Training, FTG Kunai, Sand Armor, Sharingan Timing, and Yata Mirror.
- **Verified power-up mechanics** for bomb capacity, blast range, manual detonation, speed boosts, guard shields, phase movement, and placeable cover. Manual bombs use a dedicated detonate key, and cover pickups use a dedicated cover key.
- **Character passives**: Minato has faster movement, while Gaara and Itachi can spend defensive passives to survive an otherwise lethal hit.
- **Character notes** in the roster, manual, and loadout picker explain each shinobi's bomb, ultimate, passive, and playstyle before a match starts.
- **Village-themed enemies** such as Rogue Genin, Sand Ninja, Mist Ninja, Thunder Hawk, White Zetsu, and Akatsuki Cultist. Monsters only seal players on contact, while their visual tells show threat identity.
- **Safe round starts** with spawn cells and escape lanes cleared across village maps, including local arena resets.
- **Optimized explosion flow** that computes only affected cells, reduces blast-loop allocations, and avoids unnecessary 3D scene rerenders during explosion timers.
- **Future multiplayer groundwork** through serializable engine actions, replay helpers, and room-selection message types.

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
