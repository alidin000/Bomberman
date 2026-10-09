import { getCampaignMission } from '../content/campaignMissions';
import { getCampaignEvent } from '../content/campaignEvents';
import { EnemyArchetype } from '../content/enemies';
import { isBomb, isObstacle } from '../model/gameItem';
import { createShinobiEnemy } from './campaignEnemies';
import {
  CampaignObjectiveState,
  CampaignRuntimeState,
  GameConfig,
  GameEngineState,
  Point,
} from './types';
import { positionsTouch } from './grid';
import { hazardIsActive } from './bosses';
import { getDifficulty, getMatchDifficulty } from './difficulty';
import { FALL_NOTICE_TICKS, livesLabel } from './campaignLives';
import { createPuzzleState, puzzleMessage, updatePuzzleObjective } from './campaignPuzzles';
import {
  advanceCampaignWaves,
  createCampaignWaveState,
  scheduleWaveDefense,
} from './campaignWaves';

const RESCUE_TOUCH_DISTANCE = 0.72;
const MINI_BOSS_TOUCH_DISTANCE = 0.82;
const STRUCTURE_DAMAGE = 50;
const STRUCTURE_DAMAGE_COOLDOWN_MS = 650;
const MINI_BOSS_GUARD_ARCHETYPES: Record<
CampaignRuntimeState['stageId'],
EnemyArchetype
> = {
  hiddenLeaf: 'anbu',
  hiddenSand: 'sandNinja',
  hiddenMist: 'mistNinja',
  hiddenCloud: 'cloudNinja',
  // Akatsuchi flickers in close instead of out-thinking the player: the
  // smart sand chaser made stage 5 a spike above stages 6 and 7.
  hiddenStone: 'anbu',
  akatsukiHideout: 'blackZetsu',
  greatShinobiWar: 'blackZetsu',
};
// The mini boss holds its gate: it never wanders further while unprovoked.
const MINI_BOSS_LEASH_CELLS = 4;
const MINI_BOSS_GUARD_OFFSETS: Point[] = [
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: 0, y: 0 },
];

// Array.map that hands back the input when no element changed, so a step that
// changes nothing keeps the campaign's identity and its consumers skip work.
function mapUnchanged<T>(items: T[], update: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    const result = update(item);
    if (result !== item) changed = true;
    return result;
  });
  return changed ? next : items;
}

function objectiveIsComplete(
  objectives: CampaignObjectiveState[],
  objectiveId: string
): boolean {
  return objectives.some((objective) => (
    objective.id === objectiveId && objective.status === 'complete'
  ));
}

function requirementsMet(
  objectives: CampaignObjectiveState[],
  objective: CampaignObjectiveState
): boolean {
  return (objective.requires ?? []).every((requiredId) => (
    objectiveIsComplete(objectives, requiredId)
  ));
}

function refreshObjectiveStatuses(
  objectives: CampaignObjectiveState[]
): CampaignObjectiveState[] {
  return mapUnchanged(objectives, (objective) => {
    if (objective.status === 'complete' || objective.status === 'failed') {
      return objective;
    }
    const status = requirementsMet(objectives, objective) ? 'active' : 'locked';
    return status === objective.status ? objective : { ...objective, status };
  });
}

function allObjectivesComplete(objectives: CampaignObjectiveState[]): boolean {
  return objectives.every((objective) => objective.status === 'complete');
}

function anyObjectiveFailed(objectives: CampaignObjectiveState[]): boolean {
  return objectives.some((objective) => objective.status === 'failed');
}

function getCurrentDistrictId(campaign: CampaignRuntimeState): string {
  const activeObjective = campaign.objectives.find((objective) => (
    objective.status === 'active'
  ));
  return activeObjective?.districtId
    ?? campaign.districts[0]?.id
    ?? campaign.currentDistrictId;
}

function getMissionStep(
  campaign: CampaignRuntimeState,
  boss: GameEngineState['boss'] = null
) {
  if (campaign.missionResult === 'failed') return 'failed';
  if (campaign.missionResult === 'success') return 'complete';
  if (campaign.bossUnlocked && boss && boss.health > 0) return 'boss';
  if (campaign.bossUnlocked) return 'bossGate';

  const activeObjective = campaign.objectives.find((objective) => (
    objective.status === 'active'
  ));
  if (!activeObjective) return 'exploration';
  if (activeObjective.kind === 'rescue') return 'rescue';
  if (activeObjective.kind === 'defense') return 'defense';
  if (activeObjective.kind === 'puzzle') return 'puzzle';
  if (activeObjective.kind === 'miniBoss') return 'miniBoss';
  return 'exploration';
}

