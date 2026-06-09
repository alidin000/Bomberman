import { BossHazard, GameEngineState, PlayerState } from './types';
import { isBomb, isObstacle } from '../model/gameItem';
import { getBossDefinition } from '../content';
import { applyCharacterSurvival } from './players';
import { getPlayerCell, positionOverlapsCell } from './grid';

const BOSS_ATTACK_MS = 3100;
const BOSS_MOVE_MS = 950;
const HAZARD_WARNING_MS = 1500;
const HAZARD_TOTAL_MS = 2400;

let hazardIdCounter = 0;

function createHazard(
  kind: BossHazard['kind'],
  x: number,
  y: number,
  color: string,
  damage = 1
): BossHazard {
  hazardIdCounter += 1;
  return {
    id: `hazard-${hazardIdCounter}`,
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
  const alivePlayers = state.players.filter((player) => player.alive);
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
  hazards: BossHazard[],
  kind: BossHazard['kind'],
  x: number,
  y: number,
  color: string,
  damage?: number
): BossHazard[] {
  const point = clampToArena(state, x, y);
  if (!canBossMoveTo(state, point.x, point.y)) return hazards;
  if (hazards.some((hazard) => hazard.x === point.x && hazard.y === point.y)) {
    return hazards;
  }
  return [...hazards, createHazard(kind, point.x, point.y, color, damage)];
}

function addLineHazards(
  state: GameEngineState,
  kind: BossHazard['kind'],
  color: string,
  horizontal: boolean
): BossHazard[] {
  if (!state.boss) return [];
  const hazards: BossHazard[] = [];
  const fixed = horizontal ? state.boss.y : state.boss.x;
  const limit = horizontal ? state.map[0].length - 1 : state.map.length - 1;
  let nextHazards = hazards;
  for (let index = 1; index < limit; index += 1) {
    nextHazards = addHazardAt(
      state,
      nextHazards,
      kind,
      horizontal ? index : fixed,
      horizontal ? fixed : index,
      color
    );
  }
  return nextHazards;
}

function spawnBossHazards(state: GameEngineState): {
  ability: string;
  hazards: BossHazard[];
} {
  if (!state.boss) return { ability: '', hazards: [] };
  const target = getTargetPlayer(state);
  if (!target) return { ability: '', hazards: [] };

  const bossDefinition = getBossDefinition(state.boss.id);
  const ability = bossDefinition.attacks[state.tick % bossDefinition.attacks.length];
  const { color } = state.boss;
  const targetCell = getPlayerCell(target);
  let hazards: BossHazard[] = [];

  if (state.boss.id === 'shukaku') {
    hazards = addHazardAt(state, hazards, 'sandTornado', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      hazards = addHazardAt(state, hazards, 'sandSpikes', targetCell.x + 1, targetCell.y, color);
    }
  } else if (state.boss.id === 'matatabi') {
    hazards = addLineHazards(state, 'blueFireTrail', color, state.tick % 2 === 0);
  } else if (state.boss.id === 'isobu') {
    hazards = addLineHazards(state, 'waterCannon', color, Math.abs(target.x - state.boss.x) > Math.abs(target.y - state.boss.y));
  } else if (state.boss.id === 'sonGoku') {
    hazards = addHazardAt(state, hazards, 'lavaBurst', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      hazards = addHazardAt(state, hazards, 'lavaBurst', targetCell.x + 1, targetCell.y, color);
    }
  } else if (state.boss.id === 'kokuo') {
    hazards = addLineHazards(state, 'steamCharge', color, state.tick % 2 === 1);
  } else if (state.boss.id === 'saiken') {
    hazards = addHazardAt(state, hazards, 'acidBubble', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      hazards = addHazardAt(state, hazards, 'acidBubble', targetCell.x + 2, targetCell.y, color);
    }
  } else if (state.boss.id === 'chomei') {
    hazards = addHazardAt(state, hazards, 'airStrike', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      hazards = addHazardAt(state, hazards, 'airStrike', targetCell.x, targetCell.y - 1, color);
    }
  } else if (state.boss.id === 'gyuki') {
    hazards = addHazardAt(state, hazards, 'tentacleSlam', targetCell.x, targetCell.y, color);
    if (state.boss.phase > 1) {
      hazards = addHazardAt(state, hazards, 'tentacleSlam', targetCell.x + 1, targetCell.y, color);
    }
  } else {
    hazards = addHazardAt(state, hazards, 'beastBomb', targetCell.x, targetCell.y, color);
    hazards = addHazardAt(state, hazards, 'chakraShockwave', state.boss.x + 1, state.boss.y, color);
    hazards = addHazardAt(state, hazards, 'chakraShockwave', state.boss.x - 1, state.boss.y, color);
    hazards = addHazardAt(state, hazards, 'chakraShockwave', state.boss.x, state.boss.y + 1, color);
    hazards = addHazardAt(state, hazards, 'chakraShockwave', state.boss.x, state.boss.y - 1, color);
  }

  return {
    ability,
    hazards: hazards.map((hazard) => ({
      ...hazard,
      sourceName: state.boss?.name,
      sourceAbility: ability || getHazardDeathLabel(hazard.kind),
    })),
  };
}

function hazardIsActive(hazard: BossHazard): boolean {
  return hazard.ticksRemaining <= hazard.warningTicks * 0.45;
}

function damagePlayersInHazards(
  players: PlayerState[],
  hazards: BossHazard[],
  timedPowerUps: GameEngineState['timedPowerUps']
): PlayerState[] {
  return players.map((player) => {
    if (!player.alive) return player;
    const invincible = timedPowerUps[player.id]?.some(
      (tp) => tp.power === 'Invincibility' && tp.ticksRemaining > 0
    ) || player.powerUps.includes('Invincibility');
    if (invincible) return player;

    const hit = hazards.find((hazard) => (
      hazard.damage > 0
      && hazardIsActive(hazard)
      && positionOverlapsCell(player, hazard.x, hazard.y)
    ));
    return hit
      ? applyCharacterSurvival(player, formatHazardDeathReason(player, hit))
      : player;
  });
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
  if (next.config.mode !== 'solo' || !next.boss || next.boss.health <= 0) {
    return {
      ...next,
      hazards: next.hazards
        .map((hazard) => ({ ...hazard, ticksRemaining: hazard.ticksRemaining - deltaMs }))
        .filter((hazard) => hazard.ticksRemaining > 0),
    };
  }

  next = moveBoss(next, deltaMs);
  if (!next.boss) return next;

  const hazards = next.hazards
    .map((hazard) => ({ ...hazard, ticksRemaining: hazard.ticksRemaining - deltaMs }))
    .filter((hazard) => hazard.ticksRemaining > 0);

  let attackCooldown = next.boss.attackCooldown - deltaMs;
  let ability = next.boss.currentAbility;
  let spawnedHazards: BossHazard[] = [];
  if (attackCooldown <= 0) {
    const spawned = spawnBossHazards(next);
    ability = spawned.ability;
    spawnedHazards = spawned.hazards;
    attackCooldown = BOSS_ATTACK_MS - Math.min(700, next.boss.phase * 180);
  }

  const allHazards = [...hazards, ...spawnedHazards];
  return {
    ...next,
    boss: {
      ...next.boss,
      attackCooldown,
      currentAbility: ability,
    },
    hazards: allHazards,
    players: damagePlayersInHazards(next.players, allHazards, next.timedPowerUps),
  };
}
