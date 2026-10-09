/* eslint-disable no-bitwise */
import {
  CampaignWaveGroupDefinition,
  CampaignWaveScriptDefinition,
  DifficultyTuple,
  getCampaignWaveScript,
} from '../content/campaignWaves';
import { CampaignEventDefinition } from '../content/campaignEvents';
import { createShinobiEnemy } from './campaignEnemies';
import { DifficultyId, getDifficulty } from './difficulty';
import { nextRandom, normalizeSeed } from './random';
import { positionsTouch } from './grid';
import {
  CampaignObjectiveState,
  CampaignRuntimeState,
  CampaignWavePlan,
  CampaignWaveRuntimeState,
  CampaignWaveUnitPlan,
  GameEngineState,
  MonsterState,
  Point,
} from './types';

/*
 * Scripted defense waves. A village's defense objective holds for a seal
 * timer; its wave script (content/campaignWaves.ts) decides who attacks and
 * when, on that timer's clock:
 *
 *   breather -> marks up (telegraph) -> wave arrives -> breather -> ...
 *   ... -> last wave -> final hold -> seal complete
 *
 * - A wave arrives only when the wave enemies still alive plus its own
 *   units fit under `maxActive`; until then it is held (its marks stay up).
 *   Later waves keep their breather from the moment the held one arrives
 *   (rounded up to the second), and a wave still due when the seal
 *   completes never comes.
 * - Wave enemies are ordinary shinobi enemies with the structure as their
 *   leash: with no player in sight they march on the seal; once they detect
 *   a player they chase as usual (finite awareness is untouched). One that
 *   reaches the seal breaches it: the hit lands and the enemy is gone.
 * - A fallen seal that restarts (a life spent) withdraws the attackers and
 *   restarts the script. When the seal completes, survivors are released
 *   to patrol the village.
 * - Entries are drawn from the match seed when the match starts, so the
 *   same seed always plays the same waves. Nothing else here is random.
 */

const DIFFICULTY_INDEX: Record<DifficultyId, 0 | 1 | 2> = { story: 0, normal: 1, hard: 2 };
// The defense objective's own contact distance for structure damage.
const SEAL_TOUCH_DISTANCE = 0.68;
// Units never appear on, or right beside, a player.
const SPAWN_PLAYER_CLEARANCE = 1.5;
const SPAWN_OFFSETS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

function pick<T>(tuple: DifficultyTuple<T>, difficulty: DifficultyId): T {
  return tuple[DIFFICULTY_INDEX[difficulty]];
}

// The wave script's own stream: the match seed mixed with the script id, so
// drawing entries never shifts the engine's other seeded draws.
function scriptSeed(seed: number | undefined, scriptId: string): number {
  let hash = normalizeSeed(seed) ^ 0x2f6b9d1;
  for (let index = 0; index < scriptId.length; index += 1) {
    hash = Math.imul(hash ^ scriptId.charCodeAt(index), 16777619) >>> 0;
  }
  return hash >>> 0;
}

function defenseObjectiveId(objectives: { id: string; kind: string }[]): string | null {
  return objectives.find((objective) => objective.kind === 'defense')?.id ?? null;
}

/**
 * The waves of `script` as this match plays them: unit counts and captains
 * for the difficulty, the active village event's changes, and one entry per
 * group drawn from the seed. Waves with no units on this difficulty drop out.
 */
export function resolveWavePlans(
  script: CampaignWaveScriptDefinition,
  difficulty: DifficultyId,
  event: Pick<CampaignEventDefinition, 'id'> | null,
  seed: number | undefined
): CampaignWavePlan[] {
  const effect = script.eventEffects?.find((item) => item.event === event?.id);
  let rng = scriptSeed(seed, script.id);
  const draw = (entries: readonly string[]): string => {
    const next = nextRandom(rng);
    rng = next.seed;
    return entries[Math.floor(next.value * entries.length) % entries.length];
  };
  return script.waves.flatMap((wave, index): CampaignWavePlan[] => {
    const groups: CampaignWaveGroupDefinition[] = [
      ...wave.groups,
      ...(effect?.extra ?? []).filter((item) => item.wave === index).map((item) => item.group),
    ];
    const units: CampaignWaveUnitPlan[] = [];
    groups.forEach((group) => {
      const entryId = draw(group.entries);
      for (let count = pick(group.count, difficulty); count > 0; count -= 1) {
        units.push({ archetype: group.archetype, entryId });
      }
    });
    const { elite } = wave;
    if (elite) {
      const entryId = draw(elite.entries);
      if (pick(elite.on ?? [false, true, true], difficulty)) {
        units.push({ archetype: elite.archetype, entryId, eliteLabel: elite.label });
      }
    }
    if (units.length === 0) return [];
    const entryIds = units.reduce<string[]>((ids, unit) => (
      ids.includes(unit.entryId) ? ids : [...ids, unit.entryId]
    ), []);
    return [{
      id: wave.id,
      label: wave.label,
      breatherMs: pick(wave.breatherMs, difficulty),
      units,
      entryIds,
    }];
  });
}