function getCampaignStructures(objectives: CampaignObjectiveState[]) {
  return objectives
    .filter((objective) => (
      objective.kind === 'defense'
      && typeof objective.x === 'number'
      && typeof objective.y === 'number'
    ))
    .map((objective) => ({
      id: objective.id,
      label: objective.structureLabel ?? objective.label,
      x: objective.x ?? 0,
      y: objective.y ?? 0,
      hp: objective.structureHp ?? 0,
      maxHp: objective.structureMaxHp ?? objective.structureHp ?? 0,
      status: objective.status,
    }));
}

function getCampaignMessage(
  campaign: CampaignRuntimeState,
  boss: GameEngineState['boss'] = null
): string {
  if (campaign.missionResult === 'failed') {
    return 'Mission failed. Restart the village and protect the objective.';
  }

  if (campaign.missionResult === 'success') {
    return `${campaign.villageName} secured. Reward unlocked.`;
  }

  if (campaign.bossUnlocked && boss && boss.health > 0) {
    return `${campaign.bossArena.label} active. Defeat ${boss.name}.`;
  }

  if (campaign.bossUnlocked) {
    return `${campaign.bossGateLabel} open. Defeat the village boss.`;
  }

  const activeObjective = campaign.objectives.find((objective) => (
    objective.status === 'active'
  ));
  if (!activeObjective) return 'Complete village objectives to open the boss arena.';
  if (activeObjective.kind === 'puzzle') return puzzleMessage(activeObjective);
  return activeObjective.description;
}

function getMiniBossGuardId(objective: CampaignObjectiveState): string {
  return objective.miniBossGuardId ?? `${objective.id}-guard`;
}

function canSpawnMiniBossGuardAt(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell)
    && !state.monsters.some((monster) => monster.x === x && monster.y === y)
    && !state.players.some((player) => player.alive && positionsTouch(player, { x, y }, 0.55));
}

function findMiniBossGuardCell(
  state: GameEngineState,
  objective: CampaignObjectiveState
): Point | null {
  if (typeof objective.x !== 'number' || typeof objective.y !== 'number') {
    return null;
  }

  const match = MINI_BOSS_GUARD_OFFSETS.find((offset) => (
    canSpawnMiniBossGuardAt(
      state,
      (objective.x ?? 0) + offset.x,
      (objective.y ?? 0) + offset.y
    )
  ));
  return match
    ? { x: objective.x + match.x, y: objective.y + match.y }
    : null;
}

function spawnActiveMiniBossGuards(state: GameEngineState): GameEngineState {
  if (!state.campaign) return state;

  const { campaign } = state;
  let { monsters } = state;
  const objectives = mapUnchanged(campaign.objectives, (objective) => {
    if (
      objective.kind !== 'miniBoss'
      || objective.status !== 'active'
      || objective.miniBossSpawned
    ) {
      return objective;
    }

    const guardId = getMiniBossGuardId(objective);
    if (monsters.some((monster) => monster.id === guardId)) {
      return { ...objective, miniBossGuardId: guardId, miniBossSpawned: true };
    }

    const cell = findMiniBossGuardCell({ ...state, monsters }, objective);
    if (!cell) return objective;

    const difficulty = getDifficulty(campaign.difficulty);
    const guard = createShinobiEnemy({
      archetype: MINI_BOSS_GUARD_ARCHETYPES[campaign.stageId],
      x: cell.x,
      y: cell.y,
      id: guardId,
      difficulty,
    });
    monsters = [
      ...monsters,
      {
        ...guard,
        name: objective.miniBossLabel ?? guard.name,
        elite: true,
        detectionRange: 8 + difficulty.detectionOffset,
        moveCooldown: Math.min(guard.moveCooldown, Math.round(420 * difficulty.enemyMoveScale)),
        abilityCooldown: Math.round(700 * difficulty.abilityCooldownScale),
        leash: {
          x: objective.x ?? cell.x,
          y: objective.y ?? cell.y,
          radius: MINI_BOSS_LEASH_CELLS,
        },
      },
    ];
    return { ...objective, miniBossGuardId: guardId, miniBossSpawned: true };
  });
  if (objectives === campaign.objectives) return state;

  return {
    ...state,
    monsters,
    campaign: {
      ...campaign,
      objectives,
    },
  };
}

