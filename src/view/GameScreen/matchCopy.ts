// In-match wording shared by the HUD, captions, the round-start line and the
// result dialog. Every sentence about a player leads with the slot ("P2
// Itachi"), because two players may be the same shinobi.
import { DeathCause, GameEngineState, PlayerState } from '../../engine/types';
import { getRoundTimeRemainingMs, isSuddenDeathMode } from '../../engine/suddenDeath';
import { getControllerLabel, getSlotController } from '../../ai/controllers';
import { playerSlotLabel } from './playerSlots';
import { getDojoRoomInfo, isDojoRoomId } from '../../content/dojo';

/** Longest caption line (Xbox Accessibility Guideline 104). */
export const CAPTION_MAX_CHARS = 40;

/** The clock warns this long before the walls start closing. */
export const SUDDEN_DEATH_LEAD_MS = 5000;

export function isVersus(state: GameEngineState): boolean {
  return !state.campaign && state.config.mode !== 'solo' && state.config.mode !== 'training';
}

function trainingRoomLine(state: GameEngineState): string | null {
  const roomId = state.config.training?.roomId;
  if (state.config.mode !== 'training' || !isDojoRoomId(roomId)) return null;
  const room = getDojoRoomInfo(roomId);
  return `Room ${room.order} · ${room.name}`;
}

export function slotOf(state: GameEngineState, playerId: string | undefined): number {
  return playerId ? state.players.findIndex((player) => player.id === playerId) : -1;
}

/** "P2 Itachi". */
export function slotName(state: GameEngineState, slot: number): string {
  const player = state.players[slot];
  return player ? `${playerSlotLabel(slot)} ${player.name}` : 'Shinobi';
}

/** "Normal" for a CPU slot, null for a human one. */
export function cpuLevelLabel(state: GameEngineState, slot: number): string | null {
  const controller = getSlotController(state.config, slot);
  if (controller === 'human') return null;
  return getControllerLabel(controller).replace(/^CPU\s+/, '');
}

/** Rounds a player must win to take the match ("best of" its round count). */
export function winsNeeded(totalRounds: number): number {
  return Math.floor(Math.max(1, totalRounds) / 2) + 1;
}

export function winsBySlot(state: GameEngineState): number[] {
  return state.players.map((player) => (
    state.roundWinners.filter((winner) => winner === player.id).length
  ));
}

// Wins, highest first: "2–1", or "1–1–0" with three players.
function scoreText(wins: number[]): string {
  return [...wins].sort((a, b) => b - a).join('–');
}

function uniqueLeader(wins: number[]): number | null {
  const best = Math.max(0, ...wins);
  if (best === 0 || wins.filter((count) => count === best).length > 1) return null;
  return wins.indexOf(best);
}

/** Who took the match: the most round wins, alone; null for a draw. */
export function matchWinnerSlot(state: GameEngineState): number | null {
  return uniqueLeader(winsBySlot(state));
}

/** Who took the round that just ended; null for a draw. */
export function lastRoundWinnerSlot(state: GameEngineState): number | null {
  const slot = slotOf(state, state.roundWinners[state.roundWinners.length - 1]);
  return slot >= 0 ? slot : null;
}

/** The match bar line: "First to 2", or "One round" for a single round. */
export function firstToText(totalRounds: number): string {
  return totalRounds > 1 ? `First to ${winsNeeded(totalRounds)}` : 'One round';
}

/**
 * The line under the countdown, set once per round: "Round 2 · P1 Gaara
 * leads 1–0", "Round 3 · Tied 1–1", or "Round 1 · First to 2".
 */
export function roundStartLine(state: GameEngineState): string {
  const room = trainingRoomLine(state);
  if (room) return room;
  if (state.campaign) {
    const active = state.campaign.objectives.find((objective) => objective.status === 'active');
    return active ? `${state.campaign.villageName} · ${active.label}` : state.campaign.villageName;
  }
  const round = `Round ${Math.min(state.round, state.totalRounds)}`;
  if (state.totalRounds <= 1) return round;
  const wins = winsBySlot(state);
  const best = Math.max(0, ...wins);
  if (best === 0) return `${round} · ${firstToText(state.totalRounds)}`;
  const leader = uniqueLeader(wins);
  if (leader === null) return `${round} · Tied ${best}–${best}`;
  const runnerUp = Math.max(0, ...wins.filter((_, slot) => slot !== leader));
  return `${round} · ${slotName(state, leader)} leads ${best}–${runnerUp}`;
}

/** The banner held over the deciding moment, before the result dialog. */
export function roundOverBanner(state: GameEngineState): string {
  if (state.config.mode === 'training') {
    return state.players.some((player) => player.alive) ? 'Room cleared' : 'Caught · try again';
  }
  if (!isVersus(state)) {
    if (state.campaign?.missionResult === 'success' || (state.boss && state.boss.health <= 0)) {
      return 'Mission complete';
    }
    return 'Mission failed';
  }
  if (state.phase === 'game_over') {
    const winner = matchWinnerSlot(state);
    const score = scoreText(winsBySlot(state));
    return winner === null
      ? `Draw · ${score}`
      : `${slotName(state, winner)} wins ${score}`;
  }
  const winner = lastRoundWinnerSlot(state);
  return winner === null
    ? `Round ${state.round} · Draw`
    : `${slotName(state, winner)} takes round ${state.round}`;
}

