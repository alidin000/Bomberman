export const TICK_MS = 50;
export const BOMB_FUSE_MS = 3000;
export const EXPLOSION_MS = 500;
export const BOX_DESTROY_MS = 500;
export const GHOST_POWER_MS = 15000;
export const INVINCIBILITY_POWER_MS = 15000;
export const POWER_FLASH_MS = 3000;
// After Gaara's or Itachi's passive save, the same hit cannot land again.
export const SURVIVAL_GRACE_MS = 1000;
// The boss arena's intro: the whole arena stays frozen this long once the
// boss appears, like the round countdown, unless a player skips it.
export const BOSS_INTRO_MS = 2500;
// Its first stretch cannot be skipped, so a bomb mashed as the arena opens
// does not skip an entrance nobody has seen yet.
export const BOSS_INTRO_SKIP_LOCK_MS = 400;

export const MONSTER_MOVE_MS: Record<string, number> = {
  smart: 600,
  ghost: 1000,
  fork: 700,
  basic: 700,
};

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71'];

export const PLAYER_SPAWNS: { x: number; y: number }[] = [
  { x: 1, y: 1 },
  { x: 13, y: 8 },
  { x: 1, y: 8 },
];
