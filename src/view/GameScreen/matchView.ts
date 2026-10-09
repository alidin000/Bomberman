import { GameEngineState, isBossIntroRunning } from '../../engine';
import { CharacterId, StageId } from '../../content/types';
import type { EngineSelector } from '../../hooks/engineStore';
import { roundStartLine } from './matchCopy';

/**
 * What GameScreen itself renders from: nothing in here changes on a plain
 * tick, so a live round re-renders only the leaves that subscribe to what
 * they print (the HUD, the countdown, the scene).
 */
export type MatchView = {
  loaded: boolean;
  paused: boolean;
  phase: GameEngineState['phase'] | null;
  campaign: boolean;
  /** The boss's entrance is playing: the arena is frozen until it ends or is skipped. */
  bossIntro: boolean;
  characterIds: readonly CharacterId[];
  /** Solo only: the campaign's discoveries so far, for the story record. */
  discoveries: {
    stageId: StageId;
    leadCharacterId: CharacterId;
    secrets: readonly string[];
  } | null;
  /**
   * The latest state in which nothing ticks (paused, a round over), for the
   * pause menu, the round-over banner and the result dialog. During live
   * play it stays the last such state, so live ticks leave the view alone.
   */
  menuState: GameEngineState | null;
};

const NO_CHARACTERS: readonly CharacterId[] = [];

const NOT_LOADED: MatchView = {
  loaded: false,
  paused: false,
  phase: null,
  campaign: false,
  bossIntro: false,
  characterIds: NO_CHARACTERS,
  discoveries: null,
  menuState: null,
};

function sameList<T>(previous: readonly T[], next: readonly T[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index += 1) {
    if (previous[index] !== next[index]) return false;
  }
  return true;
}

function characterIdsOf(state: GameEngineState, previous: readonly CharacterId[]) {
  const { players } = state;
  let same = players.length === previous.length;
  for (let index = 0; same && index < players.length; index += 1) {
    same = players[index].characterId === previous[index];
  }
  return same ? previous : players.map((player) => player.characterId);
}

function discoveriesOf(state: GameEngineState, previous: MatchView['discoveries']) {
  const lead = state.players[0]?.characterId;
  if (state.config.mode !== 'solo' || !state.campaign || !lead) return null;
  const { stageId, discoveredSecrets } = state.campaign;
  if (
    previous
    && previous.stageId === stageId
    && previous.leadCharacterId === lead
    && sameList(previous.secrets, discoveredSecrets)
  ) return previous;
  return { stageId, leadCharacterId: lead, secrets: discoveredSecrets };
}

export const selectMatchView: EngineSelector<MatchView> = (state, previous) => {
  if (!state) return NOT_LOADED;
  const before = previous ?? NOT_LOADED;
  const frozen = state.paused || state.phase !== 'playing';
  const menuState = frozen ? state : before.menuState;
  const campaign = !!state.campaign;
  const bossIntro = isBossIntroRunning(state);
  const characterIds = characterIdsOf(state, before.characterIds);
  const discoveries = discoveriesOf(state, before.discoveries);
  if (
    before.loaded
    && before.paused === state.paused
    && before.phase === state.phase
    && before.campaign === campaign
    && before.bossIntro === bossIntro
    && before.characterIds === characterIds
    && before.discoveries === discoveries
    && before.menuState === menuState
  ) return before;
  return {
    loaded: true,
    paused: state.paused,
    phase: state.phase,
    campaign,
    bossIntro,
    characterIds,
    discoveries,
    menuState,
  };
};

// "GO!" stays up for the first 700 ms of play. Counted in engine ticks, so
// it pauses with the game and needs no timer.
export const GO_BEAT_TICKS = 14;

export type RoundBeat = {
  /** "3", "2", "1" while the round-start countdown runs, else "". */
  countdown: string;
  go: boolean;
  /** The round's line under the countdown ("Round 2 · P2 leads 1–0"). */
  line: string;
};

const NO_BEAT: RoundBeat = { countdown: '', go: false, line: '' };

/**
 * The countdown and GO beat. GO shows only after a countdown this view saw,
 * so a screen that mounts on a round already in play shows none. Keeps that
 * memory, so create one per component.
 */
export function createRoundBeatSelector(): EngineSelector<RoundBeat> {
  let armed = false;
  let liveTick: number | null = null;
  return (state, previous) => {
    const before = previous ?? NO_BEAT;
    if (!state || state.phase !== 'playing') return NO_BEAT;
    let countdown = '';
    let go = false;
    if (state.roundStartTicksRemaining > 0) {
      armed = true;
      liveTick = null;
      countdown = String(Math.ceil(state.roundStartTicksRemaining / 1000));
    } else {
      if (armed && liveTick === null) liveTick = state.tick;
      go = liveTick !== null && state.tick - liveTick < GO_BEAT_TICKS;
      if (!go) armed = false;
    }
    if (before.countdown === countdown && before.go === go) return before;
    let line = '';
    if (countdown) line = before.countdown ? before.line : roundStartLine(state);
    return { countdown, go, line };
  };
}
