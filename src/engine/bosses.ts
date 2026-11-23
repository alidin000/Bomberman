import { BossHazard, GameEngineState, PlayerState } from './types';
import { isBomb, isObstacle } from '../model/gameItem';
import { getBossDefinition } from '../content';
import { applyCharacterSurvival } from './players';
import { getPlayerCell, positionOverlapsCell } from './grid';
import { getMatchDifficulty } from './difficulty';
import { isInVillageSquare, isShelteredInSquare, playersOutsideSquare } from './villageSquare';
import { mintEntityId } from './entityIds';

const BOSS_ATTACK_MS = 3100;
const BOSS_MOVE_MS = 950;
const HAZARD_TOTAL_MS = 2400;
const HAZARD_WARNING_MS = Math.round(HAZARD_TOTAL_MS * 0.7);

// An attack's hazards so far, and the match's id counters after them.
type HazardBatch = { hazards: BossHazard[]; entityIds: GameEngineState['entityIds'] };

function createHazard(
  id: string,
  kind: BossHazard['kind'],
  x: number,
  y: number,
  color: string,
  damage = 1
): BossHazard {
  return {
    id,
    kind,
    x,
    y,
    ticksRemaining: HAZARD_TOTAL_MS,
    warningTicks: HAZARD_WARNING_MS,
    color,
    damage,
  };
}

function clampToArena(state: GameEngineState, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(1, Math.min(state.map[0].length - 2, x)),
    y: Math.max(1, Math.min(state.map.length - 2, y)),
  };
}

function getTargetPlayer(state: GameEngineState): PlayerState | null {
  // A player in the village square cannot be tracked.
  const alivePlayers = playersOutsideSquare(state, state.players).filter((player) => player.alive);
  if (alivePlayers.length === 0) return null;
  return alivePlayers.reduce((nearest, player) => {
    if (!state.boss) return nearest;
    const nearestDistance = Math.abs(nearest.x - state.boss.x) + Math.abs(nearest.y - state.boss.y);
    const playerDistance = Math.abs(player.x - state.boss.x) + Math.abs(player.y - state.boss.y);
    return playerDistance < nearestDistance ? player : nearest;
  }, alivePlayers[0]);
}

function canBossMoveTo(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell);
}

function distanceTo(x: number, y: number, target: PlayerState): number {
  return Math.abs(x - target.x) + Math.abs(y - target.y);
}

function getHazardDeathLabel(kind: BossHazard['kind']): string {
  const labels: Record<BossHazard['kind'], string> = {
    sandTornado: 'Sand Tornado',
    sandSpikes: 'Sand Spikes',
    blueFireTrail: 'Blue Fire Trail',
    waterCannon: 'Water Cannon',
    lavaBurst: 'Lava Burst',
    steamCharge: 'Steam Charge',
    acidBubble: 'Acid Bubble',
    airStrike: 'Air Strike',
    tentacleSlam: 'Tentacle Slam',
    beastBomb: 'Tailed Beast Bomb',
    chakraShockwave: 'Chakra Shockwave',
  };
  return labels[kind];
}

function formatHazardDeathReason(player: PlayerState, hazard: BossHazard): string {
  const label = hazard.sourceAbility || getHazardDeathLabel(hazard.kind);
  if (hazard.sourceName) {
    return `${player.name} was hit by ${hazard.sourceName}'s ${label}.`;
  }
  return `${player.name} was hit by a ${label}.`;
}

function moveBoss(state: GameEngineState, deltaMs: number): GameEngineState {
  if (!state.boss) return state;
  const moveCooldown = state.boss.moveCooldown - deltaMs;
  if (moveCooldown > 0) {
    return {
      ...state,
      boss: { ...state.boss, moveCooldown },
    };
  }

  const target = getTargetPlayer(state);
  if (!target) {
    return {
      ...state,
      boss: { ...state.boss, moveCooldown: BOSS_MOVE_MS },
    };
  }

  const candidates = [
    { x: state.boss.x + 1, y: state.boss.y },
    { x: state.boss.x - 1, y: state.boss.y },
    { x: state.boss.x, y: state.boss.y + 1 },
    { x: state.boss.x, y: state.boss.y - 1 },
  ].filter((point) => canBossMoveTo(state, point.x, point.y));

  if (candidates.length === 0) {
    return {
      ...state,
      boss: { ...state.boss, moveCooldown: BOSS_MOVE_MS },
    };
  }

  const keepRange = ['matatabi', 'isobu', 'saiken'].includes(state.boss.id);
  const sorted = [...candidates].sort((a, b) => (
    keepRange
      ? distanceTo(b.x, b.y, target) - distanceTo(a.x, a.y, target)
      : distanceTo(a.x, a.y, target) - distanceTo(b.x, b.y, target)
  ));
  const nextPoint = sorted[state.tick % Math.min(2, sorted.length)];

  return {
    ...state,
    boss: {
      ...state.boss,
      x: nextPoint.x,
      y: nextPoint.y,
      moveCooldown: Math.max(640, BOSS_MOVE_MS - state.boss.phase * 80),
    },
  };
}