export function createCampaignRuntimeState(
  config: GameConfig
): CampaignRuntimeState | null {
  if (config.mode !== 'solo') return null;

  const mission = getCampaignMission(config.stageId);
  if (!mission) return null;
  const difficulty = getMatchDifficulty(config);

  const missionObjectives: CampaignObjectiveState[] = mission.objectives.map((objective) => {
    const targets = objective.targets?.map((target) => ({
      ...target,
      rescued: false,
    }));
    let target = objective.durationMs ?? 0;
    if (objective.kind === 'rescue') {
      target = objective.targetCount ?? targets?.length ?? 0;
    }
    if (objective.kind === 'miniBoss') {
      target = 1;
    }
    const puzzle = objective.kind === 'puzzle' && objective.puzzle
      ? createPuzzleState(objective.puzzle, difficulty.id, difficulty.lives)
      : undefined;
    if (puzzle) target = puzzle.total;
    return {
      id: objective.id,
      kind: objective.kind,
      label: objective.label,
      description: objective.description,
      districtId: objective.districtId,
      status: (objective.requires?.length ?? 0) > 0 ? 'locked' : 'active',
      current: 0,
      target,
      targets,
      ticksRemaining: objective.durationMs,
      durationMs: objective.durationMs,
      structureLabel: objective.structureLabel,
      structureHp: objective.structureHp,
      structureMaxHp: objective.structureHp,
      structureDamageCooldownMs: 0,
      miniBossLabel: objective.miniBossLabel,
      gateLabel: objective.gateLabel,
      miniBossGuardId: objective.kind === 'miniBoss'
        ? `${objective.id}-guard`
        : undefined,
      miniBossSpawned: false,
      puzzle,
      x: objective.x,
      y: objective.y,
      requires: objective.requires,
    };
  });
  // Scripted defense waves set the defense's seal timer and structure health.
  const waves = createCampaignWaveState(
    mission.stageId,
    missionObjectives,
    difficulty.id,
    getCampaignEvent(mission.stageId),
    config.seed
  );
  const objectives = scheduleWaveDefense(missionObjectives, waves, mission.stageId, difficulty.id);

  const campaign: CampaignRuntimeState = {
    missionId: mission.id,
    stageId: mission.stageId,
    currentVillage: mission.stageId,
    title: mission.title,
    villageName: mission.villageName,
    missionStep: 'exploration',
    missionResult: 'in_progress',
    currentDistrictId: mission.districts[0]?.id ?? 'villageEntrance',
    districts: mission.districts,
    spawnPoints: mission.spawnPoints.map((spawnPoint) => {
      const respawnMs = Math.round(spawnPoint.respawnMs * difficulty.respawnScale);
      return {
        ...spawnPoint,
        respawnMs,
        maxActive: Math.max(1, spawnPoint.maxActive + difficulty.maxActiveOffset),
        ticksRemaining: respawnMs,
        activeMonsterIds: [],
        spawnCount: 0,
      };
    }),
    hiddenAreas: mission.hiddenAreas,
    discoveredSecrets: mission.discoveredSecrets,
    event: getCampaignEvent(mission.stageId),
    structures: getCampaignStructures(objectives),
    miniBossGateLabel: mission.miniBossGateLabel,
    bossGateLabel: mission.bossGateLabel,
    bossArena: {
      ...mission.bossArena,
      unlocked: false,
    },
    objectives,
    bossUnlocked: false,
    message: '',
    difficulty: difficulty.id,
    livesRemaining: difficulty.lives,
    livesTotal: difficulty.lives,
    waves,
  };

  return {
    ...campaign,
    currentDistrictId: getCurrentDistrictId(campaign),
    missionStep: getMissionStep(campaign),
    message: getCampaignMessage(campaign),
  };
}

