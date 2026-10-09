/* eslint-disable no-restricted-syntax, guard-for-in --
 * for...in walks plain engine records without allocating key arrays. */
import { useRef } from 'react';
import {
  BombState,
  BossHazard,
  BossState,
  CampaignObjectiveState,
  CampaignRespawnPointState,
  CampaignRuntimeState,
  DestroyedBox,
  ExplosionCell,
  FogOfWarState,
  GameEngineState,
  MonsterState,
  PlayerState,
  PowerUpMessage,
  TimedPowerUp,
} from '../engine';
import {
  PRESSURE_BLOCK_INTERVAL_MS,
  getRoundTimeRemainingMs,
  isSuddenDeathMode,
} from '../engine/suddenDeath';
import { MotionStore, playerMotionId } from './motionStore';
import type { EngineSelector } from './engineStore';

// Fields a MOVE step changes that the scene draws from the motion store.
const PLAYER_MOTION_KEYS: ReadonlySet<string> = new Set(['x', 'y', 'facing']);

function playerDiffersOnlyInMotion(previous: PlayerState, next: PlayerState): boolean {
  if (previous === next) return true;
  const keys = Object.keys(next) as (keyof PlayerState)[];
  return keys.length === Object.keys(previous).length
    && keys.every((key) => PLAYER_MOTION_KEYS.has(key) || previous[key] === next[key]);
}

/**
 * True when `next` differs from `previous` only in player x/y/facing: a held
 * movement step between engine ticks. Everything else must be the same
 * reference, so any real change (pickup, fog reveal, bomb, tick) is false.
 */
export function differsOnlyInPlayerMotion(
  previous: GameEngineState | null,
  next: GameEngineState | null
): boolean {
  if (!previous || !next || previous === next) return false;
  const keys = Object.keys(next) as (keyof GameEngineState)[];
  if (keys.length !== Object.keys(previous).length) return false;
  if (!keys.every((key) => key === 'players' || previous[key] === next[key])) return false;
  return previous.players.length === next.players.length
    && next.players.every((player, index) => (
      playerDiffersOnlyInMotion(previous.players[index], player)
    ));
}

/**
 * The engine publishes every frame that changed anything, which while players
 * hold a direction is every frame. The 3D scene samples player positions from
 * the motion store each frame, so the HUD and scene only need a new state when
 * something else changed. This returns the last state worth rendering: the
 * same object across movement-only frames, so memoised children skip them.
 * Player x/y in it can trail the simulation by at most one tick (50 ms).
 */
export function useRenderState(state: GameEngineState | null): GameEngineState | null {
  const renderedRef = useRef(state);
  if (state !== renderedRef.current && !differsOnlyInPlayerMotion(renderedRef.current, state)) {
    renderedRef.current = state;
  }
  return renderedRef.current;
}

// ---------------------------------------------------------------------------
// Structural sharing for the scene and the HUD.
//
// Every 50 ms tick builds a new state: the tick counter, the round clock,
// every bomb fuse, monster cooldown and ultimate recharge change, so the
// state, its players and most of its lists are new objects 20 times a second.
// A `Share` rule says which of those changes a view draws. It returns
// `previous` itself when `next` differs only in fields the view ignores, so a
// memoised view skips the whole subtree; otherwise it returns a value equal to
// `next` whose unchanged parts (modulo ignored fields) keep their previous
// identity, so only the components drawing the changed part re-render.
//
// The price: an ignored field in a shared object can be stale. Views read
// those fields live (the scene's bomb clock, `liveState` in GameScene3D), or
// not at all. Anything a view draws during render must not be ignored here.
// ---------------------------------------------------------------------------

type Share<T> = (previous: T, next: T) => T;
/** A field whose new value is carried along, but which only forces a new state when `matters`. */
type Silent<T> = { matters: (previous: T, next: T) => boolean };
type Rule<T> = Share<T> | Silent<T>;
type Rules<T> = { [K in keyof T]?: Rule<T[K]> };

/** Never a reason to re-render: a clock no view reads during render. */
const IGNORE: Silent<unknown> = { matters: () => false };

function isShare<T>(rule: Rule<T>): rule is Share<T> {
  return typeof rule === 'function';
}

function hasRemovedKey(previous: object, next: object): boolean {
  for (const key in previous) {
    if (!(key in next)) return true;
  }
  return false;
}

/** Shares a plain record field by field; fields without a rule compare by identity. */
function record<T extends object>(
  rules: Rules<T>,
  // Extra reasons to re-render that depend on several fields at once.
  derivedChange?: (previous: T, next: T) => boolean
): Share<T> {
  return (previous, next) => {
    if (previous === next || !previous || !next) return next;
    let changed = false;
    for (const key in next) {
      const before = previous[key];
      const after = next[key];
      if (before !== after) {
        const rule = rules[key];
        if (!rule || !(key in previous)) changed = true;
        else if (isShare(rule)) changed = rule(before, after) !== before;
        else changed = rule.matters(before, after);
        if (changed) break;
      }
    }
    if (!changed) changed = hasRemovedKey(previous, next);
    if (!changed && derivedChange) changed = derivedChange(previous, next);
    if (!changed) return previous;
    // Rebuild: current values everywhere, previous identities for unchanged parts.
    const out = {} as T;
    for (const key in next) {
      const rule = rules[key];
      const before = previous[key];
      const after = next[key];
      out[key] = rule && isShare(rule) && before !== after && key in previous
        ? rule(before, after)
        : after;
    }
    return out;
  };
}