function addHazardAt(
  state: GameEngineState,
  batch: HazardBatch,
  kind: BossHazard['kind'],
  x: number,
  y: number,
  color: string,
  damage?: number
): HazardBatch {
  const point = clampToArena(state, x, y);
  if (!canBossMoveTo(state, point.x, point.y)) return batch;
  if (isInVillageSquare(state, point.x, point.y)) return batch;
  if (batch.hazards.some((hazard) => hazard.x === point.x && hazard.y === point.y)) {
    return batch;
  }
  const [id, entityIds] = mintEntityId(batch.entityIds, 'bossHazard');
  return {
    hazards: [...batch.hazards, createHazard(id, kind, point.x, point.y, color, damage)],
    entityIds,
  };
}

function addLineHazards(
  state: GameEngineState,
  batch: HazardBatch,
  kind: BossHazard['kind'],
  color: string,
  horizontal: boolean
): HazardBatch {
  if (!state.boss) return batch;
  const fixed = horizontal ? state.boss.y : state.boss.x;
  const limit = horizontal ? state.map[0].length - 1 : state.map.length - 1;
  let next = batch;
  for (let index = 1; index < limit; index += 1) {
    next = addHazardAt(
      state,
      next,
      kind,
      horizontal ? index : fixed,
      horizontal ? fixed : index,
      color
    );
  }
  return next;
}

function spawnBossHazards(state: GameEngineState): HazardBatch & { ability: string } {
  const none = { ability: '', hazards: [], entityIds: state.entityIds };
  if (!state.boss) return none;
  const target = getTargetPlayer(state);
  if (!target) return none;

  const bossDefinition = getBossDefinition(state.boss.id);
  const ability = bossDefinition.attacks[state.tick % bossDefinition.attacks.length];
  const { color } = state.boss;
  const targetCell = getPlayerCell(target);
  let batch: HazardBatch = { hazards: [], entityIds: state.entityIds };

  if (state.boss.id === 'shukaku') {
    batch = addHazardAt(state, batch, 'sandTornado', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      batch = addHazardAt(state, batch, 'sandSpikes', targetCell.x + 1, targetCell.y, color);
    }
  } else if (state.boss.id === 'matatabi') {
    batch = addLineHazards(state, batch, 'blueFireTrail', color, state.tick % 2 === 0);
  } else if (state.boss.id === 'isobu') {
    batch = addLineHazards(state, batch, 'waterCannon', color, Math.abs(target.x - state.boss.x) > Math.abs(target.y - state.boss.y));
  } else if (state.boss.id === 'sonGoku') {
    batch = addHazardAt(state, batch, 'lavaBurst', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      batch = addHazardAt(state, batch, 'lavaBurst', targetCell.x + 1, targetCell.y, color);
    }
  } else if (state.boss.id === 'kokuo') {
    batch = addLineHazards(state, batch, 'steamCharge', color, state.tick % 2 === 1);
  } else if (state.boss.id === 'saiken') {
    batch = addHazardAt(state, batch, 'acidBubble', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      batch = addHazardAt(state, batch, 'acidBubble', targetCell.x + 2, targetCell.y, color);
    }
  } else if (state.boss.id === 'chomei') {
    batch = addHazardAt(state, batch, 'airStrike', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      batch = addHazardAt(state, batch, 'airStrike', targetCell.x, targetCell.y - 1, color);
    }
  } else if (state.boss.id === 'gyuki') {
    batch = addHazardAt(state, batch, 'tentacleSlam', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      batch = addHazardAt(state, batch, 'tentacleSlam', targetCell.x + 1, targetCell.y, color);
    }
  } else {
    batch = addHazardAt(state, batch, 'beastBomb', targetCell.x, targetCell.y, color);
    batch = addHazardAt(state, batch, 'chakraShockwave', state.boss.x + 1, state.boss.y, color);
    batch = addHazardAt(state, batch, 'chakraShockwave', state.boss.x - 1, state.boss.y, color);
    batch = addHazardAt(state, batch, 'chakraShockwave', state.boss.x, state.boss.y + 1, color);
    batch = addHazardAt(state, batch, 'chakraShockwave', state.boss.x, state.boss.y - 1, color);
  }

  return {
    ability,
    hazards: batch.hazards.map((hazard) => ({
      ...hazard,
      sourceName: state.boss?.name,
      sourceAbility: ability || getHazardDeathLabel(hazard.kind),
    })),
    entityIds: batch.entityIds,
  };
}

