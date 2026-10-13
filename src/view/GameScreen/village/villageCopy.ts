// What each village square overlay shows, worked out from the match state
// and the save. Pure, so the overlays and their tests share one source.
import type { StageId } from '../../../content/types';
import { getBossDefinition, getStageDefinition } from '../../../content';
import {
  HUB_CONSUMABLES,
  HubConsumableId,
  formatEmbers,
} from '../../../content/hubShop';
import {
  HubDialogueChoice,
  HubNpc,
  ROAD_TELLER,
  getSquareVillager,
  roadNews,
  villagerGreeting,
} from '../../../content/hubVillages';
import { CAMPAIGN_VILLAGES } from '../../../content/campaign';
import {
  getVillageSecrets,
  secretSetProgress,
  type SecretSetProgress,
  type VillageSecret,
} from '../../../content/villageSecrets';
import { getVillageRequest } from '../../../content/villageRequests';
import {
  CampaignRequestDefinition,
  CampaignRequestStatus,
  ReputationTierId,
  stallPrice,
} from '../../../content/villageSquare';
import type { GameEngineState } from '../../../engine/types';
import { stallRefusal, villageEmbersLeft, visitTier } from '../../../engine/villageSquare';

// ---- Talk -----------------------------------------------------------------

export interface SquareTalk {
  npc: HubNpc;
  opening: string;
  choices: HubDialogueChoice[];
}

/**
 * A villager's talk in the square: the hub's lines (which change as the
 * story moves on), plus a word about their board request when they have
 * one up, and Tamsin's road news.
 */
export function squareTalk(
  stageId: StageId,
  villagerId: string | undefined,
  completedStages: readonly StageId[],
  offered: readonly CampaignRequestDefinition[]
): SquareTalk | null {
  const npc = getSquareVillager(stageId, villagerId);
  if (!npc) return null;
  const choices = [...npc.choices];
  if (npc.id === ROAD_TELLER.id) {
    choices.unshift({ id: 'road', prompt: 'Any news from the road?', reply: roadNews(completedStages) });
  }
  const request = offered.find((item) => item.giverId === npc.id);
  if (request) {
    choices.push({
      id: 'request',
      prompt: 'Need a hand?',
      reply: `${request.description} It is pinned on the board: “${request.title}”.`,
    });
  }
  const opening = npc.id === ROAD_TELLER.id
    ? ROAD_TELLER.greeting
    : villagerGreeting(npc, stageId, completedStages);
  return { npc, opening, choices };
}

// ---- Board ----------------------------------------------------------------

export interface BoardRow {
  request: CampaignRequestDefinition;
  giver: string;
  status: CampaignRequestStatus;
  progress: number;
  target: number;
  reward: string;
  statusText: string;
}

function requestTarget(request: CampaignRequestDefinition): number {
  return request.kind === 'findSecret' || request.kind === 'noFall' ? 1 : request.target ?? 1;
}

export function rewardText(request: CampaignRequestDefinition): string {
  return `+${formatEmbers(request.reward.embers)} · +${request.reward.reputation} reputation`;
}

function statusText(status: CampaignRequestStatus, progress: number, target: number): string {
  if (status === 'complete') return 'Done · paid when the mission is won';
  if (status === 'failed') return 'Failed this mission';
  if (status === 'accepted') return target > 1 ? `Accepted · ${progress}/${target}` : 'Accepted';
  return 'Offered';
}

/** The board this visit, in board order, with each request's live status. */
export function boardRows(state: GameEngineState): BoardRow[] {
  const visit = state.config.village;
  const stageId = state.campaign?.stageId;
  if (!visit || !stageId) return [];
  const live = state.campaign?.village?.requests ?? [];
  return visit.offeredRequestIds.flatMap((id) => {
    const request = getVillageRequest(id);
    if (!request) return [];
    const runtime = live.find((item) => item.id === id);
    const status = runtime?.status ?? 'offered';
    const target = runtime?.target ?? requestTarget(request);
    const progress = runtime?.progress ?? 0;
    return [{
      request,
      giver: getSquareVillager(stageId, request.giverId)?.name ?? request.giverId,
      status,
      progress,
      target,
      reward: rewardText(request),
      statusText: statusText(status, progress, target),
    }];
  });
}

/** Accepted and finished requests, for the HUD tracker. */
export interface TrackedRequest {
  id: string;
  title: string;
  status: CampaignRequestStatus;
  short: string;
}

