export const TICK_MS = 50;
export const BOMB_FUSE_MS = 3000;
export const EXPLOSION_MS = 500;
export const BOX_DESTROY_MS = 500;
export const GHOST_POWER_MS = 15000;
export const INVINCIBILITY_POWER_MS = 15000;
export const POWER_FLASH_MS = 3000;

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
