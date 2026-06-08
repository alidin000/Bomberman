/* eslint-disable object-curly-newline, comma-dangle, no-use-before-define */
import { MonsterKind, MonsterState } from './types';
import { MONSTER_MOVE_MS } from './constants';
import { EnemyArchetype, getEnemyArchetypeDefinition } from '../content/enemies';

interface SpawnDef {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: MonsterKind;
  archetype?: EnemyArchetype;
}

const LEGACY_BEAST_NAMES: Record<MonsterKind, string> = {
  basic: 'Rogue Genin',
  smart: 'Rogue Chunin',
  ghost: 'Training Clone',
  fork: 'ANBU Captain',
};

function spawn(def: SpawnDef): MonsterState {
  const archetype = def.archetype ?? getArchetypeForSpawn(def);
  const enemy = getEnemyArchetypeDefinition(archetype);
  return {
    id: def.id,
    name: def.name,
    x: def.x,
    y: def.y,
    kind: def.kind,
    moveCooldown: MONSTER_MOVE_MS[def.kind],
    archetype,
    abilityKind: enemy.ability,
    abilityLabel: enemy.abilityLabel,
    abilityCooldown: 1800,
    abilityWarningTicks: 0,
    abilityTarget: null,
    elite: enemy.elite,
  };
}

function getArchetypeForKind(kind: MonsterKind): EnemyArchetype {
  if (kind === 'smart') return 'sandNinja';
  if (kind === 'ghost') return 'mistNinja';
  if (kind === 'fork') return 'anbu';
  return 'rogueGenin';
}

function getArchetypeForSpawn(def: SpawnDef): EnemyArchetype {
  const name = def.name.toLowerCase();
  if (name.includes('black zetsu')) return 'blackZetsu';
  if (name.includes('zetsu')) return 'whiteZetsu';
  if (name.includes('mist') || name.includes('clone')) return 'mistNinja';
  if (name.includes('sand') || name.includes('puppet')) return 'sandNinja';
  if (name.includes('cloud') || name.includes('lightning') || name.includes('thunder')) {
    return 'cloudNinja';
  }
  if (name.includes('anbu') || name.includes('hunter')) return 'anbu';
  return getArchetypeForKind(def.kind);
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
          spawn({ id: 'monster1', name: 'Rogue Chunin', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Rogue Genin', x: 10, y: 2, kind: 'basic' }),
          spawn({ id: 'monster3', name: 'Training Clone', x: 4, y: 8, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: LEGACY_BEAST_NAMES.smart, x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: LEGACY_BEAST_NAMES.basic, x: 10, y: 2, kind: 'basic' }),
        ];
    case 'map2':
    case 'hiddenSand':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Puppet Scout', x: 7, y: 5, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Sand Ninja', x: 4, y: 8, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Scorpion Puppet', x: 6, y: 1, kind: 'basic' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Puppet Scout', x: 6, y: 5, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Sand Ninja', x: 10, y: 2, kind: 'smart' }),
        ];
    case 'map3':
    case 'hiddenMist':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Hunter Ninja', x: 9, y: 1, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Mist Ninja', x: 6, y: 3, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Water Clone', x: 5, y: 8, kind: 'basic' }),
          spawn({ id: 'monster4', name: 'Hidden Mist Shade', x: 8, y: 6, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Hunter Ninja', x: 7, y: 4, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Hidden Mist Shade', x: 11, y: 1, kind: 'ghost' }),
          spawn({ id: 'monster3', name: 'Water Clone', x: 5, y: 8, kind: 'basic' }),
        ];
    case 'hiddenCloud':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Cloud Samurai', x: 9, y: 5, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Lightning Ninja', x: 6, y: 3, kind: 'smart' }),
          spawn({ id: 'monster3', name: 'Thunder Hawk', x: 12, y: 7, kind: 'ghost' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Cloud Samurai', x: 9, y: 5, kind: 'fork' }),
          spawn({ id: 'monster2', name: 'Thunder Hawk', x: 12, y: 7, kind: 'ghost' }),
        ];
    case 'hiddenStone':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Steam Ninja', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Stone Samurai', x: 10, y: 3, kind: 'fork' }),
          spawn({ id: 'monster3', name: 'Lava Monk', x: 12, y: 8, kind: 'basic' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Steam Ninja', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Stone Samurai', x: 10, y: 3, kind: 'fork' }),
        ];
    case 'akatsukiHideout':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'Crow Swarm', x: 7, y: 4, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'White Zetsu', x: 11, y: 3, kind: 'fork' }),
          spawn({ id: 'monster3', name: 'Akatsuki Cultist', x: 5, y: 8, kind: 'smart' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'Crow Swarm', x: 7, y: 4, kind: 'ghost' }),
          spawn({ id: 'monster2', name: 'Akatsuki Cultist', x: 5, y: 8, kind: 'smart' }),
        ];
    case 'greatShinobiWar':
      return twoPlayer
        ? [
          spawn({ id: 'monster1', name: 'War Zetsu', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Masked Clone', x: 10, y: 2, kind: 'ghost' }),
          spawn({ id: 'monster3', name: 'Battlefield Shinobi', x: 4, y: 8, kind: 'fork' }),
        ]
        : [
          spawn({ id: 'monster1', name: 'War Zetsu', x: 6, y: 5, kind: 'smart' }),
          spawn({ id: 'monster2', name: 'Masked Clone', x: 10, y: 2, kind: 'ghost' }),
        ];
    default:
      return [];
  }
}