/** The waves for this match's defense objective, or null without a script. */
export function createCampaignWaveState(
  stageId: CampaignRuntimeState['stageId'],
  objectives: { id: string; kind: string }[],
  difficulty: DifficultyId,
  event: Pick<CampaignEventDefinition, 'id'> | null,
  seed: number | undefined
): CampaignWaveRuntimeState | null {
  const script = getCampaignWaveScript(stageId);
  const objectiveId = defenseObjectiveId(objectives);
  if (!script || !objectiveId) return null;
  const waves = resolveWavePlans(script, difficulty, event, seed);
  if (waves.length === 0) return null;
  const effect = script.eventEffects?.find((item) => item.event === event?.id);
  // The note only when the event changes something on this difficulty.
  const effective = !!effect && ((effect.telegraphBonusMs ?? 0) > 0
    || (effect.extra ?? []).some((item) => pick(item.group.count, difficulty) > 0));
  return {
    scriptId: script.id,
    objectiveId,
    entries: script.entries.map((entry) => ({ ...entry })),
    waves,
    telegraphMs: pick(script.telegraphMs, difficulty) + (effect?.telegraphBonusMs ?? 0),
    maxActive: pick(script.maxActive, difficulty),
    leashRadius: script.leashRadius,
    eventNote: effective ? effect?.note : undefined,
    opened: 0,
    dueAtMs: waves[0].breatherMs,
    telegraphing: false,
    held: false,
    activeMonsterIds: [],
    run: 0,
    finished: false,
  };
}

/**
 * The defense objective timed for its waves: the seal holds through every
 * breather plus the final hold, and the structure gets the script's health.
 */
export function scheduleWaveDefense(
  objectives: CampaignObjectiveState[],
  waves: CampaignWaveRuntimeState | null,
  stageId: CampaignRuntimeState['stageId'],
  difficulty: DifficultyId
): CampaignObjectiveState[] {
  const script = getCampaignWaveScript(stageId);
  if (!waves || !script) return objectives;
  const durationMs = waves.waves.reduce((sum, wave) => sum + wave.breatherMs, 0)
    + pick(script.finalHoldMs, difficulty);
  const structureHp = pick(script.structureHp, difficulty);
  return objectives.map((objective) => (
    objective.id === waves.objectiveId
      ? {
        ...objective,
        durationMs,
        ticksRemaining: durationMs,
        target: durationMs,
        structureHp,
        structureMaxHp: structureHp,
      }
      : objective
  ));
}

function findObjective(
  objectives: CampaignObjectiveState[] | undefined,
  id: string
): CampaignObjectiveState | undefined {
  if (!objectives) return undefined;
  for (let index = 0; index < objectives.length; index += 1) {
    if (objectives[index].id === id) return objectives[index];
  }
  return undefined;
}

/** Ms of the defense clock so far (0 before the defense starts). */
export function waveClockMs(objective: CampaignObjectiveState): number {
  const durationMs = objective.durationMs ?? objective.target;
  return Math.max(0, durationMs - (objective.ticksRemaining ?? durationMs));
}

// Open floor only: not a crate, bomb, cover, pickup, enemy or player.
function canSpawnAt(
  state: Pick<GameEngineState, 'map' | 'players'>,
  monsters: MonsterState[],
  x: number,
  y: number
) {
  return state.map[y]?.[x] === 'Empty'
    && !monsters.some((monster) => monster.x === x && monster.y === y)
    && !state.players.some((player) => (
      player.alive
      && Math.abs(player.x - x) < SPAWN_PLAYER_CLEARANCE
      && Math.abs(player.y - y) < SPAWN_PLAYER_CLEARANCE
    ));
}

// The unit's own entry first, then the script's other entries: a player
// standing on one entry pushes its units to the next instead of blocking.
function findSpawnCell(
  state: Pick<GameEngineState, 'map' | 'players'>,
  monsters: MonsterState[],
  waves: CampaignWaveRuntimeState,
  entryId: string,
  serial: number
): Point | null {
  const own = waves.entries.find((entry) => entry.id === entryId);
  const ordered = own ? [own, ...waves.entries.filter((entry) => entry !== own)] : waves.entries;
  for (let e = 0; e < ordered.length; e += 1) {
    const entry = ordered[e];
    for (let o = 0; o < SPAWN_OFFSETS.length; o += 1) {
      const offset = SPAWN_OFFSETS[(o + serial) % SPAWN_OFFSETS.length];
      const x = entry.x + offset.x;
      const y = entry.y + offset.y;
      if (canSpawnAt(state, monsters, x, y)) return { x, y };
    }
  }
  return null;
}

