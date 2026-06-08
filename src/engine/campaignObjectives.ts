import { getCampaignMission } from '../content/campaignMissions';
import {
  CampaignObjectiveState,
  CampaignRuntimeState,
  GameConfig,
  GameEngineState,
} from './types';
import { positionsTouch } from './grid';

const RESCUE_TOUCH_DISTANCE = 0.72;
const MINI_BOSS_TOUCH_DISTANCE = 0.82;
const STRUCTURE_DAMAGE = 50;
const STRUCTURE_DAMAGE_COOLDOWN_MS = 650;

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
  return objectives.map((objective) => {
    if (objective.status === 'complete' || objective.status === 'failed') {
      return objective;
    }
    return {
      ...objective,
      status: requirementsMet(objectives, objective) ? 'active' : 'locked',
    };
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
  return activeObjective.description;
}

export function createCampaignRuntimeState(
  config: GameConfig
): CampaignRuntimeState | null {
  if (config.mode !== 'solo') return null;

  const mission = getCampaignMission(config.stageId);
  if (!mission) return null;

  const objectives: CampaignObjectiveState[] = mission.objectives.map((objective) => {
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
      x: objective.x,
      y: objective.y,
      requires: objective.requires,
    };
  });

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
    spawnPoints: mission.spawnPoints,
    discoveredSecrets: mission.discoveredSecrets,
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

  const targets = (objective.targets ?? []).map((target) => {
    if (target.rescued) return target;
    const rescued = state.players.some((player) => (
      player.alive
      && positionsTouch(player, target, RESCUE_TOUCH_DISTANCE)
    ));
    return rescued ? { ...target, rescued: true } : target;
  });
  const rescuedCount = targets.filter((target) => target.rescued).length;
  return {
    ...objective,
    targets,
    current: rescuedCount,
    status: rescuedCount >= objective.target ? 'complete' : objective.status,
  };
}

function objectiveTakesStructureDamage(
  state: GameEngineState,
  objective: CampaignObjectiveState
): boolean {
  if (typeof objective.x !== 'number' || typeof objective.y !== 'number') {
    return false;
  }

  return state.explosions.some((explosion) => (
    explosion.x === objective.x && explosion.y === objective.y
  ))
    || state.hazards.some((hazard) => (
      hazard.warningTicks <= 0
      && positionsTouch(hazard, objective, 0.68)
    ))
    || state.monsters.some((monster) => (
      positionsTouch(monster, objective, 0.68)
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
  const structureHp = damaged
    ? Math.max(0, (objective.structureHp ?? 0) - STRUCTURE_DAMAGE)
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

  const reached = state.players.some((player) => (
    player.alive
    && positionsTouch(player, objective, MINI_BOSS_TOUCH_DISTANCE)
  ));
  return reached
    ? { ...objective, current: 1, status: 'complete' }
    : objective;
}

export function advanceCampaignObjectives(
  state: GameEngineState,
  deltaMs = 0
): GameEngineState {
  if (!state.campaign) return state;

  let objectives = state.campaign.objectives
    .map((objective) => updateRescueObjective(state, objective));
  objectives = refreshObjectiveStatuses(objectives);
  objectives = objectives.map((objective) => updateDefenseObjective(
    state,
    objective,
    deltaMs
  ));
  objectives = refreshObjectiveStatuses(objectives);
  objectives = objectives.map((objective) => updateMiniBossObjective(state, objective));
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
  };

  return {
    ...state,
    campaign: {
      ...campaign,
      currentDistrictId: getCurrentDistrictId(campaign),
      missionStep: getMissionStep(campaign, state.boss),
      structures: getCampaignStructures(objectives),
      message: getCampaignMessage(campaign, state.boss),
    },
  };
}
