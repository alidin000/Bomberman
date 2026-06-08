export type EnemyArchetype =
  | 'rogueGenin'
  | 'anbu'
  | 'mistNinja'
  | 'sandNinja'
  | 'cloudNinja'
  | 'whiteZetsu'
  | 'blackZetsu';

export type EnemyAbilityKind =
  | 'kunaiThrow'
  | 'bodyFlicker'
  | 'waterClone'
  | 'sandSpike'
  | 'lightningStrike'
  | 'zetsuMelee';

export interface EnemyArchetypeDefinition {
  archetype: EnemyArchetype;
  label: string;
  ability: EnemyAbilityKind;
  abilityLabel: string;
  description: string;
  elite?: boolean;
}

export const ENEMY_ARCHETYPE_DEFINITIONS: Record<
EnemyArchetype,
EnemyArchetypeDefinition
> = {
  rogueGenin: {
    archetype: 'rogueGenin',
    label: 'Rogue Genin',
    ability: 'kunaiThrow',
    abilityLabel: 'Kunai Throw',
    description: 'Throws a warned kunai line at the nearest shinobi.',
  },
  anbu: {
    archetype: 'anbu',
    label: 'ANBU',
    ability: 'bodyFlicker',
    abilityLabel: 'Body Flicker',
    description: 'Teleports near the nearest player after a short warning.',
  },
  mistNinja: {
    archetype: 'mistNinja',
    label: 'Mist Ninja',
    ability: 'waterClone',
    abilityLabel: 'Water Clone',
    description: 'Creates a short-lived clone threat nearby.',
  },
  sandNinja: {
    archetype: 'sandNinja',
    label: 'Sand Ninja',
    ability: 'sandSpike',
    abilityLabel: 'Sand Spike',
    description: 'Marks a tile with rising sand spikes.',
  },
  cloudNinja: {
    archetype: 'cloudNinja',
    label: 'Cloud Ninja',
    ability: 'lightningStrike',
    abilityLabel: 'Lightning Strike',
    description: 'Calls lightning onto a warned target tile.',
  },
  whiteZetsu: {
    archetype: 'whiteZetsu',
    label: 'White Zetsu',
    ability: 'zetsuMelee',
    abilityLabel: 'Zetsu Ambush',
    description: 'Fast melee pressure from destroyed walls and burrows.',
  },
  blackZetsu: {
    archetype: 'blackZetsu',
    label: 'Black Zetsu',
    ability: 'zetsuMelee',
    abilityLabel: 'Elite Zetsu Ambush',
    description: 'Elite Zetsu threat with faster melee pressure.',
    elite: true,
  },
};

export function getEnemyArchetypeDefinition(
  archetype: EnemyArchetype
): EnemyArchetypeDefinition {
  return ENEMY_ARCHETYPE_DEFINITIONS[archetype];
}
