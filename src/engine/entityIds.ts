import { EntityIdCounters } from './types';

// Ids for what a match creates as it plays: bombs, boss hazards and enemy
// hazards. The counters travel in GameEngineState.entityIds, so the same
// actions always mint the same ids, whatever else runs in the process.

export type EntityIdFamily = keyof EntityIdCounters;

// Frozen: every new match starts from this one object.
export const NO_ENTITY_IDS: EntityIdCounters = Object.freeze({
  bomb: 0,
  bossHazard: 0,
  monsterHazard: 0,
});

// The view tells enemy hazards from boss hazards by prefix (hazardWarning.ts,
// enemyJutsu.ts).
const ID_PREFIXES: Record<EntityIdFamily, string> = {
  bomb: 'bomb-',
  bossHazard: 'hazard-',
  monsterHazard: 'monster-hazard-',
};

/** The next id in `family`, and the counters to keep. Never mutates `ids`. */
export function mintEntityId(
  ids: EntityIdCounters | undefined,
  family: EntityIdFamily
): [string, EntityIdCounters] {
  const current = ids ?? NO_ENTITY_IDS;
  const next = current[family] + 1;
  return [`${ID_PREFIXES[family]}${next}`, { ...current, [family]: next }];
}