function spawnWave(
  state: GameEngineState,
  monsters: MonsterState[],
  waves: CampaignWaveRuntimeState,
  index: number,
  anchor: Point
): { monsters: MonsterState[]; ids: string[] } {
  const difficulty = getDifficulty(state.campaign?.difficulty);
  let placed = monsters;
  const ids: string[] = [];
  waves.waves[index].units.forEach((unit, serial) => {
    const cell = findSpawnCell(state, placed, waves, unit.entryId, serial);
    if (!cell) return;
    const id = `${waves.scriptId}-r${waves.run}-w${index + 1}-${serial}`;
    const enemy = createShinobiEnemy({
      archetype: unit.archetype,
      x: cell.x,
      y: cell.y,
      id,
      difficulty,
    });
    placed = [...placed, {
      ...enemy,
      ...(unit.eliteLabel
        ? {
          name: unit.eliteLabel,
          elite: true,
          detectionRange: (enemy.detectionRange ?? 6) + 1,
        }
        : {}),
      leash: { x: anchor.x, y: anchor.y, radius: waves.leashRadius },
    }];
    ids.push(id);
  });
  return { monsters: placed, ids };
}

function aliveIds(ids: string[], monsters: MonsterState[]): string[] {
  let alive = 0;
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (monsters.some((monster) => monster.id === id)) alive += 1;
  }
  return alive === ids.length
    ? ids
    : ids.filter((id) => monsters.some((monster) => monster.id === id));
}

function sameWaves(a: CampaignWaveRuntimeState, b: CampaignWaveRuntimeState): boolean {
  return a.opened === b.opened
    && a.dueAtMs === b.dueAtMs
    && a.telegraphing === b.telegraphing
    && a.held === b.held
    && a.activeMonsterIds === b.activeMonsterIds
    && a.run === b.run
    && a.finished === b.finished;
}

function withWaves(
  state: GameEngineState,
  waves: CampaignWaveRuntimeState,
  monsters: MonsterState[]
): GameEngineState {
  const current = state.campaign?.waves;
  if (!state.campaign || !current) return state;
  if (sameWaves(current, waves) && monsters === state.monsters) return state;
  return {
    ...state,
    monsters,
    campaign: { ...state.campaign, waves: sameWaves(current, waves) ? current : waves },
  };
}

/**
 * Runs the wave script after the objectives stepped from `previous` to
 * `next`: restarts it after a fallen seal, releases the survivors when the
 * defense ends, and marks, holds or sends the next wave on the defense clock.
 * Returns `next` itself when nothing changed.
 */
