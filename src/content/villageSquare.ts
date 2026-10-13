import type { HubConsumableId } from './hubShop';
import type { StageId } from './types';
import { HUB_CONSUMABLES } from './hubShop';
import type { SquareCastId } from './animeCast';

// The village square: a safe district inside each campaign map, by the
// entrance, where the hub lives in the world. Players walk up to villagers,
// the merchant's stall, the request board and the secrets shrine, then head out
// through the village gate into the mission. Positions live in each stage's
// CampaignStageLayout.square; who the villagers are lives in animeCast.ts
// (SQUARE_CAST) and what they say in hubVillages.ts.

export type ReputationTierId = 'stranger' | 'known' | 'trusted' | 'honored';

export type VillageInteractableKind = 'villager' | 'shop' | 'board' | 'shrine' | 'gate';

export interface VillageInteractable {
  // Stable within its stage, for example 'villager-a' or 'board'.
  id: string;
  kind: VillageInteractableKind;
  x: number;
  y: number;
  // For kind 'villager': the hubVillages.ts villager this one is.
  villagerId?: string;
  // Only in the square once standing reaches this tier (WANDERING_VILLAGER).
  minTier?: ReputationTierId;
}

export interface VillageSquareBounds {
  // Inclusive cell rectangle of the safe square.
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface VillageSquareLayout {
  bounds: VillageSquareBounds;
  interactables: readonly VillageInteractable[];
}

// Side requests offered on a village's request board: optional goals inside
// the mission, rewarded on mission success.
export type CampaignRequestKind =
  | 'collectMarked' // pick up N marked keepsakes placed in the map
  | 'breakMarked' // break N marked crates
  | 'findSecret' // enter a named secret room
  | 'noFall' // finish the mission without losing a life
  | 'defeatEnemies'; // defeat N enemies outside the square

export interface CampaignRequestDefinition {
  id: string;
  // The villager who asks (hubVillages.ts id), for dialogue and the board.
  giverId: string;
  title: string;
  description: string;
  kind: CampaignRequestKind;
  // The count for collectMarked, breakMarked and defeatEnemies; the secret id
  // for findSecret.
  target?: number;
  secretId?: string;
  reward: { embers: number; reputation: number };
  // Offered once the village reputation reaches this tier.
  minTier: ReputationTierId;
}

export type CampaignRequestStatus = 'offered' | 'accepted' | 'complete' | 'failed';

export interface CampaignRequestState {
  id: string;
  status: CampaignRequestStatus;
  progress: number;
  target: number;
  // Marked cells the request placed in the map (keepsakes or marked crates).
  cells?: { x: number; y: number }[];
}

// 0 damaged (never cleared), 1 rebuilt, 2 thriving, 3 festival.
export type RepairStage = 0 | 1 | 2 | 3;

export type ScarfId = 'ember' | StageId;

// What the app hands a solo campaign mission about the village (GameConfig
// .village), worked out from the save before INIT so the match replays the
// same way. Co-op and online rooms leave it out: their square has villagers
// to talk to, but the stall and the request board stay closed.
export interface VillageVisitConfig {
  reputationTier: ReputationTierId;
  // Embers the player may spend at the square's stall this mission.
  embers: number;
  // Requests on the board this visit, in board order (villageRequests.ts ids).
  offeredRequestIds: string[];
  // Render only: how far this village has rebuilt (repairStageFor in
  // story/reputation.ts). Missing (co-op, online) draws stage 1.
  repairStage?: RepairStage;
  // Render only: the scarf the player chose to wear (none when missing). The
  // ember scarf comes with Honored standing, a village's scarf with finding
  // all three of its secrets.
  scarf?: ScarfId;
}

// What the square did this mission (CampaignRuntimeState.village). The save
// reads it when the mission ends: embersSpent is paid whatever the result;
// complete requests pay their reward only on mission success.
export interface VillageSquareRuntimeState {
  requests: CampaignRequestState[];
  // Bought at the stall this mission, in order.
  purchases: HubConsumableId[];
  embersSpent: number;
}

// Square rules (engine): no bombs can be dropped inside the bounds, blasts do
// not enter it, enemies never step into it (they lose track of a player who
// is inside), boss hazards and wave entries skip it, and every interactable
// cell blocks movement and blasts like a pillar.

// The wanderer who joins every square once standing reaches Known: Jiraiya
// (animeCast.ts WANDERER_CAST and CAST.jiraiya; literals here keep the cast's
// looks out of the first-load bundle). His lines live with the other
// villagers' (hubVillages.ts).
export const WANDERING_VILLAGER = {
  id: 'jiraiya' as SquareCastId,
  name: 'Jiraiya',
  role: 'Toad Sage and Writer',
  minTier: 'known' as ReputationTierId,
} as const;

// Stall stock: the hub's consumables. Each one can be had once per mission,
// counting what was packed in the hub. From Trusted, Pell knocks a fifth off.
export const STALL_DISCOUNT_TIER: ReputationTierId = 'trusted';

export function stallPrice(id: HubConsumableId, tier: ReputationTierId): number {
  const base = HUB_CONSUMABLES.find((item) => item.id === id)?.price ?? 0;
  const discounted = tier === 'trusted' || tier === 'honored';
  return discounted ? Math.floor((base * 4) / 5 / 5) * 5 : base;
}

// From Honored the player may wear the ember-thread scarf (render only;
// chosen in the hub, VillageVisitConfig.scarf).
export const HONORED_COSMETIC_TIER: ReputationTierId = 'honored';

const TIER_RANK: Record<ReputationTierId, number> = {
  stranger: 0, known: 1, trusted: 2, honored: 3,
};

/**
 * The props standing in the square at this tier: everything without a
 * minTier, plus the ones the tier has reached. Missing tier means stranger
 * (co-op and online rooms). Only these block movement and blasts.
 */
export function presentInteractables(
  square: VillageSquareLayout | undefined,
  tier: ReputationTierId = 'stranger'
): VillageInteractable[] {
  if (!square) return [];
  return square.interactables.filter(
    (item) => !item.minTier || TIER_RANK[tier] >= TIER_RANK[item.minTier]
  );
}

/**
 * The present interactable a player at (x, y) can use: the first in list
 * order within one cell, diagonals included. Input, prompts and the engine
 * share this rule.
 */
export function reachableInteractable(
  square: VillageSquareLayout | undefined,
  x: number,
  y: number,
  tier: ReputationTierId = 'stranger'
): VillageInteractable | null {
  return presentInteractables(square, tier).find(
    (item) => Math.max(Math.abs(item.x - x), Math.abs(item.y - y)) === 1
  ) ?? null;
}

export function insideSquare(
  square: VillageSquareLayout | undefined,
  x: number,
  y: number
): boolean {
  if (!square) return false;
  const {
    x0, y0, x1, y1
  } = square.bounds;
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
