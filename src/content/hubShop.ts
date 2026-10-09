// Village hub economy: the currency, what the travelling merchant sells, and
// what a mission pays. Pure data and arithmetic, shared by the save
// (src/story/progress.ts), the engine (src/engine/campaignLoadout.ts) and the
// hub screen. Every name and line here is original to this game.
import type { DifficultyId } from '../engine/difficulty';
import { INVINCIBILITY_POWER_MS } from '../engine/constants';

export const HUB_CURRENCY = {
  name: 'Embers',
  singular: 'Ember',
} as const;

export function formatEmbers(amount: number): string {
  return `${amount} ${amount === 1 ? HUB_CURRENCY.singular : HUB_CURRENCY.name}`;
}

/** One-mission consumables: packed in the hub, spent when the mission deploys. */
export type HubConsumableId =
  | 'paperWard'
  | 'secondWind'
  | 'blastPowder'
  | 'fusePouch'
  | 'lodestone';

/** Permanent loadout upgrades, bought rank by rank up to a cap. */
export type HubUpgradeId = 'lanternOil' | 'regroupDrill' | 'satchelStrap';

/**
 * What a campaign run brings into the match. It travels in the GameConfig,
 * so the reducer applies it at INIT and a recorded INIT replays the same way.
 */
export interface CampaignLoadout {
  consumables?: HubConsumableId[];
  upgrades?: Partial<Record<HubUpgradeId, number>>;
}

export interface HubConsumableDefinition {
  id: HubConsumableId;
  name: string;
  effect: string;
  price: number;
}

export interface HubUpgradeDefinition {
  id: HubUpgradeId;
  name: string;
  /** Effect of one rank. */
  effect: string;
  /** Price of each rank in order; the cap is the number of ranks. */
  prices: number[];
}

// The Paper Ward is the map's Guard pickup, worn from the first second.
export const STARTING_GUARD_MS = INVINCIBILITY_POWER_MS;
export const REGROUP_DRILL_MS_PER_RANK = 750;

export const HUB_CONSUMABLES: HubConsumableDefinition[] = [
  {
    id: 'paperWard',
    name: 'Paper Ward',
    effect: 'Start the mission under a 15-second Guard.',
    price: 15,
  },
  {
    id: 'blastPowder',
    name: 'Blast Powder',
    effect: '+1 blast range for one mission.',
    price: 25,
  },
  {
    id: 'fusePouch',
    name: 'Fuse Pouch',
    effect: '+1 bomb slot for one mission.',
    price: 25,
  },
  {
    id: 'lodestone',
    name: 'Lodestone Charm',
    effect: 'Pull in pickups beside you as you move, for one mission.',
    price: 15,
  },
  {
    id: 'secondWind',
    name: 'Second Wind Knot',
    effect: '+1 life for one mission.',
    price: 50,
  },
];

export const HUB_UPGRADES: HubUpgradeDefinition[] = [
  {
    id: 'satchelStrap',
    name: 'Satchel Strap',
    effect: 'Pack one more item per mission.',
    prices: [70, 130],
  },
  {
    id: 'regroupDrill',
    name: 'Regroup Drill',
    effect: '+0.75 s of guard after a fall.',
    prices: [50, 90],
  },
  {
    id: 'lanternOil',
    name: 'Lantern Oil',
    effect: '+1 sight through the fog.',
    prices: [90],
  },
];

/** Items a mission pack holds with no Satchel Strap. */
export const BASE_PACK_SLOTS = 1;

const CONSUMABLE_IDS = new Set<string>(HUB_CONSUMABLES.map((item) => item.id));
const UPGRADE_IDS = new Set<string>(HUB_UPGRADES.map((item) => item.id));

export function isHubConsumableId(value: unknown): value is HubConsumableId {
  return typeof value === 'string' && CONSUMABLE_IDS.has(value);
}

export function isHubUpgradeId(value: unknown): value is HubUpgradeId {
  return typeof value === 'string' && UPGRADE_IDS.has(value);
}