export function hazardIsActive(hazard: BossHazard): boolean {
  const activeWindowMs = hazard.activeMs
    ?? Math.max(300, Math.round(hazard.warningTicks * (3 / 7)));
  return hazard.ticksRemaining <= activeWindowMs;
}

function damagePlayersInHazards(
  players: PlayerState[],
  hazards: BossHazard[],
  timedPowerUps: GameEngineState['timedPowerUps'],
  sheltered: (player: PlayerState) => boolean
): { players: PlayerState[]; hazards: BossHazard[] } {
  if (hazards.length === 0) return { players, hazards };

  const nextPlayers = players.map((player) => {
    if (!player.alive || sheltered(player)) return player;
    const invincible = timedPowerUps[player.id]?.some(
      (tp) => tp.power === 'Invincibility' && tp.ticksRemaining > 0
    ) || player.powerUps.includes('Invincibility');
    if (invincible) return player;

    const touching = hazards.filter((hazard) => (
      hazard.damage > 0
      && hazardIsActive(hazard)
      && positionOverlapsCell(player, hazard.x, hazard.y)
    ));
    const hit = touching[0];
    if (!hit) return player;
    // A spent survival passive's grace (applyCharacterSurvival) covers the
    // rest of this hazard's active window.
    return applyCharacterSurvival(player, formatHazardDeathReason(player, hit), {
      kind: 'hazard',
      sourceName: hit.sourceName,
      sourceAbility: hit.sourceAbility || getHazardDeathLabel(hit.kind),
    });
  });
  return { players: nextPlayers, hazards };
}

function rechargeUltimates(state: GameEngineState, deltaMs: number): GameEngineState {
  const players = state.players.map((player) => {
    if (player.ultimateCooldownRemaining <= 0) {
      return { ...player, ultimateCharge: 100 };
    }
    const remaining = Math.max(0, player.ultimateCooldownRemaining - deltaMs);
    const charge = Math.round(
      ((player.ultimateCooldown - remaining) / player.ultimateCooldown) * 100
    );
    return {
      ...player,
      ultimateCooldownRemaining: remaining,
      ultimateCharge: Math.min(100, Math.max(0, charge)),
    };
  });
  return { ...state, players };
}

export function tickBossEncounter(state: GameEngineState, deltaMs: number): GameEngineState {
  let next = rechargeUltimates(state, deltaMs);
  // An empty list stays the same array, so views memoised on it can skip work.
  const hazards = next.hazards.length === 0
    ? next.hazards
    : next.hazards
      .map((hazard) => ({ ...hazard, ticksRemaining: hazard.ticksRemaining - deltaMs }))
      .filter((hazard) => hazard.ticksRemaining > 0);
  const damaged = damagePlayersInHazards(
    next.players,
    hazards,
    next.timedPowerUps,
    (player) => isShelteredInSquare(next, player)
  );
  next = {
    ...next,
    hazards: damaged.hazards,
    players: damaged.players,
  };
  if (next.config.mode !== 'solo' || !next.boss || next.boss.health <= 0) {
    return next;
  }

  next = moveBoss(next, deltaMs);
  if (!next.boss) return next;

  let attackCooldown = next.boss.attackCooldown - deltaMs;
  let ability = next.boss.currentAbility;
  let spawnedHazards: BossHazard[] = [];
  let { entityIds } = next;
  if (attackCooldown <= 0) {
    const spawned = spawnBossHazards(next);
    ability = spawned.ability;
    spawnedHazards = spawned.hazards;
    entityIds = spawned.entityIds;
    attackCooldown = Math.round(
      (BOSS_ATTACK_MS - Math.min(700, next.boss.phase * 180))
        * getMatchDifficulty(next.config).bossAttackScale
    );
  }

  const allHazards = spawnedHazards.length > 0
    ? [...next.hazards, ...spawnedHazards]
    : next.hazards;
  return {
    ...next,
    boss: {
      ...next.boss,
      attackCooldown,
      currentAbility: ability,
    },
    hazards: allHazards,
    players: next.players,
    entityIds,
  };
}
