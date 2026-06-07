/* eslint-disable object-curly-newline, comma-dangle */
import { MonsterKind, MonsterState } from './types';
import { MONSTER_MOVE_MS } from './constants';

interface SpawnDef {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: MonsterKind;
}

const LEGACY_BEAST_NAMES: Record<MonsterKind, string> = {
  basic: 'Kurama Foxling',
  smart: 'Shukaku Sand Hunter',
  ghost: 'Matatabi Flame Wraith',
  fork: 'Gyuki Horn Beast',
};

function spawn(def: SpawnDef): MonsterState {
  return {
    id: def.id,
    name: def.name,
    x: def.x,
    y: def.y,
    kind: def.kind,
    moveCooldown: MONSTER_MOVE_MS[def.kind],
  };
}

export function getMonstersForMap(
  selectedMap: string,
  numPlayers: number,
): MonsterState[] {
  const twoPlayer = numPlayers === 2;

  switch (selectedMap) {
    case 'map1':
    case 'hiddenLeaf':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Kurama Hunter', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Kurama Foxling', x: 10, y: 2, kind: 'basic' }),
          spawn({ id: 'monster3', name: 'Chomei Forest Wisp', x: 4, y: 8, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: LEGACY_BEAST_NAMES.smart, x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: LEGACY_BEAST_NAMES.basic, x: 10, y: 2, kind: 'basic' }),
        ];
    case 'map2':
    case 'hiddenSand':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Shukaku Sand Wraith', x: 7, y: 5, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Shukaku Sand Hunter', x: 4, y: 8, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Shukaku Cub', x: 6, y: 1, kind: 'basic' }),
        ]
        : [
          spawn({ id: 'monster1', name: LEGACY_BEAST_NAMES.ghost, x: 6, y: 5, kind: 'ghost' }),
          spawn({ id: 'monster2', name: LEGACY_BEAST_NAMES.smart, x: 10, y: 2, kind: 'smart' }),
        ];
    case 'map3':
    case 'hiddenMist':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Isobu Shell Beast', x: 9, y: 1, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Isobu Tide Hunter', x: 6, y: 3, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Saiken Acid Cub', x: 5, y: 8, kind: 'basic' }),
          spawn({ id: 'monster4', name: 'Mist Chakra Wraith', x: 8, y: 6, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: LEGACY_BEAST_NAMES.fork, x: 7, y: 4, kind: 'fork' }),
          spawn({ id: 'monster2', name: LEGACY_BEAST_NAMES.ghost, x: 11, y: 1, kind: 'ghost' }),
          spawn({ id: 'monster3', name: LEGACY_BEAST_NAMES.basic, x: 5, y: 8, kind: 'basic' }),
        ];
    case 'hiddenCloud':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Gyuki Horn Beast', x: 9, y: 5, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Gyuki Storm Hunter', x: 6, y: 3, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Matatabi Storm Wraith', x: 12, y: 7, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Gyuki Horn Beast', x: 9, y: 5, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Matatabi Storm Wraith', x: 12, y: 7, kind: 'ghost' }),
        ];
    case 'hiddenStone':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Kokuo Steam Hunter', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Kokuo Horn Beast', x: 10, y: 3, kind: 'fork' }),
          spawn({ id: 'monster3', name: 'Son Goku Lava Cub', x: 12, y: 8, kind: 'basic' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Kokuo Steam Hunter', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Kokuo Horn Beast', x: 10, y: 3, kind: 'fork' }),
        ];
    case 'akatsukiHideout':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Matatabi Flame Wraith', x: 7, y: 4, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Akatsuki Horn Beast', x: 11, y: 3, kind: 'fork' }),
          spawn({ id: 'monster3', name: 'Akatsuki Beast Hunter', x: 5, y: 8, kind: 'smart' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Matatabi Flame Wraith', x: 7, y: 4, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Akatsuki Beast Hunter', x: 5, y: 8, kind: 'smart' }),
        ];
    default:
      return [];
  }
}