export function getHubConsumable(id: HubConsumableId): HubConsumableDefinition {
  return HUB_CONSUMABLES.find((item) => item.id === id) ?? HUB_CONSUMABLES[0];
}

export function getHubUpgrade(id: HubUpgradeId): HubUpgradeDefinition {
  return HUB_UPGRADES.find((item) => item.id === id) ?? HUB_UPGRADES[0];
}

export function getUpgradeCap(id: HubUpgradeId): number {
  return getHubUpgrade(id).prices.length;
}

/** A rank as stored, clamped to 0..cap (saves and configs are untrusted). */
export function clampUpgradeRank(id: HubUpgradeId, rank: unknown): number {
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(getUpgradeCap(id), Math.floor(rank)));
}

export function getPackSlots(upgrades?: Partial<Record<HubUpgradeId, number>>): number {
  return BASE_PACK_SLOTS + clampUpgradeRank('satchelStrap', upgrades?.satchelStrap);
}

/**
 * Known consumables only, each at most once, no more than the pack holds,
 * in the order they were packed.
 */
export function normalizePack(
  pack: unknown,
  upgrades?: Partial<Record<HubUpgradeId, number>>
): HubConsumableId[] {
  if (!Array.isArray(pack)) return [];
  const kept: HubConsumableId[] = [];
  pack.forEach((id) => {
    if (isHubConsumableId(id) && !kept.includes(id)) kept.push(id);
  });
  return kept.slice(0, getPackSlots(upgrades));
}

export function normalizeUpgradeRanks(
  upgrades: unknown
): Partial<Record<HubUpgradeId, number>> {
  const ranks: Partial<Record<HubUpgradeId, number>> = {};
  if (typeof upgrades !== 'object' || upgrades === null) return ranks;
  Object.entries(upgrades as Record<string, unknown>).forEach(([id, rank]) => {
    if (!isHubUpgradeId(id)) return;
    const clamped = clampUpgradeRank(id, rank);
    if (clamped > 0) ranks[id] = clamped;
  });
  return ranks;
}

// What a mission pays, before the difficulty scale.
export const MISSION_REWARDS = {
  firstClear: 50,
  repeatClear: 15,
  objective: 6,
  secret: 10,
  // An archive fragment is a secret that pays this much on top.
  fragmentBonus: 10,
} as const;

// Harder missions pay more, but not enough to buy back what Hard takes away
// (see the balance notes in the hub tests).
export const DIFFICULTY_REWARD_SCALE: Record<DifficultyId, number> = {
  story: 0.75,
  normal: 1,
  hard: 1.25,
};

export interface MissionEarningsInput {
  difficulty: DifficultyId;
  success: boolean;
  /** No earlier clear of this village has been paid. */
  firstClear: boolean;
  objectivesCompleted: number;
  /** Secrets found this mission that were never paid before. */
  newSecrets: number;
  /** How many of those new secrets were archive fragments. */
  newFragments: number;
}

export interface MissionEarnings {
  clear: number;
  objectives: number;
  secrets: number;
  total: number;
}

export function isFragmentSecret(secretId: string): boolean {
  return secretId.includes('archive-fragment');
}

export function computeMissionEarnings(input: MissionEarningsInput): MissionEarnings {
  const scale = DIFFICULTY_REWARD_SCALE[input.difficulty] ?? 1;
  let clearBase = 0;
  if (input.success) {
    clearBase = input.firstClear ? MISSION_REWARDS.firstClear : MISSION_REWARDS.repeatClear;
  }
  const clear = Math.round(clearBase * scale);
  const objectives = Math.round(
    Math.max(0, input.objectivesCompleted) * MISSION_REWARDS.objective * scale
  );
  const secrets = Math.round((
    Math.max(0, input.newSecrets) * MISSION_REWARDS.secret
    + Math.max(0, input.newFragments) * MISSION_REWARDS.fragmentBonus
  ) * scale);
  return {
    clear,
    objectives,
    secrets,
    total: clear + objectives + secrets,
  };
}
