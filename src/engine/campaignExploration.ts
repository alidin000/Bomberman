/* eslint-disable comma-dangle */
import { getCampaignPowerUp } from '../content/characterPowerups';
import { EnemyArchetype } from '../content/enemies';
import { isBomb, isObstacle } from '../model/gameItem';
import type { CampaignHiddenAreaDefinition, CampaignSecretRoomDefinition } from '../content/campaignMissions';
import {
  CampaignDestructionOutcome,
  CampaignDestructionOutcomeKind,
  DestroyedBox,
  GameEngineState,
  Point,
} from './types';
import { getPlayerCell } from './grid';
import { createShinobiEnemy } from './campaignEnemies';
import { getDifficulty } from './difficulty';

function hashNumbers(...values: number[]): number {
  let hash = 2166136261;
  values.forEach((value) => {
    hash = Math.imul(hash + Math.floor(value * 131), 16777619);
  });
  return Math.abs(hash);
}

export function resolveZetsuOutcomeKind(roll: number): CampaignDestructionOutcomeKind {
  if (roll < 60) return 'nothing';
  if (roll < 80) return 'powerUp';
  if (roll < 95) return 'whiteZetsu';
  if (roll < 99) return 'eliteZetsu';
  return 'rareReward';
}

function getOutcomeRoll(state: GameEngineState, x: number, y: number, ownerId?: string): number {
  const { players } = state;
  const owner = players.find((player) => player.id === ownerId) ?? players[0];
  const missionSalt = state.campaign?.missionId.length ?? 0;
  return hashNumbers(
    x,
    y,
    state.tick,
    owner?.characterId.length ?? 0,
    missionSalt,
  ) % 100;
}

function getRewardCharacter(state: GameEngineState, ownerId?: string) {
  return (state.players.find((player) => player.id === ownerId) ?? state.players[0])
    ?.characterId;
}

function authoredOutcome(area: CampaignHiddenAreaDefinition): CampaignDestructionOutcome {
  if (area.enemyArchetype) {
    return {
      kind: area.enemyArchetype === 'blackZetsu' ? 'eliteZetsu' : 'whiteZetsu',
      enemyArchetype: area.enemyArchetype,
      secretId: area.id,
      label: area.label,
    };
  }

  if (area.rewardPowerUp === 'CharacterFragment') {
    return {
      kind: 'rareReward',
      powerUp: area.rewardPowerUp,
      secretId: area.id,
      label: area.label,
    };
  }

  return {
    kind: 'powerUp',
    powerUp: area.rewardPowerUp,
    secretId: area.id,
    label: area.label,
  };
}

function hiddenAreaOutcome(
  state: GameEngineState,
  x: number,
  y: number
): CampaignDestructionOutcome | null {
  const { campaign } = state;
  if (!campaign) return null;
  // A secret room's cracked wall only crumbles: the room itself is the secret.
  if (campaign.hiddenAreas.some((area) => area.room?.door.x === x && area.room.door.y === y)) {
    return { kind: 'nothing' };
  }
  const hiddenArea = campaign.hiddenAreas.find((area) => (
    !area.room
    && area.x === x
    && area.y === y
    && !campaign.discoveredSecrets.includes(area.id)
  ));
  return hiddenArea ? authoredOutcome(hiddenArea) : null;
}

export function getCampaignDestructionOutcome(
  state: GameEngineState,
  x: number,
  y: number,
  ownerId?: string,
): CampaignDestructionOutcome {
  const authored = hiddenAreaOutcome(state, x, y);
  if (authored) return authored;

  const roll = getOutcomeRoll(state, x, y, ownerId);
  const kind = resolveZetsuOutcomeKind(roll);
  const seed = hashNumbers(x, y, state.tick, roll);
  if (kind === 'powerUp') {
    return {
      kind,
      powerUp: getCampaignPowerUp(getRewardCharacter(state, ownerId), seed),
    };
  }
  if (kind === 'rareReward') {
    return {
      kind,
      powerUp: seed % 2 === 0 ? 'CharacterFragment' : 'ChakraScroll',
    };
  }
  // Easier difficulties let some rolled ambushes come up empty.
  const { ambushChance } = getDifficulty(state.campaign?.difficulty);
  if ((kind === 'whiteZetsu' || kind === 'eliteZetsu') && (seed % 100) >= ambushChance * 100) {
    return { kind: 'nothing' };
  }
  if (kind === 'whiteZetsu') {
    return { kind, enemyArchetype: 'whiteZetsu' };
  }
  if (kind === 'eliteZetsu') {
    return { kind, enemyArchetype: 'blackZetsu' };
  }
  return { kind };
}

function canRevealAt(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell);
}