/** The final score line for the match-over dialog: "2–1 · first to 2". */
export function matchScoreLine(state: GameEngineState): string {
  return `${scoreText(winsBySlot(state))} · ${firstToText(state.totalRounds).toLowerCase()}`;
}

function ownerSlot(state: GameEngineState, cause: DeathCause): number {
  return slotOf(state, cause.byPlayerId);
}

/**
 * How a player went down, short, for the card and the result rows: "P2
 * Itachi's blast", "Own blast", "Crushed in sudden death". Empty when the
 * engine recorded no cause.
 */
export function deathNote(state: GameEngineState, player: PlayerState): string {
  const cause = player.deathCause;
  if (!cause) return '';
  switch (cause.kind) {
    case 'blast':
    case 'flame': {
      const what = cause.kind === 'blast' ? 'blast' : 'flame';
      if (cause.byPlayerId === player.id) return `Own ${what}`;
      const owner = ownerSlot(state, cause);
      return owner >= 0 ? `${slotName(state, owner)}'s ${what}` : `A ${what}`;
    }
    case 'pressure':
      return 'Crushed in sudden death';
    case 'enemy':
      return cause.sourceName ? `Caught by ${cause.sourceName}` : 'Caught by an enemy';
    case 'hazard':
      return cause.sourceName ? `Hit by ${cause.sourceName}` : 'Hit by a hazard';
    case 'ghost':
      return 'Trapped in a wall';
    default:
      return '';
  }
}

function fit(text: string, fallback: string): string {
  return text.length <= CAPTION_MAX_CHARS ? text : fallback;
}

/**
 * The caption for one player going down, 40 characters or fewer: "P2
 * Itachi's blast caught P1 Gaara", "P1 Gaara caught in own blast".
 */
export function deathCaption(state: GameEngineState, player: PlayerState): string {
  const slot = slotOf(state, player.id);
  const victim = slot >= 0 ? slotName(state, slot) : player.name;
  const out = `${victim} is out`;
  const cause = player.deathCause;
  if (!cause) return out;
  switch (cause.kind) {
    case 'blast':
    case 'flame': {
      const what = cause.kind === 'blast' ? 'blast' : 'flame';
      if (cause.byPlayerId === player.id) return fit(`${victim} caught in own ${what}`, out);
      const owner = ownerSlot(state, cause);
      return owner >= 0
        ? fit(`${slotName(state, owner)}'s ${what} caught ${victim}`, out)
        : fit(`A ${what} caught ${victim}`, out);
    }
    case 'pressure':
      return fit(`${victim} crushed in sudden death`, out);
    case 'enemy':
      return fit(`${cause.sourceName ?? 'An enemy'} caught ${victim}`, `An enemy caught ${victim}`);
    case 'hazard':
      return fit(`${cause.sourceName ?? 'A hazard'} hit ${victim}`, `A hazard hit ${victim}`);
    case 'ghost':
      return fit(`${victim} trapped in a wall`, out);
    default:
      return out;
  }
}

/** One caption for everyone who fell on the same tick. */
export function knockoutCaption(state: GameEngineState, fallenIds: string[]): string {
  const fallen = fallenIds
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is PlayerState => !!player);
  if (fallen.length === 1) return deathCaption(state, fallen[0]);
  const slots = fallen.map((player) => playerSlotLabel(slotOf(state, player.id)));
  const names = `${slots.slice(0, -1).join(', ')} and ${slots[slots.length - 1]}`;
  return `${fallen.length === 2 ? 'Double' : 'Triple'} KO · ${names}`;
}

/**
 * Joins captions in priority order and stops before the line would pass 40
 * characters, so the most important event always shows in full.
 */
export function composeCaption(parts: string[]): string {
  return parts.reduce((line, part) => {
    if (!line) return part;
    const joined = `${line}. ${part}`;
    return joined.length <= CAPTION_MAX_CHARS ? joined : line;
  }, '');
}

export type SuddenDeathCue = { title: string; detail: string } | null;

/** "Sudden death in 5" for the last 5 s of the clock, then the running banner. */
export function suddenDeathCue(state: GameEngineState): SuddenDeathCue {
  if (!isSuddenDeathMode(state)) return null;
  const remaining = getRoundTimeRemainingMs(state);
  if (remaining > SUDDEN_DEATH_LEAD_MS) return null;
  if (remaining > 0) {
    return { title: `Sudden death in ${Math.ceil(remaining / 1000)}`, detail: 'Walls close next' };
  }
  return { title: 'Sudden death', detail: 'Walls closing' };
}