function updateRescueObjective(
  state: GameEngineState,
  objective: CampaignObjectiveState
): CampaignObjectiveState {
  if (objective.kind !== 'rescue' || objective.status !== 'active') return objective;

  const targets = mapUnchanged(objective.targets ?? [], (target) => {
    if (target.rescued) return target;
    const rescued = state.players.some((player) => (
      player.alive
      && positionsTouch(player, target, RESCUE_TOUCH_DISTANCE)
    ));
    return rescued ? { ...target, rescued: true } : target;
  });
  const rescuedCount = targets.filter((target) => target.rescued).length;
  const status = rescuedCount >= objective.target ? 'complete' : objective.status;
  if (
    targets === objective.targets
    && rescuedCount === objective.current
    && status === objective.status
  ) {
    return objective;
  }
  return {
    ...objective,
    targets,
    current: rescuedCount,
    status,
  };
}

function objectiveTakesStructureDamage(
  state: GameEngineState,
  objective: CampaignObjectiveState
): boolean {
  if (typeof objective.x !== 'number' || typeof objective.y !== 'number') {
    return false;
  }
  const structurePosition = { x: objective.x, y: objective.y };

  return state.explosions.some((explosion) => (
    explosion.x === objective.x && explosion.y === objective.y
  ))
    || state.hazards.some((hazard) => (
      hazard.damage > 0
      && hazardIsActive(hazard)
      && positionsTouch(hazard, structurePosition, 0.68)
    ))
    || state.monsters.some((monster) => (
      positionsTouch(monster, structurePosition, 0.68)
    ));
}

function updateDefenseObjective(
  state: GameEngineState,
  objective: CampaignObjectiveState,
  deltaMs: number
): CampaignObjectiveState {
  if (
    objective.kind !== 'defense'
    || objective.status !== 'active'
    || deltaMs <= 0
  ) {
    return objective;
  }

  const damageCooldown = Math.max(
    0,
    (objective.structureDamageCooldownMs ?? 0) - deltaMs
  );
  const damaged = damageCooldown <= 0
    && objectiveTakesStructureDamage(state, objective);
  const structureDamage = Math.round((STRUCTURE_DAMAGE
    + (state.campaign?.event?.structureDamageBonus ?? 0))
    * getDifficulty(state.campaign?.difficulty).structureDamageScale);
  const structureHp = damaged
    ? Math.max(0, (objective.structureHp ?? 0) - structureDamage)
    : objective.structureHp;
  if ((structureHp ?? 0) <= 0) {
    return {
      ...objective,
      structureHp: 0,
      structureDamageCooldownMs: STRUCTURE_DAMAGE_COOLDOWN_MS,
      status: 'failed',
    };
  }

  const ticksRemaining = Math.max(0, (objective.ticksRemaining ?? 0) - deltaMs);
  const durationMs = objective.durationMs ?? objective.target;
  const current = Math.min(durationMs, durationMs - ticksRemaining);
  return {
    ...objective,
    structureHp,
    structureDamageCooldownMs: damaged
      ? STRUCTURE_DAMAGE_COOLDOWN_MS
      : damageCooldown,
    ticksRemaining,
    current,
    status: ticksRemaining <= 0 ? 'complete' : objective.status,
  };
}

function updateMiniBossObjective(
  state: GameEngineState,
  objective: CampaignObjectiveState
): CampaignObjectiveState {
  if (objective.kind !== 'miniBoss' || objective.status !== 'active') {
    return objective;
  }
  if (typeof objective.x !== 'number' || typeof objective.y !== 'number') {
    return objective;
  }
  const gatePosition = { x: objective.x, y: objective.y };
  if (!objective.miniBossSpawned) return objective;

  const guardAlive = state.monsters.some((monster) => (
    monster.id === getMiniBossGuardId(objective)
  ));
  if (guardAlive) return objective.current === 0 ? objective : { ...objective, current: 0 };

  const reached = state.players.some((player) => (
    player.alive
    && positionsTouch(player, gatePosition, MINI_BOSS_TOUCH_DISTANCE)
  ));
  return reached
    ? { ...objective, current: 1, status: 'complete' }
    : objective;
}

function sameStructures(
  previous: CampaignRuntimeState['structures'],
  next: CampaignRuntimeState['structures']
): boolean {
  return previous.length === next.length && previous.every((structure, index) => {
    const other = next[index];
    return structure.id === other.id
      && structure.label === other.label
      && structure.x === other.x
      && structure.y === other.y
      && structure.hp === other.hp
      && structure.maxHp === other.maxHp
      && structure.status === other.status;
  });
}