function getDiscoveredSecrets(
  state: GameEngineState,
  outcome: CampaignDestructionOutcome
): string[] {
  if (!state.campaign || !outcome.secretId) {
    return state.campaign?.discoveredSecrets ?? [];
  }
  return state.campaign.discoveredSecrets.includes(outcome.secretId)
    ? state.campaign.discoveredSecrets
    : [...state.campaign.discoveredSecrets, outcome.secretId];
}

function applyCampaignOutcome(
  state: GameEngineState,
  x: number,
  y: number,
  outcome: CampaignDestructionOutcome,
): GameEngineState {
  if (!state.campaign) return state;

  const discoveredSecrets = getDiscoveredSecrets(state, outcome);
  const campaign = {
    ...state.campaign,
    discoveredSecrets,
    message: outcome.label
      ? `Secret discovered: ${outcome.label}.`
      : state.campaign.message,
  };

  if (outcome.kind === 'nothing') {
    return { ...state, campaign };
  }

  if ((outcome.kind === 'powerUp' || outcome.kind === 'rareReward') && outcome.powerUp) {
    if (!canRevealAt(state, x, y)) return { ...state, campaign };
    const map = state.map.map((row) => [...row]);
    map[y][x] = outcome.powerUp;
    return { ...state, map, campaign };
  }

  if (outcome.kind === 'whiteZetsu' || outcome.kind === 'eliteZetsu') {
    if (!canRevealAt(state, x, y)) return { ...state, campaign };
    const archetype: EnemyArchetype = outcome.enemyArchetype
      ?? (outcome.kind === 'eliteZetsu' ? 'blackZetsu' : 'whiteZetsu');
    const monster = createShinobiEnemy({
      archetype,
      x,
      y,
      id: outcome.secretId
        ? `${outcome.secretId}-enemy`
        : `zetsu-${state.tick}-${x}-${y}`,
      difficulty: getDifficulty(state.campaign.difficulty),
    });
    return {
      ...state,
      campaign,
      monsters: [...state.monsters, monster],
    };
  }

  return { ...state, campaign };
}

export function resolveCampaignDestroyedBox(
  state: GameEngineState,
  box: DestroyedBox,
): GameEngineState {
  const outcome = box.pendingOutcome;
  if (!state.campaign || !outcome) return state;
  return applyCampaignOutcome(state, box.x, box.y, outcome);
}

export function isInsideSecretRoom(
  room: CampaignSecretRoomDefinition,
  x: number,
  y: number
): boolean {
  return x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height;
}

// An ambush appears at least this many steps from every player.
const AMBUSH_CLEARANCE = 2;

// Where a found room shows its secret: the authored floor cell when it is
// clear, else the nearest clear cell of the room. An ambush keeps its distance.
function findRevealCell(
  state: GameEngineState,
  area: CampaignHiddenAreaDefinition,
  room: CampaignSecretRoomDefinition
): Point | null {
  const cells: Point[] = Array.from({ length: room.width * room.height }, (_, index) => ({
    x: room.x + (index % room.width),
    y: room.y + Math.floor(index / room.width),
  }));
  const distance = (cell: Point) => Math.abs(cell.x - area.x) + Math.abs(cell.y - area.y);
  cells.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
  const clearance = area.enemyArchetype ? AMBUSH_CLEARANCE : 1;
  return cells.find((cell) => (
    canRevealAt(state, cell.x, cell.y)
    && !state.monsters.some((monster) => (
      Math.round(monster.x) === cell.x && Math.round(monster.y) === cell.y
    ))
    && state.players.every((player) => {
      if (!player.alive) return true;
      const at = getPlayerCell(player);
      return Math.abs(at.x - cell.x) + Math.abs(at.y - cell.y) >= clearance;
    })
  )) ?? null;
}

/**
 * Secret rooms: the first player to stand on a room's floor finds it. Its
 * scroll or fragment appears on the room floor, or its elite Zetsu wakes at
 * the far end. Each room gives its secret once per attempt.
 */
export function discoverSecretRooms(state: GameEngineState): GameEngineState {
  const { campaign } = state;
  if (!campaign || campaign.missionResult !== 'in_progress') return state;
  let next = state;
  campaign.hiddenAreas.forEach((area) => {
    const { room } = area;
    if (!room || next.campaign?.discoveredSecrets.includes(area.id)) return;
    const entered = next.players.some((player) => {
      if (!player.alive) return false;
      const cell = getPlayerCell(player);
      return isInsideSecretRoom(room, cell.x, cell.y);
    });
    if (!entered) return;
    const cell = findRevealCell(next, area, room);
    if (cell) next = applyCampaignOutcome(next, cell.x, cell.y, authoredOutcome(area));
  });
  return next;
}