export function advanceCampaignWaves(
  previous: GameEngineState,
  next: GameEngineState,
  deltaMs: number
): GameEngineState {
  const current = next.campaign?.waves;
  if (!current || current.finished || deltaMs <= 0) return next;
  const objective = findObjective(next.campaign?.objectives, current.objectiveId);
  if (!objective) return next;
  let waves = current;
  let { monsters } = next;

  const before = findObjective(previous.campaign?.objectives, current.objectiveId);
  const restarted = objective.status === 'active'
    && before?.status === 'active'
    && (objective.ticksRemaining ?? 0) > (before.ticksRemaining ?? 0);
  if (restarted) {
    // The seal restarts at full strength: the attackers withdraw with it.
    const leaving = new Set(waves.activeMonsterIds);
    monsters = monsters.filter((monster) => !leaving.has(monster.id));
    waves = {
      ...waves,
      opened: 0,
      dueAtMs: waves.waves[0].breatherMs,
      telegraphing: false,
      held: false,
      activeMonsterIds: [],
      run: waves.run + 1,
    };
  }

  if (objective.status === 'complete' || objective.status === 'failed') {
    const released = new Set(waves.activeMonsterIds);
    monsters = monsters.map((monster) => (
      released.has(monster.id) ? { ...monster, leash: undefined } : monster
    ));
    return withWaves(next, {
      ...waves,
      telegraphing: false,
      held: false,
      activeMonsterIds: [],
      finished: true,
    }, monsters);
  }
  if (objective.status !== 'active' || typeof objective.x !== 'number' || typeof objective.y !== 'number') {
    return withWaves(next, waves, monsters);
  }

  // A wave enemy that hits the seal breaches it and is gone: each one that
  // gets through costs the structure one hit, never a stream of them.
  if (!restarted && (objective.structureHp ?? 0) < (before?.structureHp ?? 0)) {
    const seal = { x: objective.x, y: objective.y };
    const breacher = monsters.find((monster) => (
      waves.activeMonsterIds.includes(monster.id)
      && positionsTouch(monster, seal, SEAL_TOUCH_DISTANCE)
    ));
    if (breacher) monsters = monsters.filter((monster) => monster !== breacher);
  }

  const activeMonsterIds = aliveIds(waves.activeMonsterIds, monsters);
  if (activeMonsterIds !== waves.activeMonsterIds) waves = { ...waves, activeMonsterIds };

  const elapsed = waveClockMs(objective);
  const sealMs = objective.durationMs ?? objective.target;
  const wave = waves.waves[waves.opened];
  if (!wave || waves.dueAtMs >= sealMs) {
    // Every wave is in (or the seal completes before the next): just hold.
    if (waves.telegraphing || waves.held) waves = { ...waves, telegraphing: false, held: false };
    return withWaves(next, waves, monsters);
  }

  const telegraphing = elapsed >= waves.dueAtMs - waves.telegraphMs;
  if (elapsed < waves.dueAtMs) {
    if (telegraphing !== waves.telegraphing) waves = { ...waves, telegraphing };
    return withWaves(next, waves, monsters);
  }
  // A wave bigger than the cap itself still comes once the field is clear.
  if (
    waves.activeMonsterIds.length > 0
    && waves.activeMonsterIds.length + wave.units.length > waves.maxActive
  ) {
    if (!waves.held || !waves.telegraphing) waves = { ...waves, telegraphing: true, held: true };
    return withWaves(next, waves, monsters);
  }

  const spawned = spawnWave(
    { ...next, monsters },
    monsters,
    waves,
    waves.opened,
    { x: objective.x, y: objective.y }
  );
  const following = waves.waves[waves.opened + 1];
  waves = {
    ...waves,
    opened: waves.opened + 1,
    // On the defense clock's whole seconds, so the wave countdown ticks with
    // the hold timer the HUD already redraws on (useRenderState).
    dueAtMs: following ? Math.ceil(elapsed / 1000) * 1000 + following.breatherMs : sealMs,
    telegraphing: false,
    held: false,
    activeMonsterIds: [...waves.activeMonsterIds, ...spawned.ids],
  };
  return withWaves(next, waves, spawned.monsters);
}

export type WaveClock = {
  // 1-based number of the wave the clock counts to, or of the last wave.
  wave: number;
  total: number;
  // The next wave's countdown, or the seal's once every wave is in.
  phase: 'incoming' | 'held' | 'final';
  remainingMs: number;
  // Entry labels of the next wave while its marks are up.
  entries: string[];
};

/** What the HUD shows for the waves, or null outside an active defense. */
export function getWaveClock(campaign: CampaignRuntimeState | null | undefined): WaveClock | null {
  const waves = campaign?.waves;
  if (!campaign || !waves || waves.finished) return null;
  const objective = findObjective(campaign.objectives, waves.objectiveId);
  if (!objective || objective.status !== 'active') return null;
  const total = waves.waves.length;
  const sealMs = objective.durationMs ?? objective.target;
  const elapsed = waveClockMs(objective);
  const next = waves.waves[waves.opened];
  if (!next || waves.dueAtMs >= sealMs) {
    return {
      wave: Math.max(1, waves.opened),
      total,
      phase: 'final',
      remainingMs: Math.max(0, sealMs - elapsed),
      entries: [],
    };
  }
  const entries = waves.telegraphing
    ? next.entryIds.map((id) => waves.entries.find((entry) => entry.id === id)?.label ?? id)
    : [];
  return {
    wave: waves.opened + 1,
    total,
    phase: waves.held ? 'held' : 'incoming',
    remainingMs: Math.max(0, waves.dueAtMs - elapsed),
    entries,
  };
}

/** Cells to mark for the next wave while it is telegraphed (scene). */
export function getWaveTelegraphCells(
  waves: CampaignWaveRuntimeState | null | undefined
): { x: number; y: number }[] {
  if (!waves || waves.finished || !waves.telegraphing) return [];
  const next = waves.waves[waves.opened];
  if (!next) return [];
  return next.entryIds.flatMap((id) => {
    const entry = waves.entries.find((item) => item.id === id);
    return entry ? [{ x: entry.x, y: entry.y }] : [];
  });
}

/**
 * Ms until the telegraphed wave arrives, read from a live state each frame
 * (no allocation): 0 while it is held, null when no wave is marked.
 */
export function waveTelegraphRemainingMs(state: GameEngineState | null): number | null {
  const waves = state?.campaign?.waves;
  if (!state?.campaign || !waves || !waves.telegraphing || waves.finished) return null;
  if (waves.held) return 0;
  const objective = findObjective(state.campaign.objectives, waves.objectiveId);
  if (!objective) return null;
  return Math.max(0, waves.dueAtMs - waveClockMs(objective));
}
