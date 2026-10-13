/* eslint-disable comma-dangle */
// The village square's rules in the match (content/villageSquare.ts has the
// plan and the rules comment): the safe district by each campaign map's
// entrance, its props, the request board's side requests and the stall.
// Everything here reads the GameConfig and the state, so the same INIT and
// action stream always play the same way.
import { CAMPAIGN_STAGE_LAYOUTS } from '../content/campaignLayouts';
import {
  presentInteractables,
  stallPrice,
  type CampaignRequestDefinition,
  type CampaignRequestState,
  type ReputationTierId,
  type VillageSquareBounds,
  type VillageSquareRuntimeState,
} from '../content/villageSquare';
import { VILLAGE_REQUESTS } from '../content/villageRequests';
import { isHubConsumableId, normalizePack, type HubConsumableId } from '../content/hubShop';
import { applyStallConsumable } from './campaignLoadout';
import { nextRandom } from './random';
import type {
  CampaignRuntimeState, GameConfig, GameEngineState, Point,
} from './types';

const TIERS: readonly ReputationTierId[] = ['stranger', 'known', 'trusted', 'honored'];

/** The square of this match, with the props standing at the visit's tier. */
export interface ActiveVillageSquare {
  bounds: VillageSquareBounds;
  tier: ReputationTierId;
  // "x,y" of every present interactable: they block movement like a pillar.
  props: ReadonlySet<string>;
  // "x,y" of every cell in the bounds: no enemy steps on one.
  cellKeys: readonly string[];
  // The cell is inside the bounds.
  contains: (x: number, y: number) => boolean;
}

/** The standing tier the visit was set up with; missing (co-op, online) is Stranger. */
export function visitTier(config: Pick<GameConfig, 'village'>): ReputationTierId {
  const tier = config.village?.reputationTier;
  return tier && TIERS.includes(tier) ? tier : 'stranger';
}

const activeSquares = new WeakMap<GameConfig, ActiveVillageSquare | null>();

