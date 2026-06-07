# Explosive Shinobi Arena

A 3D browser arena game built with React, TypeScript, Three.js, and React Three Fiber. The current build turns a grid-bomb combat loop into a shinobi boss arena with character-specific bombs, village stages, tailed-beast hazards, story unlocks, and a network-ready engine for future online rooms.

## Current Features

- **3D arena renderer** with textured village floors, animated bombs, billboard characters, warning hazards, and smooth entity movement.
- **Solo boss mode** with moving tailed beasts, phase-based abilities, danger-zone warnings, boss health, and story rewards.
- **Local arena mode** for two or three players with configurable controls and trial targets.
- **Six shinobi loadouts**: Deidara, Naruto, Sasuke, Gaara, Minato, and Itachi.
- **Distinct bomb behavior**: clay blasts, clone diagonals, Chidori piercing, sand control, teleport marks, crow illusions, and signature ultimates.
- **Character passives**: Minato has faster movement, while Gaara and Itachi can spend defensive passives to survive an otherwise lethal hit.
- **Safe round starts** with spawn cells and escape lanes cleared across village maps, including local arena resets.
- **Optimized explosion flow** that computes only affected cells, reduces blast-loop allocations, and avoids unnecessary 3D scene rerenders during explosion timers.
- **Future multiplayer groundwork** through serializable engine actions, replay helpers, and room-selection message types.

## Character Loadouts

| Character | Basic Bomb | Ultimate | Gameplay Identity |
| --- | --- | --- | --- |
| Deidara | Clay Spider Bomb | C3 Giant Bomb | High damage clay explosions and wide ult coverage |
| Naruto | Shadow Clone Bomb | Rasenshuriken | Diagonal clone bursts and wide chakra pressure |
| Sasuke | Chidori Mine | Kirin | Lightning blasts that pierce boxes and strike long lines |
| Gaara | Sand Coffin Trap | Sand Tsunami | Area control, boss-delay effects, and one automatic sand shield |
| Minato | Flying Thunder Mark | Instant Teleport | Blink-style bomb coverage and faster movement |
| Itachi | Crow Clone | Tsukuyomi | Illusion bombs that delay threats and one illusion dodge |

## Performance Notes

The engine keeps explosion resolution cell-based instead of scanning the full map. Recent optimizations also reduce garbage during chained blasts by using keyed lookups for active explosions and bombs, and the 3D renderer memoizes explosion/tile layers so countdown-only ticks do not rebuild the board.

## Getting Started

Use Node.js 18 or newer, but below Node 21, matching the project engine range.

```bash
npm install
npm start
```

The dev server opens the game in the browser. Use the config flow to choose mode, stage, character loadout, upgrades, and controls.

## Useful Scripts

```bash
npm run lint
CI=true npm test -- --watchAll=false
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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for deeper architecture notes.

## Controls

Controls are configured in the setup flow. Each player has movement keys, a basic bomb key, and an ultimate key. The last saved control setup is reused on the next run.

## License

This project is licensed under the MIT License.