function sameCampaignSummary(
  previous: CampaignRuntimeState,
  next: CampaignRuntimeState
): boolean {
  return previous.bossUnlocked === next.bossUnlocked
    && previous.livesRemaining === next.livesRemaining
    && previous.missionResult === next.missionResult
    && previous.bossArena.unlocked === next.bossArena.unlocked
    && previous.currentDistrictId === next.currentDistrictId
    && previous.missionStep === next.missionStep
    && previous.message === next.message
    && sameStructures(previous.structures, next.structures);
}

function advanceObjectiveStates(
  state: GameEngineState,
  deltaMs: number
): GameEngineState {
  if (!state.campaign) return state;

  let objectives = mapUnchanged(
    state.campaign.objectives,
    (objective) => updateRescueObjective(state, objective)
  );
  objectives = refreshObjectiveStatuses(objectives);
  objectives = mapUnchanged(objectives, (objective) => updateDefenseObjective(
    state,
    objective,
    deltaMs
  ));
  // While lives remain, a fallen structure costs a life and its seal
  // restarts at full strength instead of failing the whole mission.
  let { livesRemaining, fallNotice, fallNoticeUntilTick } = state.campaign;
  const fallen = objectives.find((objective) => (
    objective.kind === 'defense' && objective.status === 'failed'
  ));
  if (fallen && (livesRemaining ?? 1) > 1) {
    livesRemaining = (livesRemaining ?? 1) - 1;
    fallNotice = `${fallen.structureLabel ?? fallen.label} fell. The seal restarts: ${livesLabel(livesRemaining)}.`;
    fallNoticeUntilTick = state.tick + FALL_NOTICE_TICKS;
    objectives = objectives.map((objective) => (
      objective === fallen
        ? {
          ...objective,
          status: 'active',
          structureHp: objective.structureMaxHp,
          ticksRemaining: objective.durationMs,
          current: 0,
        }
        : objective
    ));
  }
  objectives = refreshObjectiveStatuses(objectives);
  objectives = mapUnchanged(objectives, (objective) => updatePuzzleObjective(state, objective));
  objectives = refreshObjectiveStatuses(objectives);

  let workingState: GameEngineState = objectives === state.campaign.objectives
    ? state
    : {
      ...state,
      campaign: {
        ...state.campaign,
        objectives,
      },
    };
  workingState = spawnActiveMiniBossGuards(workingState);
  objectives = workingState.campaign?.objectives ?? objectives;
  objectives = mapUnchanged(
    objectives,
    (objective) => updateMiniBossObjective(workingState, objective)
  );
  objectives = refreshObjectiveStatuses(objectives);

  const missionResult = anyObjectiveFailed(objectives)
    ? 'failed'
    : state.campaign.missionResult;
  const bossUnlocked = missionResult === 'in_progress' && allObjectivesComplete(objectives);
  const campaign = {
    ...state.campaign,
    objectives,
    bossUnlocked,
    missionResult,
    bossArena: {
      ...state.campaign.bossArena,
      unlocked: bossUnlocked,
    },
    livesRemaining,
    fallNotice,
    fallNoticeUntilTick,
  };
  const noticeActive = !!fallNotice && missionResult === 'in_progress'
    && state.tick < (fallNoticeUntilTick ?? 0);

  const nextCampaign: CampaignRuntimeState = {
    ...campaign,
    currentDistrictId: getCurrentDistrictId(campaign),
    missionStep: getMissionStep(campaign, state.boss),
    structures: getCampaignStructures(objectives),
    message: noticeActive && fallNotice ? fallNotice : getCampaignMessage(campaign, state.boss),
  };
  // Movement steps and most ticks change nothing here: keep the old state.
  if (
    workingState === state
    && objectives === state.campaign.objectives
    && sameCampaignSummary(state.campaign, nextCampaign)
  ) {
    return state;
  }
  return {
    ...workingState,
    campaign: nextCampaign,
  };
}

export function advanceCampaignObjectives(
  state: GameEngineState,
  deltaMs = 0
): GameEngineState {
  return advanceCampaignWaves(state, advanceObjectiveStates(state, deltaMs), deltaMs);
}
