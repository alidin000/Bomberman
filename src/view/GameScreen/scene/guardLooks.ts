import type { MiniBossCastId } from '../../../content/animeCast';
import { StageId } from '../../../content/types';

/**
 * Mini-boss gate guards: each stage's guard is drawn as its canon mini-boss
 * (content/animeCast.ts), so a guard never reads as one more patrol of its
 * kind. The red diamond under it (GameScene3D) and its raised nameplate say
 * "guard" by shape as well. Render-only.
 */
export const GUARD_CAST: Record<StageId, MiniBossCastId> = {
  hiddenLeaf: 'iruka',
  hiddenSand: 'kankuro',
  hiddenMist: 'haku',
  hiddenCloud: 'darui',
  hiddenStone: 'akatsuchi',
  akatsukiHideout: 'konan',
  greatShinobiWar: 'obito',
};

/** Guards stand a little taller than their elite size, and so does their nameplate. */
export const GUARD_FIGURE_SCALE = 1.08;
export const GUARD_NAMEPLATE_Y = 1.25;
