/* eslint-disable comma-dangle */
import { GameAction } from './actions';
import { GameEngineState } from './types';
import { createInitialState, resetRoundState } from './initialState';
import {
  movePlayer,
  placeObstacle,
  tickPickupMessages,
  tickPowerUps,
} from './players';
import {
  detonatePlayerBombs,
  placeBomb,
  placeUltimateBomb,
  tickBombs,
  tickExplosions,
} from './bombs';
import { checkMonsterCollisions, tickMonsters } from './monsters';
import { tickBossEncounter } from './bosses';

function getWinnerName(state: GameEngineState, winnerId: string): string {
  return state.players.find((player) => player.id === winnerId)?.name ?? winnerId;
}

function countWins(roundWinners: string[], winnerId: string): number {
  return roundWinners.filter((winner) => winner === winnerId).length;
}

function getMatchWinnerId(state: GameEngineState, roundWinners: string[]): string | null {
  const totals = state.players.map((player) => ({
    id: player.id,
    wins: countWins(roundWinners, player.id),
  }));
  const best = totals.reduce((currentBest, total) => (
    total.wins > currentBest.wins ? total : currentBest
  ), totals[0]);
  const tied = totals.filter((total) => total.wins === best.wins);
  return best.wins > 0 && tied.length === 1 ? best.id : null;
}

function checkRoundEnd(state: GameEngineState): GameEngineState {
  if (state.roundProcessed || state.phase !== 'playing') return state;

  if (state.config.mode === 'solo' && state.boss && state.boss.health <= 0) {
    return {
      ...state,
      resultMessage: `${state.boss.name} has been sealed! New reward unlocked.`,
      phase: 'game_over',
      roundProcessed: true,
      paused: true,
    };
  }

  const alive = state.players.filter((p) => p.alive);
  if (state.config.mode === 'solo') {
    if (alive.length > 0) return state;
    return {
      ...state,
      resultMessage: 'The boss overwhelmed your squad. Try again.',
      phase: 'game_over',
      roundProcessed: true,
      paused: true,
    };
  }

  if (alive.length > 1) return state;

  const roundWinners = [...state.roundWinners];
  let resultMessage = '';
  if (alive.length === 1) {
    roundWinners.push(alive[0].id);
    resultMessage = `${alive[0].name} wins the round!`;
  } else {
    roundWinners.push('draw');
    resultMessage = 'No players left, draw!';
  }

  const isLastRound = state.round >= state.totalRounds;
  if (isLastRound) {
    const winnerId = getMatchWinnerId(state, roundWinners);
    const gameOverMessage = winnerId
      ? `${getWinnerName(state, winnerId)} wins the match!`
      : 'The match ends in a draw!';

    return {
      ...state,
      roundWinners,
      resultMessage: gameOverMessage,
      phase: 'game_over',
      roundProcessed: true,
      paused: true,
      round: state.round + 1,
    };
  }

  return {
    ...state,
    roundWinners,
    resultMessage,
    phase: 'round_end',
    roundProcessed: true,
    paused: true,
    round: state.round + 1,
  };
}

function processTick(state: GameEngineState, deltaMs: number): GameEngineState {
  if (state.paused || state.phase !== 'playing') return state;

  let next = { ...state, tick: state.tick + 1 };
  next = tickPowerUps(next, deltaMs);
  next = tickPickupMessages(next, deltaMs);
  next = tickBombs(next, deltaMs);
  next = tickExplosions(next, deltaMs);
  next = tickBossEncounter(next, deltaMs);
  next = { ...next, monsters: tickMonsters(next, deltaMs) };
  next = { ...next, players: checkMonsterCollisions(next) };
  return checkRoundEnd(next);
}

export function gameReducer(
  state: GameEngineState | null,
  action: GameAction,
): GameEngineState | null {
  switch (action.type) {
    case 'INIT':
      return createInitialState(action.config);

    case 'MOVE':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return movePlayer(state, action.playerId, action.direction);

    case 'DROP_BOMB':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return placeBomb(state, action.playerId);

    case 'DETONATE_BOMBS':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return detonatePlayerBombs(state, action.playerId);

    case 'USE_ULTIMATE':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return placeUltimateBomb(state, action.playerId);

    case 'PLACE_OBSTACLE':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return placeObstacle(state, action.playerId);

    case 'TICK':
      if (!state) return state;
      return processTick(state, action.deltaMs);

    case 'PAUSE':
      return state ? { ...state, paused: true } : state;

    case 'RESUME':
      return state ? { ...state, paused: false } : state;

    case 'DISMISS_DIALOG':
      if (!state) return state;
      if (state.phase === 'game_over') {
        return {
          ...createInitialState(state.config),
          totalRounds: state.config.totalRounds,
        };
      }
      return resetRoundState({ ...state, round: state.round });

    case 'RESTART':
      return state ? createInitialState(state.config) : state;

    default:
      return state;
  }
}
