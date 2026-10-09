// Test-only: drives a village's route puzzle through the reducer with the
// actions a player would send (MOVE onto a piece, DROP_BOMB on it, TICK until
// the blast has gone). The player is set down beside a piece between steps,
// as the other campaign tests do, instead of path-finding across the map.
import { readFileSync } from 'node:fs';
import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { positionsTouch } from './grid';
import { PUZZLE_STEP_DISTANCE, toggleSolution } from './campaignPuzzles';
import type { DifficultyId } from './difficulty';
import {
  CampaignObjectiveState,
  CampaignPuzzleElementState,
  Direction,
  GameEngineState,
  Point,
} from './types';
import { CharacterId, StageId } from '../content/types';

export function stageMap(stageId: StageId) {
  return parseMapRows(readFileSync(`public/maps/${stageId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
}

export function campaignState(
  stageId: StageId,
  difficulty: DifficultyId = 'normal',
  character: CharacterId = 'naruto'
): GameEngineState {
  return {
    ...createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: stageId,
      stageId,
      selectedCharacters: [character],
      map: stageMap(stageId),
      difficulty,
    }),
    roundStartTicksRemaining: 0,
  };
}

export function tick(state: GameEngineState, deltaMs = 50): GameEngineState {
  return gameReducer(state, { type: 'TICK', deltaMs })!;
}

// No patrols: the scripts test the puzzle, not the dodging. The mini boss
// guard stays: it spawns once, when the puzzle opens its gate.
export function calm(state: GameEngineState): GameEngineState {
  const guards = new Set(state.campaign?.objectives.map((objective) => objective.miniBossGuardId));
  const monsters = state.monsters.filter((monster) => guards.has(monster.id));
  return monsters.length === state.monsters.length ? state : { ...state, monsters };
}

export function setPlayer(state: GameEngineState, point: Point): GameEngineState {
  return {
    ...state,
    players: state.players.map((player, index) => (
      index === 0 ? { ...player, x: point.x, y: point.y } : player
    )),
  };
}

export function puzzleObjective(state: GameEngineState): CampaignObjectiveState {
  const objective = state.campaign!.objectives.find((item) => item.kind === 'puzzle');
  if (!objective) throw new Error('no puzzle objective');
  return objective;
}

export function piece(state: GameEngineState, id: string): CampaignPuzzleElementState {
  const found = puzzleObjective(state).puzzle!.elements.find((item) => item.id === id);
  if (!found) throw new Error(`no piece ${id}`);
  return found;
}

/** Rescue every target and hold the defense, so the puzzle is the active step. */
export function reachPuzzle(state: GameEngineState): GameEngineState {
  let next = calm(state);
  next.campaign!.objectives[0].targets!.forEach((target) => {
    next = tick(setPlayer(next, target), 0);
  });
  next = calm(tick(next, 20000));
  if (puzzleObjective(next).status !== 'active') throw new Error('puzzle did not activate');
  return next;
}

const STEPS: { direction: Direction; dx: number; dy: number }[] = [
  { direction: 'right', dx: -1, dy: 0 },
  { direction: 'left', dx: 1, dy: 0 },
  { direction: 'down', dx: 0, dy: -1 },
  { direction: 'up', dx: 0, dy: 1 },
];

/** Sets the player on an open cell beside `cell` and walks onto it with MOVE. */
export function walkOnto(state: GameEngineState, cell: Point): GameEngineState {
  const approach = STEPS.find(({ dx, dy }) => state.map[cell.y + dy]?.[cell.x + dx] === 'Empty');
  if (!approach) throw new Error(`no open side next to ${cell.x},${cell.y}`);
  let next = setPlayer(calm(state), { x: cell.x + approach.dx, y: cell.y + approach.dy });
  const playerId = next.players[0].id;
  for (let step = 0; step < 14; step += 1) {
    if (positionsTouch(next.players[0], cell, PUZZLE_STEP_DISTANCE / 2)) return next;
    next = gameReducer(next, { type: 'MOVE', playerId, direction: approach.direction })!;
  }
  throw new Error(`could not walk onto ${cell.x},${cell.y}`);
}

/** Steps back off a piece the way the player came, so it can be stepped on again. */
export function stepOff(state: GameEngineState, cell: Point): GameEngineState {
  const away = STEPS.find(({ dx, dy }) => state.map[cell.y + dy]?.[cell.x + dx] === 'Empty');
  if (!away) throw new Error(`no open side next to ${cell.x},${cell.y}`);
  const reverse: Record<Direction, Direction> = {
    right: 'left', left: 'right', down: 'up', up: 'down',
  };
  let next = state;
  const playerId = next.players[0].id;
  for (let step = 0; step < 14; step += 1) {
    if (!positionsTouch(next.players[0], cell, PUZZLE_STEP_DISTANCE + 0.1)) return next;
    next = gameReducer(next, { type: 'MOVE', playerId, direction: reverse[away.direction] })!;
  }
  throw new Error(`could not step off ${cell.x},${cell.y}`);
}

export function stepOnto(state: GameEngineState, cell: Point): GameEngineState {
  return stepOff(walkOnto(state, cell), cell);
}

/**
 * Drops a bomb on each cell in turn, then waits it out at the entrance. The
 * player holds enough bombs for that (Naruto's clone bomb takes a second).
 */
export function bombCells(state: GameEngineState, cells: Point[]): GameEngineState {
  let next: GameEngineState = {
    ...state,
    players: state.players.map((player, index) => (
      index === 0 ? { ...player, maxBombs: Math.max(player.maxBombs, cells.length * 2) } : player
    )),
  };
  cells.forEach((cell) => {
    next = walkOnto(next, cell);
    next = gameReducer(next, { type: 'DROP_BOMB', playerId: next.players[0].id })!;
  });
  next = setPlayer(next, { x: 1, y: 1 });
  for (let elapsed = 0; elapsed < 6000; elapsed += 50) {
    next = calm(tick(next));
    if (next.bombs.length === 0 && next.explosions.length === 0) return next;
  }
  throw new Error('bombs did not clear');
}

function pieces(state: GameEngineState, role?: string): CampaignPuzzleElementState[] {
  return puzzleObjective(state).puzzle!.elements.filter((item) => !role || item.role === role);
}

/** Solves the active puzzle the intended way for its kind. */
export function solvePuzzle(state: GameEngineState): GameEngineState {
  const { puzzle } = puzzleObjective(state);
  let next = state;
  switch (puzzle!.kind) {
    case 'kindle':
      pieces(next).forEach((item) => { next = bombCells(next, [item]); });
      return next;
    case 'topple':
      return bombCells(next, pieces(next));
    case 'toggle':
      toggleSolution(puzzle!).forEach((id) => { next = stepOnto(next, piece(next, id)); });
      return next;
    case 'sequence':
      [...pieces(next)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((item) => {
        next = stepOnto(next, item);
      });
      return next;
    case 'carry': {
      const limit = puzzle!.tuning.carryLimit ?? 1;
      const stones = pieces(next, 'keystone');
      const cairn = pieces(next, 'cairn')[0];
      stones.forEach((stone, index) => {
        next = stepOnto(next, stone);
        if ((index + 1) % limit === 0 || index === stones.length - 1) next = stepOnto(next, cairn);
      });
      return next;
    }
    case 'pairs': {
      const pairs = new Set(pieces(next).map((item) => item.pair));
      pairs.forEach((pair) => {
        const [a, b] = pieces(next).filter((item) => item.pair === pair);
        next = bombCells(next, [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]);
      });
      return next;
    }
    case 'relay':
    default:
      pieces(next).forEach((item) => { next = stepOnto(next, item); });
      return next;
  }
}
