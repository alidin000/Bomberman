import type { GameConfig } from './types';

// Campaign difficulty. Only solo campaigns read it: versus matches always
// play the neutral (Hard) numbers, so local arena balance never changes.
export type DifficultyId = 'story' | 'normal' | 'hard';

export interface DifficultySettings {
  id: DifficultyId;
  label: string;
  description: string;
  // Multiplies every enemy move interval (above 1 = slower enemies).
  enemyMoveScale: number;
  // Added to every enemy's detection range, in cells.
  detectionOffset: number;
  // Multiplies enemy ability cooldowns.
  abilityCooldownScale: number;
  // Warning before an enemy ability lands.
  abilityWarningMs: number;
  // Enemies may only target a player who can see them.
  castOnlyWhenVisible: boolean;
  // How long before a blast dodging enemies (smart, fork, elite) step aside.
  dodgeHorizonMs: number;
  // Stage events (sandstorm, fog) cannot cut sight below this many cells.
  eventVisionFloor: number;
  // Multiplies spawn point respawn timers; offsets their active caps.
  respawnScale: number;
  maxActiveOffset: number;
  // Chance that a Zetsu rolled from a destroyed crate really appears.
  ambushChance: number;
  structureDamageScale: number;
  bossHealthScale: number;
  // Multiplies the time between boss attacks.
  bossAttackScale: number;
  // Lives per mission; after a fall the player regroups at the last
  // cleared objective while lives remain.
  lives: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultySettings> = {
  story: {
    id: 'story',
    label: 'Story',
    description: 'For learning the villages: slower, fewer enemies and 5 lives.',
    enemyMoveScale: 1.35,
    detectionOffset: -2,
    abilityCooldownScale: 1.5,
    abilityWarningMs: 1150,
    castOnlyWhenVisible: true,
    dodgeHorizonMs: 700,
    eventVisionFloor: 99,
    respawnScale: 1.6,
    maxActiveOffset: -1,
    ambushChance: 0.4,
    structureDamageScale: 0.5,
    bossHealthScale: 0.7,
    bossAttackScale: 1.3,
    lives: 5,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'The intended challenge, with 3 lives per mission.',
    enemyMoveScale: 1.1,
    detectionOffset: -1,
    abilityCooldownScale: 1.15,
    abilityWarningMs: 950,
    castOnlyWhenVisible: true,
    dodgeHorizonMs: 1100,
    eventVisionFloor: 3,
    respawnScale: 1.25,
    maxActiveOffset: 0,
    ambushChance: 0.75,
    structureDamageScale: 1,
    bossHealthScale: 0.9,
    bossAttackScale: 1.1,
    lives: 3,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'The original pressure: one life, full ambushes, enemies strike from the fog.',
    enemyMoveScale: 1,
    detectionOffset: 0,
    abilityCooldownScale: 1,
    abilityWarningMs: 850,
    castOnlyWhenVisible: false,
    dodgeHorizonMs: 1400,
    eventVisionFloor: 2,
    respawnScale: 1,
    maxActiveOffset: 0,
    ambushChance: 1,
    structureDamageScale: 1,
    bossHealthScale: 1,
    bossAttackScale: 1,
    lives: 1,
  },
};

export const DIFFICULTY_IDS: DifficultyId[] = ['story', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function isDifficultyId(value: unknown): value is DifficultyId {
  return value === 'story' || value === 'normal' || value === 'hard';
}

export function getDifficulty(id?: DifficultyId | null): DifficultySettings {
  return DIFFICULTIES[isDifficultyId(id) ? id : DEFAULT_DIFFICULTY];
}

// Versus and other non-campaign matches keep the neutral numbers.
export function getMatchDifficulty(
  config: Pick<GameConfig, 'mode' | 'difficulty'>
): DifficultySettings {
  return config.mode === 'solo' ? getDifficulty(config.difficulty) : DIFFICULTIES.hard;
}
