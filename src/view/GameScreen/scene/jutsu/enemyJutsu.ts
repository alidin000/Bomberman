import { BossHazard } from '../../../../engine/types';

/**
 * Enemy jutsu drawn on their strike cells: a rogue genin's kunai, a sand
 * ninja's sand spikes, a cloud ninja's lightning strike. The engine makes
 * them as hazards (monsters.ts: Kunai Throw is a chakra shockwave cell,
 * Lightning Strike an air strike), shared with the tailed beasts' own
 * attacks; an enemy's hazards carry the `monster-hazard-` id. Sand spikes
 * look the same from either.
 */
export type EnemyJutsu = 'kunai' | 'sandSpike' | 'lightning';

export function enemyJutsuFor(hazard: Pick<BossHazard, 'id' | 'kind'>): EnemyJutsu | null {
  if (hazard.kind === 'sandSpikes') return 'sandSpike';
  if (!hazard.id.startsWith('monster-hazard-')) return null;
  if (hazard.kind === 'chakraShockwave') return 'kunai';
  if (hazard.kind === 'airStrike') return 'lightning';
  return null;
}
