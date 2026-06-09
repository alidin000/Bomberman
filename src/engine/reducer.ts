/* eslint-disable comma-dangle */
import { GameAction } from './actions';
import { GameEngineState } from './types';
import { createBossForConfig, createInitialState, resetRoundState } from './initialState';
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
import { withUpdatedFogOfWar } from './fogOfWar';
import { advanceCampaignObjectives } from './campaignObjectives';
import { tickCampaignRespawns } from './campaignEnemies';

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

function getDeathSummary(players: GameEngineState['players'], includeFallback = false): string {
  const fallen = players.filter((player) => !player.alive);
  if (fallen.length === 0) return '';
  return fallen
    .map((player) => (
      player.deathReason
        ?? (includeFallback ? `${player.name}'s exact death source was not recorded.` : '')
    ))
    .filter(Boolean)
    .join(' ');
}

function appendDeathSummary(message: string, state: GameEngineState): string {
  const deathSummary = getDeathSummary(state.players);
  return deathSummary ? `${message} ${deathSummary}` : message;
}

function getSoloDefeatMessage(state: GameEngineState): string {
  const deathSummary = getDeathSummary(state.players, true);
  return deathSummary
    ? `${deathSummary} Try again.`
    : 'The exact death source was not recorded. Try again.';
}

function spawnUnlockedCampaignBoss(state: GameEngineState): GameEngineState {
  if (!state.campaign?.bossUnlocked || state.boss) return state;
  const boss = createBossForConfig({ ...state.config, map: state.map });
  return {
    ...state,
    boss,
    campaign: {
      ...state.campaign,
      missionStep: 'boss',
      message: boss
        ? `${state.campaign.bossArena.label} active. Defeat ${boss.name}.`
        : state.campaign.message,
    },
  };
}

function advanceCampaignState(
  state: GameEngineState,
  deltaMs = 0
): GameEngineState {
  return spawnUnlockedCampaignBoss(advanceCampaignObjectives(state, deltaMs));
}

function checkRoundEnd(state: GameEngineState): GameEngineState {
  if (state.roundProcessed || state.phase !== 'playing') return state;

  if (state.campaign?.missionResult === 'failed') {
    return {
      ...state,
      resultMessage: `${state.campaign.villageName} mission failed. Regroup and try again.`,
      phase: 'game_over',
      roundProcessed: true,
      paused: true,
    };
  }

  if (state.config.mode === 'solo' && state.boss && state.boss.health <= 0) {
    return {
      ...state,
      campaign: state.campaign
        ? {
          ...state.campaign,
          missionResult: 'success',
          missionStep: 'complete',
          message: `${state.campaign.villageName} secured. Reward unlocked.`,
        }
        : state.campaign,
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
      resultMessage: getSoloDefeatMessage(state),
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
    resultMessage = appendDeathSummary(`${alive[0].name} wins the round.`, state);
  } else {
    roundWinners.push('draw');
    resultMessage = appendDeathSummary('No players left. Draw.', state);
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
      resultMessage: appendDeathSummary(gameOverMessage, state),
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
  next = advanceCampaignState(next, deltaMs);
  next = tickCampaignRespawns(next, deltaMs);
  next = tickBossEncounter(next, deltaMs);
  next = tickMonsters(next, deltaMs);
  next = { ...next, players: checkMonsterCollisions(next) };
  return withUpdatedFogOfWar(checkRoundEnd(next));
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
      return withUpdatedFogOfWar(advanceCampaignState(
        movePlayer(state, action.playerId, action.direction)
      ));

    case 'DROP_BOMB':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return withUpdatedFogOfWar(advanceCampaignState(placeBomb(state, action.playerId)));

    case 'DETONATE_BOMBS':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return withUpdatedFogOfWar(advanceCampaignState(detonatePlayerBombs(
        state,
        action.playerId
      )));

    case 'USE_ULTIMATE':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return withUpdatedFogOfWar(advanceCampaignState(placeUltimateBomb(
        state,
        action.playerId
      )));

    case 'PLACE_OBSTACLE':
      if (!state || state.phase !== 'playing' || state.paused) return state;
      return withUpdatedFogOfWar(advanceCampaignState(placeObstacle(state, action.playerId)));

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
