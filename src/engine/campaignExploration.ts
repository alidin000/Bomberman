/* eslint-disable comma-dangle */
import { getCampaignPowerUp } from '../content/characterPowerups';
import { EnemyArchetype } from '../content/enemies';
import { isBomb, isObstacle } from '../model/gameItem';
import {
  CampaignDestructionOutcome,
  CampaignDestructionOutcomeKind,
  DestroyedBox,
  GameEngineState,
} from './types';
import { createShinobiEnemy } from './campaignEnemies';

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

function hiddenAreaOutcome(
  state: GameEngineState,
  x: number,
  y: number
): CampaignDestructionOutcome | null {
  const { campaign } = state;
  if (!campaign) return null;
  const hiddenArea = campaign.hiddenAreas.find((area) => (
    area.x === x
    && area.y === y
    && !campaign.discoveredSecrets.includes(area.id)
  ));
  if (!hiddenArea) return null;

  if (hiddenArea.enemyArchetype) {
    return {
      kind: hiddenArea.enemyArchetype === 'blackZetsu' ? 'eliteZetsu' : 'whiteZetsu',
      enemyArchetype: hiddenArea.enemyArchetype,
      secretId: hiddenArea.id,
      label: hiddenArea.label,
    };
  }

  if (hiddenArea.rewardPowerUp === 'CharacterFragment') {
    return {
      kind: 'rareReward',
      powerUp: hiddenArea.rewardPowerUp,
      secretId: hiddenArea.id,
      label: hiddenArea.label,
    };
  }

  return {
    kind: 'powerUp',
    powerUp: hiddenArea.rewardPowerUp,
    secretId: hiddenArea.id,
    label: hiddenArea.label,
  };
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

export function resolveCampaignDestroyedBox(
  state: GameEngineState,
  box: DestroyedBox,
): GameEngineState {
  const outcome = box.pendingOutcome;
  if (!state.campaign || !outcome) return state;

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
    if (!canRevealAt(state, box.x, box.y)) return { ...state, campaign };
    const map = state.map.map((row) => [...row]);
    map[box.y][box.x] = outcome.powerUp;
    return { ...state, map, campaign };
  }

  if (outcome.kind === 'whiteZetsu' || outcome.kind === 'eliteZetsu') {
    if (!canRevealAt(state, box.x, box.y)) return { ...state, campaign };
    const archetype: EnemyArchetype = outcome.enemyArchetype
      ?? (outcome.kind === 'eliteZetsu' ? 'blackZetsu' : 'whiteZetsu');
    const monster = createShinobiEnemy({
      archetype,
      x: box.x,
      y: box.y,
      id: outcome.secretId
        ? `${outcome.secretId}-enemy`
        : `zetsu-${state.tick}-${box.x}-${box.y}`,
    });
    return {
      ...state,
      campaign,
      monsters: [...state.monsters, monster],
    };
  }

  return { ...state, campaign };
}
