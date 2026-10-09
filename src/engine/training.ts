import { GameMap, isPower } from '../model/gameItem';
import {
  BombState, GameConfig, GameEngineState, MonsterState, Point, TrainingGoal,
} from './types';
import { createBomb } from './bombs';

// Training Dojo rooms (`mode: 'training'`). The room's data travels in
// `config.training`; this file turns it into the opening board and decides
// when the room ends. Everything else plays by the ordinary rules.

/** Owner of the charges a room lights before it starts: no player. */
export const TRAINING_CHARGE_OWNER = 'dojo';

export function isTrainingConfig(config: Pick<GameConfig, 'mode'>): boolean {
  return config.mode === 'training';
}

/** The room's charges, lit and placed on the map, plus that map. */
export function placeTrainingCharges(
  config: GameConfig,
  map: GameMap
): { bombs: BombState[]; map: GameMap } {
  const charges = isTrainingConfig(config) ? config.training?.charges ?? [] : [];
  if (charges.length === 0) return { bombs: [], map };
  const next = map.map((row) => [...row]);
  const bombs = charges
    .filter((charge) => next[charge.y]?.[charge.x] === 'Empty')
    .map((charge) => {
      next[charge.y][charge.x] = {
        range: charge.range,
        coords: { x: charge.x, y: charge.y },
        ownerId: TRAINING_CHARGE_OWNER,
      };
      return createBomb(
        TRAINING_CHARGE_OWNER,
        charge.x,
        charge.y,
        charge.range,
        false,
        'standard',
        charge.fuseMs
      );
    });
  return { bombs, map: next };
}

/** The room's sentries, standing on the first cell of their routes. */
export function createTrainingSentries(config: GameConfig): MonsterState[] {
  if (!isTrainingConfig(config)) return [];
  return (config.training?.sentries ?? [])
    .filter((sentry) => sentry.route.length > 0)
    .map((sentry) => ({
      id: sentry.id,
      name: sentry.name,
      x: sentry.route[0].x,
      y: sentry.route[0].y,
      kind: 'basic',
      moveCooldown: sentry.moveMs,
      moveMs: sentry.moveMs,
      detectionRange: 0,
      patrol: {
        route: sentry.route.map((point) => ({ x: point.x, y: point.y })),
        leg: sentry.route.length > 1 ? 1 : 0,
        forward: true,
      },
    }));
}

function standsOn(state: GameEngineState, x: number, y: number): boolean {
  for (let index = 0; index < state.players.length; index += 1) {
    const player = state.players[index];
    if (player.alive && Math.round(player.x) === x && Math.round(player.y) === y) return true;
  }
  return false;
}

function everyCell(
  state: GameEngineState,
  cells: readonly Point[],
  holds: (cell: GameMap[number][number] | undefined) => boolean
): boolean {
  for (let index = 0; index < cells.length; index += 1) {
    if (!holds(state.map[cells[index].y]?.[cells[index].x])) return false;
  }
  return true;
}

const notCrate = (cell: GameMap[number][number] | undefined) => cell !== 'Box';
const notPickup = (cell: GameMap[number][number] | undefined) => (
  cell === undefined || !isPower(cell)
);

function chargesLeft(state: GameEngineState): boolean {
  for (let index = 0; index < state.bombs.length; index += 1) {
    if (state.bombs[index].ownerId === TRAINING_CHARGE_OWNER) return true;
  }
  return false;
}

// Allocation-free: the goal line's selector runs this once per frame.
export function isTrainingGoalMet(state: GameEngineState, goal: TrainingGoal): boolean {
  switch (goal.kind) {
    case 'reach':
      return standsOn(state, goal.x, goal.y);
    case 'breakCrates':
      return everyCell(state, goal.cells, notCrate);
    case 'outlastCharges':
      return !chargesLeft(state);
    case 'collect':
      return everyCell(state, goal.cells, notPickup);
    case 'defeatAll':
      return state.monsters.length === 0;
    default:
      return false;
  }
}

/**
 * The room's step: the index of its first goal that does not hold yet, or
 * the goal count once all of them hold. Allocates nothing.
 */
export function firstOpenTrainingGoal(state: GameEngineState): number {
  const goals = state.config.training?.goals ?? [];
  for (let index = 0; index < goals.length; index += 1) {
    if (!isTrainingGoalMet(state, goals[index])) return index;
  }
  return goals.length;
}

/** Which of the room's goals hold right now, in the room's order. */
export function trainingGoalsMet(state: GameEngineState): boolean[] {
  return (state.config.training?.goals ?? []).map((goal) => isTrainingGoalMet(state, goal));
}

function deathSummary(state: GameEngineState): string {
  return state.players
    .filter((player) => !player.alive)
    .map((player) => player.deathReason ?? '')
    .filter(Boolean)
    .join(' ');
}

/**
 * A training room ends once its player falls (failed) or every goal holds
 * at the same moment (cleared). A fall on the deciding tick counts as a fall.
 */
export function checkTrainingRoundEnd(state: GameEngineState): GameEngineState {
  if (state.roundProcessed || state.phase !== 'playing') return state;
  const fallen = state.players.length > 0 && state.players.every((player) => !player.alive);
  if (fallen) {
    const summary = deathSummary(state);
    return {
      ...state,
      resultMessage: summary ? `${summary} Try the room again.` : 'Try the room again.',
      phase: 'game_over',
      roundProcessed: true,
      paused: true,
    };
  }
  const goalCount = state.config.training?.goals.length ?? 0;
  if (goalCount === 0 || firstOpenTrainingGoal(state) < goalCount) return state;
  return {
    ...state,
    resultMessage: 'Room cleared.',
    phase: 'game_over',
    roundProcessed: true,
    paused: true,
  };
}

export type TrainingOutcome = 'cleared' | 'failed';

/** How a finished training room ended; null while it is still running. */
export function getTrainingOutcome(state: GameEngineState | null): TrainingOutcome | null {
  if (!state || !isTrainingConfig(state.config) || state.phase !== 'game_over') return null;
  return state.players.some((player) => player.alive) ? 'cleared' : 'failed';
}