export function trackedRequests(state: GameEngineState): TrackedRequest[] {
  return (state.campaign?.village?.requests ?? []).flatMap((runtime) => {
    if (runtime.status === 'offered') return [];
    const request = getVillageRequest(runtime.id);
    if (!request) return [];
    let short = runtime.target > 1 ? `${runtime.progress}/${runtime.target}` : 'Open';
    if (runtime.status === 'complete') short = 'Done';
    if (runtime.status === 'failed') short = 'Failed';
    return [{
      id: runtime.id, title: request.title, status: runtime.status, short,
    }];
  });
}

// ---- Stall ----------------------------------------------------------------

// What a stall item does when bought mid-mission (the hub's effects say
// "for one mission" from the start; here they apply at once).
export const STALL_EFFECTS: Record<HubConsumableId, string> = {
  paperWard: 'A 15-second Guard, starting now.',
  blastPowder: '+1 blast range for the rest of the mission.',
  fusePouch: '+1 bomb slot for the rest of the mission.',
  lodestone: 'Pull in pickups beside you as you move, for the rest of the mission.',
  secondWind: '+1 life for this mission.',
};

// Why an item cannot be had: packed in the hub or bought this mission
// (owned), a Paper Ward while Ghost is worn (the engine refuses it, like a
// Guard pickup), or too few Embers left.
export type StallBlock = 'owned' | 'ghost' | 'embers';

export interface StallRow {
  id: HubConsumableId;
  name: string;
  effect: string;
  price: number;
  basePrice: number;
  block: StallBlock | null;
  // Owned because it was packed in the hub (else bought here).
  packed: boolean;
}

export interface StallModel {
  tier: ReputationTierId;
  // What the stall can still take this attempt (the engine's count: a retry
  // starts from what is left after the last attempt's spend).
  balance: number;
  rows: StallRow[];
}

function wearsGhost(state: GameEngineState, playerId: string): boolean {
  const player = state.players.find((item) => item.id === playerId);
  return !!player && (player.powerUps.includes('Ghost')
    || (state.timedPowerUps[playerId] ?? []).some((timed) => timed.power === 'Ghost'));
}

export function stallModel(state: GameEngineState, playerId: string): StallModel {
  const tier = visitTier(state.config);
  const packed = state.config.loadout?.consumables ?? [];
  return {
    tier,
    balance: villageEmbersLeft(state),
    rows: HUB_CONSUMABLES.map((item) => {
      const refusal = stallRefusal(state, item.id);
      let block: StallBlock | null = null;
      if (refusal === 'owned') block = 'owned';
      else if (item.id === 'paperWard' && wearsGhost(state, playerId)) block = 'ghost';
      else if (refusal) block = 'embers';
      return {
        id: item.id,
        name: item.name,
        effect: STALL_EFFECTS[item.id],
        price: stallPrice(item.id, tier),
        basePrice: item.price,
        block,
        packed: packed.includes(item.id),
      };
    }),
  };
}

// ---- Shrine ---------------------------------------------------------------

export interface ShrineModel {
  secrets: { secret: VillageSecret; found: boolean }[];
  set: SecretSetProgress;
  totalFound: number;
  total: number;
}

/**
 * This village's three secrets and its set reward's state, counting secrets
 * found this mission, plus the count over every village.
 */
export function shrineModel(
  stageId: StageId,
  discoveredSecrets: readonly string[],
  claimedSets: readonly StageId[]
): ShrineModel {
  const all = CAMPAIGN_VILLAGES.flatMap((village) => getVillageSecrets(village.stageId));
  return {
    secrets: getVillageSecrets(stageId).map((secret) => ({
      secret, found: discoveredSecrets.includes(secret.id),
    })),
    set: secretSetProgress(stageId, discoveredSecrets, claimedSets),
    totalFound: all.filter((secret) => discoveredSecrets.includes(secret.id)).length,
    total: all.length,
  };
}

// ---- Gate -----------------------------------------------------------------

export interface GateBriefing {
  title: string;
  objectives: { id: string; label: string; done: boolean }[];
  boss: string | null;
  lives: string | null;
}

export function gateBriefing(state: GameEngineState): GateBriefing | null {
  const { campaign } = state;
  if (!campaign) return null;
  const { bossId } = getStageDefinition(campaign.stageId);
  return {
    title: campaign.title,
    objectives: campaign.objectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      done: objective.status === 'complete',
    })),
    boss: bossId ? getBossDefinition(bossId).name : null,
    lives: campaign.livesTotal
      ? `${campaign.livesRemaining ?? campaign.livesTotal} of ${campaign.livesTotal}`
      : null,
  };
}