function within(bounds: VillageSquareBounds, x: number, y: number): boolean {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

function resolveSquare(config: GameConfig): ActiveVillageSquare | null {
  // Every campaign mission, solo and co-op (online co-op rooms play 'solo').
  if (config.mode !== 'solo' || !config.stageId) return null;
  const layout = CAMPAIGN_STAGE_LAYOUTS[config.stageId];
  // The plan is drawn on the village's campaign map; a mission played on any
  // other board (an engine test's small arena) has no square.
  if (!layout?.square || config.map?.length !== layout.size
    || config.map[0]?.length !== layout.size) {
    return null;
  }
  const tier = visitTier(config);
  const { bounds } = layout.square;
  const cellKeys: string[] = [];
  for (let y = bounds.y0; y <= bounds.y1; y += 1) {
    for (let x = bounds.x0; x <= bounds.x1; x += 1) cellKeys.push(`${x},${y}`);
  }
  return {
    bounds,
    tier,
    cellKeys,
    contains: (x, y) => within(bounds, x, y),
    props: new Set(presentInteractables(layout.square, tier).map(({ x, y }) => `${x},${y}`)),
  };
}

/** The match's square, or null outside the campaign. Memoised per config. */
export function getActiveVillageSquare(config: GameConfig): ActiveVillageSquare | null {
  let square = activeSquares.get(config);
  if (square === undefined) {
    square = resolveSquare(config);
    activeSquares.set(config, square);
  }
  return square;
}

/** The cell (x, y) is inside this match's square. */
export function isInVillageSquare(
  state: Pick<GameEngineState, 'config'>,
  x: number,
  y: number
): boolean {
  const square = getActiveVillageSquare(state.config);
  return !!square && within(square.bounds, x, y);
}

/** A present interactable stands on the cell (x, y). */
export function isVillagePropCell(
  state: Pick<GameEngineState, 'config'>,
  x: number,
  y: number
): boolean {
  const square = getActiveVillageSquare(state.config);
  return !!square && square.props.has(`${x},${y}`);
}

/**
 * Someone whose cell is in the square: blasts, flames, hazards and enemies
 * cannot touch them there, and enemies lose track of them.
 */
export function isShelteredInSquare(
  state: Pick<GameEngineState, 'config'>,
  actor: Point
): boolean {
  return isInVillageSquare(state, Math.round(actor.x), Math.round(actor.y));
}

/** The players enemies can track: everyone outside the square. */
export function playersOutsideSquare<T extends Point>(
  state: Pick<GameEngineState, 'config'>,
  players: T[]
): T[] {
  if (!getActiveVillageSquare(state.config)) return players;
  return players.some((player) => isShelteredInSquare(state, player))
    ? players.filter((player) => !isShelteredInSquare(state, player))
    : players;
}

/** Stops blast rays at the square's edge (getExplosionPositions), or undefined. */
export function squareBlastStop(
  state: Pick<GameEngineState, 'config'>
): ((x: number, y: number) => boolean) | undefined {
  return getActiveVillageSquare(state.config)?.contains;
}

// ---------------------------------------------------------------------------
// The visit: requests on the board and the stall (solo only).

function stageRequests(config: GameConfig): readonly CampaignRequestDefinition[] {
  return config.stageId ? VILLAGE_REQUESTS[config.stageId] ?? [] : [];
}

function requestDefinition(
  config: GameConfig,
  id: string
): CampaignRequestDefinition | undefined {
  return stageRequests(config).find((request) => request.id === id);
}

function requestTarget(definition: CampaignRequestDefinition): number {
  const counted = definition.kind === 'collectMarked'
    || definition.kind === 'breakMarked'
    || definition.kind === 'defeatEnemies';
  const target = counted ? Math.floor(definition.target ?? 1) : 1;
  return Number.isFinite(target) && target > 0 ? target : 1;
}

/** The solo visit's stall and board are open (GameConfig.village, one player). */
function hasVisit(config: GameConfig): boolean {
  return config.mode === 'solo'
    && config.numPlayers === 1
    && !!config.stageId
    && typeof config.village === 'object'
    && config.village !== null;
}

/**
 * campaign.village for a new attempt: the offered requests (this village's
 * own, each once, in board order) and an untouched stall.
 */
export function createVillageRuntime(config: GameConfig): VillageSquareRuntimeState | undefined {
  if (!hasVisit(config)) return undefined;
  const offered = Array.isArray(config.village?.offeredRequestIds)
    ? config.village?.offeredRequestIds ?? []
    : [];
  const requests: CampaignRequestState[] = [];
  offered.forEach((id) => {
    const definition = typeof id === 'string' ? requestDefinition(config, id) : undefined;
    if (!definition || requests.some((request) => request.id === id)) return;
    requests.push({
      id: definition.id, status: 'offered', progress: 0, target: requestTarget(definition),
    });
  });
  return { requests, purchases: [], embersSpent: 0 };
}

export function withVillageVisit(
  campaign: CampaignRuntimeState | null,
  config: GameConfig
): CampaignRuntimeState | null {
  const village = campaign ? createVillageRuntime(config) : undefined;
  return campaign && village ? { ...campaign, village } : campaign;
}

/** Embers the player can still spend at the stall this attempt. */
export function villageEmbersLeft(state: Pick<GameEngineState, 'config' | 'campaign'>): number {
  const embers = state.config.village?.embers;
  const budget = typeof embers === 'number' && Number.isFinite(embers)
    ? Math.max(0, Math.floor(embers))
    : 0;
  return Math.max(0, budget - (state.campaign?.village?.embersSpent ?? 0));
}

/** Why an item cannot be bought now, or null when it can. */
export function stallRefusal(
  state: Pick<GameEngineState, 'config' | 'campaign'>,
  itemId: HubConsumableId
): 'closed' | 'owned' | 'embers' | null {
  const village = state.campaign?.village;
  if (!village || !hasVisit(state.config)) return 'closed';
  const packed = normalizePack(state.config.loadout?.consumables, state.config.loadout?.upgrades);
  if (village.purchases.includes(itemId) || packed.includes(itemId)) return 'owned';
  return stallPrice(itemId, visitTier(state.config)) > villageEmbersLeft(state) ? 'embers' : null;
}

function isMissionOpen(state: GameEngineState): boolean {
  return state.phase === 'playing' && state.campaign?.missionResult === 'in_progress';
}

function hasLivingPlayer(state: GameEngineState, playerId: string): boolean {
  return state.players.some((player) => player.id === playerId && player.alive);
}

function withVillage(state: GameEngineState, village: VillageSquareRuntimeState): GameEngineState {
  return state.campaign ? { ...state, campaign: { ...state.campaign, village } } : state;
}

/** CAMPAIGN_PURCHASE: buy one stall item and apply it at once (works while paused). */
export function purchaseAtStall(
  state: GameEngineState,
  playerId: string,
  itemId: HubConsumableId
): GameEngineState {
  const village = state.campaign?.village;
  if (!village || !isMissionOpen(state) || !hasLivingPlayer(state, playerId)) return state;
  if (!isHubConsumableId(itemId) || stallRefusal(state, itemId)) return state;
  const applied = applyStallConsumable(state, playerId, itemId);
  if (!applied) return state;
  return withVillage(applied, {
    ...village,
    purchases: [...village.purchases, itemId],
    embersSpent: village.embersSpent + stallPrice(itemId, visitTier(state.config)),
  });
}

// ---------------------------------------------------------------------------
// Marked cells: keepsakes and marked crates, from the request's own stream.

// FNV-1a of "<stage>/<request id>": the same request on the same map always
// marks the same cells, and never draws from the match's power-up stream.
/* eslint-disable no-bitwise */
export function requestSeed(stageId: string, requestId: string): number {
  const key = `${stageId}/${requestId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  }
  return hash >>> 0;
}
/* eslint-enable no-bitwise */

const STEPS: readonly Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

interface MarkRules {
  // What the cell must be on the map: open floor or a crate.
  cell: 'Empty' | 'Box';
  // Path length from the square, through anything but walls.
  minDistance: number;
  maxDistance: number;
  // Chebyshev distance kept between two marks.
  spacing: number;
}

const KEEPSAKE_RULES: MarkRules = {
  cell: 'Empty', minDistance: 6, maxDistance: 40, spacing: 6,
};
const MARKED_CRATE_RULES: MarkRules = {
  cell: 'Box', minDistance: 4, maxDistance: 40, spacing: 4,
};

// Places a mark must keep clear of: the mission's own pieces (rescue targets,
// the seal, the gate, puzzle pieces, burrows, wave entries) with a cell of
// room, the boss arena and every secret room with its door.
function keepClear(state: GameEngineState): (x: number, y: number) => boolean {
  const { campaign } = state;
  const points: Point[] = [];
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  campaign?.objectives.forEach((objective) => {
    if (typeof objective.x === 'number' && typeof objective.y === 'number') {
      points.push({ x: objective.x, y: objective.y });
    }
    objective.targets?.forEach((target) => points.push(target));
    objective.puzzle?.elements.forEach((element) => points.push(element));
  });
  campaign?.spawnPoints.forEach((point) => points.push(point));
  campaign?.waves?.entries.forEach((entry) => points.push(entry));
  campaign?.hiddenAreas.forEach((area) => {
    points.push(area);
    if (area.room) {
      rects.push(area.room);
      points.push(area.room.door);
    }
  });
  if (campaign?.bossArena.bounds) rects.push(campaign.bossArena.bounds);
  campaign?.bossArena.gates?.forEach((gate) => points.push(gate));
  return (x, y) => points.some((point) => Math.abs(point.x - x) <= 1 && Math.abs(point.y - y) <= 1)
    || rects.some((rect) => (
      x >= rect.x - 1 && x <= rect.x + rect.width && y >= rect.y - 1 && y <= rect.y + rect.height
    ));
}

/**
 * Every cell a request could mark on this mission's board, in the request's
 * own seeded order. Ranked on the starting board (config.map), so the marks
 * do not depend on when the request is accepted.
 */
function rankedMarkCells(state: GameEngineState, rules: MarkRules, seed: number): Point[] {
  const square = getActiveVillageSquare(state.config);
  const { map } = state.config;
  const height = map.length;
  const width = map[0]?.length ?? 0;
  const distance = new Map<string, number>();
  const queue: Point[] = [];
  // From the square (or the first spawn without one) through anything but walls.
  const start = state.players[0] ?? { x: 1, y: 1 };
  if (square) {
    for (let y = square.bounds.y0; y <= square.bounds.y1; y += 1) {
      for (let x = square.bounds.x0; x <= square.bounds.x1; x += 1) {
        if (map[y]?.[x] !== undefined && map[y][x] !== 'Wall') {
          distance.set(`${x},${y}`, 0);
          queue.push({ x, y });
        }
      }
    }
  } else {
    const cell = { x: Math.round(start.x), y: Math.round(start.y) };
    distance.set(`${cell.x},${cell.y}`, 0);
    queue.push(cell);
  }
  const clear = keepClear(state);
  const candidates: Point[] = [];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const steps = distance.get(`${current.x},${current.y}`) ?? 0;
    if (steps >= rules.minDistance && steps <= rules.maxDistance
      && map[current.y][current.x] === rules.cell
      && !(square && within(square.bounds, current.x, current.y))
      && !clear(current.x, current.y)) {
      candidates.push(current);
    }
    STEPS.forEach((step) => {
      const x = current.x + step.x;
      const y = current.y + step.y;
      const key = `${x},${y}`;
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return;
      if (map[y][x] === 'Wall' || distance.has(key)) return;
      distance.set(key, steps + 1);
      queue.push({ x, y });
    });
  }
  // Seeded Fisher-Yates over the breadth-first order.
  let rng = seed;
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const draw = nextRandom(rng);
    rng = draw.seed;
    const swap = Math.floor(draw.value * (index + 1));
    [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
  }
  return candidates;
}

function pickMarkCells(
  state: GameEngineState,
  definition: CampaignRequestDefinition,
  count: number
): Point[] {
  const rules = definition.kind === 'breakMarked' ? MARKED_CRATE_RULES : KEEPSAKE_RULES;
  const ranked = rankedMarkCells(
    state,
    rules,
    requestSeed(state.config.stageId ?? '', definition.id)
  );
  // Still a crate, or still open floor nobody stands on, right now.
  const usable = ranked.filter(({ x, y }) => state.map[y]?.[x] === rules.cell
    && !state.players.some((player) => (
      player.alive && Math.round(player.x) === x && Math.round(player.y) === y
    )));
  const chosen: Point[] = [];
  [rules.spacing, 0].forEach((spacing) => {
    usable.forEach((cell) => {
      if (chosen.length >= count || chosen.includes(cell)) return;
      if (chosen.every((other) => (
        Math.max(Math.abs(other.x - cell.x), Math.abs(other.y - cell.y)) >= Math.max(1, spacing)
      ))) {
        chosen.push(cell);
      }
    });
  });
  return chosen.map(({ x, y }) => ({ x, y }));
}

// ---------------------------------------------------------------------------
// Request progress.

function lostALife(state: GameEngineState): boolean {
  const { campaign } = state;
  return (campaign?.livesRemaining ?? 1) < (campaign?.livesTotal ?? 1)
    || state.players.some((player) => !player.alive);
}

// Enemies that left the match between two states by being defeated. Water
// clones fade on their own and do not count. A wave enemy can also leave by
// breaching the seal or withdrawing with a fallen seal, so one counts only
// beside a flame.
function countDefeats(previous: GameEngineState, next: GameEngineState): number {
  if (previous.monsters === next.monsters) return 0;
  const remaining = new Set(next.monsters.map((monster) => monster.id));
  const waveIds = new Set(previous.campaign?.waves?.activeMonsterIds ?? []);
  return previous.monsters.filter((monster) => {
    if (remaining.has(monster.id) || monster.clone) return false;
    if (isShelteredInSquare(next, monster)) return false;
    if (!waveIds.has(monster.id)) return true;
    return next.explosions.some((flame) => (
      Math.abs(flame.x - monster.x) <= 1 && Math.abs(flame.y - monster.y) <= 1
    ));
  }).length;
}

function advanceRequest(
  previous: GameEngineState,
  next: GameEngineState,
  request: CampaignRequestState
): CampaignRequestState {
  if (request.status !== 'accepted') return request;
  const definition = requestDefinition(next.config, request.id);
  if (!definition) return request;
  const campaign = next.campaign!;
  let { progress, cells } = request;
  switch (definition.kind) {
    case 'collectMarked':
    case 'breakMarked': {
      // Keepsakes go when stepped on, marked crates when destroyed.
      const gone = definition.kind === 'collectMarked'
        ? ({ x, y }: Point) => next.players.some((player) => (
          player.alive && Math.round(player.x) === x && Math.round(player.y) === y
        ))
        : ({ x, y }: Point) => next.map[y]?.[x] !== 'Box';
      // Most ticks change nothing: keep the same array (and request) then.
      if (cells?.some(gone)) {
        const left = cells.filter((cell) => !gone(cell));
        progress += cells.length - left.length;
        cells = left;
      }
      break;
    }
    case 'findSecret':
      if (definition.secretId && campaign.discoveredSecrets.includes(definition.secretId)) {
        progress = 1;
      }
      break;
    case 'defeatEnemies':
      progress += countDefeats(previous, next);
      break;
    case 'noFall':
      if (lostALife(next)) return { ...request, status: 'failed' };
      if (campaign.missionResult === 'success') progress = 1;
      break;
    default:
      break;
  }
  progress = Math.min(progress, request.target);
  if (progress === request.progress && cells === request.cells) return request;
  return {
    ...request,
    progress,
    status: progress >= request.target ? 'complete' : 'accepted',
    ...(cells ? { cells } : {}),
  };
}

/**
 * Brings accepted requests up to date with what one action or tick did:
 * keepsakes stepped on, marked crates broken, the secret found, enemies
 * defeated, a life lost, the mission won.
 */
export function trackVillageRequests(
  previous: GameEngineState | null,
  next: GameEngineState | null
): GameEngineState | null {
  const village = next?.campaign?.village;
  if (!previous || !next || previous === next || !village) return next;
  // A retry or restart is a new attempt with its own requests.
  if (previous.config !== next.config) return next;
  if (!village.requests.some((request) => request.status === 'accepted')) return next;
  let changed = false;
  const requests = village.requests.map((request) => {
    const advanced = advanceRequest(previous, next, request);
    if (advanced !== request) changed = true;
    return advanced;
  });
  return changed ? withVillage(next, { ...village, requests }) : next;
}

/** ACCEPT_REQUEST: take an offered request from the board (works while paused). */
export function acceptVillageRequest(
  state: GameEngineState,
  playerId: string,
  requestId: string
): GameEngineState {
  const village = state.campaign?.village;
  if (!village || !isMissionOpen(state) || !hasLivingPlayer(state, playerId)) return state;
  const index = village.requests.findIndex((request) => request.id === requestId);
  const definition = requestDefinition(state.config, requestId);
  if (index < 0 || !definition || village.requests[index].status !== 'offered') return state;
  let request: CampaignRequestState = { ...village.requests[index], status: 'accepted' };
  if (definition.kind === 'collectMarked' || definition.kind === 'breakMarked') {
    const cells = pickMarkCells(state, definition, request.target);
    if (cells.length === 0) return state;
    request = { ...request, cells, target: cells.length };
  }
  const requests = village.requests.map((item, at) => (at === index ? request : item));
  const accepted = withVillage(state, { ...village, requests });
  // A secret already found, or a life already lost, settles at once.
  const settled = advanceRequest(state, accepted, request);
  return settled === request
    ? accepted
    : withVillage(accepted, {
      ...village,
      requests: requests.map((item, at) => (at === index ? settled : item)),
    });
}

/**
 * The next attempt's visit after a retry or restart: the embers spent at the
 * stall stay spent, and after a win the finished requests leave the board.
 */
export function withVillageCarryOver(
  config: GameConfig,
  campaign: CampaignRuntimeState | null
): GameConfig {
  const visit = config.village;
  const village = campaign?.village;
  if (!visit || !village) return config;
  const won = campaign?.missionResult === 'success';
  const finished = new Set(won
    ? village.requests.filter((request) => request.status === 'complete').map((request) => request.id)
    : []);
  if (village.embersSpent <= 0 && finished.size === 0) return config;
  const embers = typeof visit.embers === 'number' && Number.isFinite(visit.embers) ? visit.embers : 0;
  return {
    ...config,
    village: {
      ...visit,
      embers: Math.max(0, Math.floor(embers) - village.embersSpent),
      offeredRequestIds: (visit.offeredRequestIds ?? []).filter((id) => !finished.has(id)),
    },
  };
}