/** Shares a list element by element (by index; ids and cells are compared fields). */
function list<T>(item: Share<T>): Share<T[]> {
  return (previous, next) => {
    if (previous === next || !previous || !next) return next;
    if (previous.length === next.length) {
      let same = true;
      for (let index = 0; index < next.length && same; index += 1) {
        same = item(previous[index], next[index]) === previous[index];
      }
      if (same) return previous;
    }
    return next.map((entry, index) => (
      index < previous.length ? item(previous[index], entry) : entry
    ));
  };
}

/** Shares a record keyed by id (timed power-ups per player). */
function dict<T>(entry: Share<T>): Share<Record<string, T>> {
  return (previous, next) => {
    if (previous === next || !previous || !next) return next;
    let changed = false;
    for (const key in next) {
      if (!(key in previous) || entry(previous[key], next[key]) !== previous[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) changed = hasRemovedKey(previous, next);
    if (!changed) return previous;
    const out: Record<string, T> = {};
    for (const key in next) {
      out[key] = key in previous ? entry(previous[key], next[key]) : next[key];
    }
    return out;
  };
}

/** Lists of strings or numbers that the engine rebuilds with the same content. */
function sameValues<T>(previous: T[], next: T[]): T[] {
  if (previous === next || !previous || !next) return next;
  if (previous.length !== next.length) return next;
  for (let index = 0; index < next.length; index += 1) {
    if (previous[index] !== next[index]) return next;
  }
  return previous;
}

function nullable<T>(share: Share<T>): Share<T | null> {
  return (previous, next) => (previous && next ? share(previous, next) : next);
}

const ultimateReady = (charge: number) => charge >= 100;

const timedPowerUp = record<TimedPowerUp>({ ticksRemaining: IGNORE, flashTicksRemaining: IGNORE });
const pickupMessage = record<PowerUpMessage>({ ticksRemaining: IGNORE });
const spawnPoint = record<CampaignRespawnPointState>({
  ticksRemaining: IGNORE,
  activeMonsterIds: sameValues,
});
const fogOfWar = record<FogOfWarState>({
  visible: sameValues,
  explored: sameValues,
  sensedEnemies: sameValues,
  sensedWalls: sameValues,
});

// --- Scene ---------------------------------------------------------------

// A player the motion store tracks is drawn from its track, so its x/y only
// trail it. Without a track (a new match or round clears them) the scene draws
// x/y directly, so they must stay current.
const scenePlayerRules: Rules<PlayerState> = {
  ultimateCooldownRemaining: IGNORE,
  survivalGraceMs: IGNORE,
  // The scene shows only "ultimate ready"; the HUD shows the percentage.
  ultimateCharge: { matters: (a, b) => ultimateReady(a) !== ultimateReady(b) },
};
const trackedScenePlayer = record<PlayerState>({ ...scenePlayerRules, x: IGNORE, y: IGNORE });
const untrackedScenePlayer = record<PlayerState>(scenePlayerRules);

const sceneMonster = record<MonsterState>({
  moveCooldown: IGNORE,
  abilityCooldown: IGNORE,
  lifetimeMs: IGNORE,
});
// Fuses are drawn from the live state every frame (GameScene3D's bomb clock).
const sceneBomb = record<BombState>({ ticksRemaining: IGNORE });
const sceneDestroyedBox = record<DestroyedBox>({ ticksRemaining: IGNORE });
const sceneObjective = record<CampaignObjectiveState>({
  ticksRemaining: IGNORE,
  structureDamageCooldownMs: IGNORE,
});
// The boss's cooldowns tick every 50 ms; the scene draws its place, health
// and phase.
const sceneBoss = nullable(record<BossState>({
  attackCooldown: IGNORE,
  moveCooldown: IGNORE,
}));
// The boss intro's clock runs on the live state; the scene only needs to
// know when it starts and ends (the boss shows through fog meanwhile).
const introRunning = (ms: number | undefined) => (ms ?? 0) > 0;
const sceneCampaign = nullable(record<CampaignRuntimeState>({
  spawnPoints: list(spawnPoint),
  objectives: list(sceneObjective),
}));

// Sudden death's next pressure blocks are shown once the clock is this low.
function pressureWarningOpen(state: GameEngineState): boolean {
  return isSuddenDeathMode(state)
    && getRoundTimeRemainingMs(state) <= PRESSURE_BLOCK_INTERVAL_MS;
}

function createSceneShare(motion: MotionStore | null | undefined): Share<GameEngineState> {
  const scenePlayer: Share<PlayerState> = (previous, next) => (
    motion?.tracks.has(playerMotionId(next.id))
      ? trackedScenePlayer(previous, next)
      : untrackedScenePlayer(previous, next)
  );
  return record<GameEngineState>({
    tick: IGNORE,
    rngSeed: IGNORE,
    roundStartTicksRemaining: IGNORE,
    roundElapsedMs: IGNORE,
    bossIntroMsRemaining: { matters: (a, b) => introRunning(a) !== introRunning(b) },
    boss: sceneBoss,
    players: list(scenePlayer),
    monsters: list(sceneMonster),
    bombs: list(sceneBomb),
    destroyedBoxes: list(sceneDestroyedBox),
    timedPowerUps: dict(list(timedPowerUp)),
    pickupMessages: list(pickupMessage),
    campaign: sceneCampaign,
    fogOfWar,
  }, (previous, next) => pressureWarningOpen(previous) !== pressureWarningOpen(next));
}

// --- HUD -----------------------------------------------------------------

const hudPlayer = record<PlayerState>({
  x: IGNORE,
  y: IGNORE,
  facing: IGNORE,
  ultimateCooldownRemaining: IGNORE,
  survivalGraceMs: IGNORE,
});
const hudMonster = record<MonsterState>({
  x: IGNORE,
  y: IGNORE,
  moveCooldown: IGNORE,
  abilityCooldown: IGNORE,
  lifetimeMs: IGNORE,
  abilityWarningTicks: IGNORE,
  abilityTarget: IGNORE,
});
const hudBoss = nullable(record<BossState>({
  x: IGNORE,
  y: IGNORE,
  attackCooldown: IGNORE,
  moveCooldown: IGNORE,
}));
const wholeSeconds = (ms: number | undefined) => Math.ceil((ms ?? 0) / 1000);
const hudObjective = record<CampaignObjectiveState>({
  // The HUD shows a defence hold in whole seconds.
  ticksRemaining: { matters: (a, b) => wholeSeconds(a) !== wholeSeconds(b) },
  structureDamageCooldownMs: IGNORE,
});
const hudCampaign = nullable(record<CampaignRuntimeState>({
  spawnPoints: list(spawnPoint),
  objectives: list(hudObjective),
}));

// The round clock as the HUD prints it: whole seconds, or sudden death.
function displayedClock(state: GameEngineState): number {
  return isSuddenDeathMode(state) ? wholeSeconds(getRoundTimeRemainingMs(state)) : 0;
}

const shareHudState = record<GameEngineState>({
  tick: IGNORE,
  rngSeed: IGNORE,
  roundStartTicksRemaining: IGNORE,
  roundElapsedMs: IGNORE,
  bossIntroMsRemaining: IGNORE,
  map: IGNORE,
  fogOfWar: IGNORE,
  players: list(hudPlayer),
  monsters: list(hudMonster),
  boss: hudBoss,
  bombs: list(record<BombState>({ ticksRemaining: IGNORE })),
  explosions: list(record<ExplosionCell>({ ticksRemaining: IGNORE })),
  destroyedBoxes: list(record<DestroyedBox>({ ticksRemaining: IGNORE })),
  hazards: list(record<BossHazard>({ ticksRemaining: IGNORE })),
  timedPowerUps: dict(list(timedPowerUp)),
  pickupMessages: list(pickupMessage),
  campaign: hudCampaign,
}, (previous, next) => displayedClock(previous) !== displayedClock(next));

function useSharedState(
  state: GameEngineState | null,
  share: Share<GameEngineState>
): GameEngineState | null {
  const sharedRef = useRef(state);
  const previous = sharedRef.current;
  if (state !== previous) {
    sharedRef.current = previous && state ? share(previous, state) : state;
  }
  return sharedRef.current;
}

/**
 * The state the 3D scene renders from. Ticks that only move clocks (tick,
 * round time, fuses, cooldowns, crate and power-up timers) return the same
 * object, so the memoised scene does no React work at all; time-driven
 * visuals animate from the motion store and the live state in useFrame.
 */
export function useSceneState(
  state: GameEngineState | null,
  motion?: MotionStore | null
): GameEngineState | null {
  const shareRef = useRef<{
    motion: MotionStore | null | undefined;
    share: Share<GameEngineState>;
  }>();
  if (!shareRef.current || shareRef.current.motion !== motion) {
    shareRef.current = { motion, share: createSceneShare(motion) };
  }
  return useSharedState(state, shareRef.current.share);
}

/**
 * The state the HUD renders from: a new object only when something it prints
 * changes (the clock once a second, an ultimate's percentage, a pickup).
 */
export function useHudState(state: GameEngineState | null): GameEngineState | null {
  return useSharedState(state, shareHudState);
}

/** The scene's rules as a store selector, for a view that subscribes itself. */
export function sceneStateSelector(
  motion?: MotionStore | null
): EngineSelector<GameEngineState | null> {
  const share = createSceneShare(motion);
  return (state, previous) => (previous && state ? share(previous, state) : state);
}

/** The HUD's rules as a store selector (see useHudState). */
export const selectHudState: EngineSelector<GameEngineState | null> = (state, previous) => (
  previous && state ? shareHudState(previous, state) : state
);

/** For tests: the share rules without React. */
export const shareRenderState = {
  scene: (motion?: MotionStore | null) => createSceneShare(motion),
  hud: shareHudState,
};
