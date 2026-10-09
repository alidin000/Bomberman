import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { CHARACTER_DEFINITIONS } from '../../content';
import { CharacterId } from '../../content/types';
import { DeathCause, GameEngineState } from '../../engine/types';
import {
  CAPTION_MAX_CHARS,
  composeCaption,
  deathCaption,
  knockoutCaption,
  roundOverBanner,
  roundStartLine,
} from './matchCopy';

function versus(characters: CharacterId[], totalRounds = 3): GameEngineState {
  return createInitialState({
    numPlayers: characters.length,
    totalRounds,
    selectedMap: 'map1',
    selectedCharacters: characters,
    map: parseMapRows(defaultMap),
  });
}

function knockOut(state: GameEngineState, slot: number, cause: DeathCause): GameEngineState {
  return {
    ...state,
    players: state.players.map((player, index) => (
      index === slot ? { ...player, alive: false, deathCause: cause } : player
    )),
  };
}

describe('match copy', () => {
  it('leads the countdown line with the score from round 2, by slot', () => {
    const state = versus(['gaara', 'gaara']);
    expect(roundStartLine(state)).toBe('Round 1 · First to 2');
    expect(roundStartLine({ ...state, round: 2, roundWinners: ['player1'] }))
      .toBe('Round 2 · P1 Gaara leads 1–0');
    expect(roundStartLine({ ...state, round: 3, roundWinners: ['player1', 'player2'] }))
      .toBe('Round 3 · Tied 1–1');
    // A drawn round uses up a round but scores for nobody.
    expect(roundStartLine({ ...state, round: 2, roundWinners: ['draw'] }))
      .toBe('Round 2 · First to 2');
  });

  it('names both sides of a mirror-match knockout by slot, in 40 characters or fewer', () => {
    const ids = CHARACTER_DEFINITIONS.map((character) => character.id);
    ids.forEach((killer) => ids.forEach((victim) => {
      const state = versus([victim, killer]);
      const caught = knockOut(state, 0, { kind: 'blast', byPlayerId: 'player2', bombKind: 'giantClay' });
      const blast = deathCaption(caught, caught.players[0]);
      expect(blast).toMatch(/^P2 \S+'s blast caught P1 \S+$/);
      expect(blast.length).toBeLessThanOrEqual(CAPTION_MAX_CHARS);
      const flame = knockOut(state, 0, { kind: 'flame', byPlayerId: 'player2' });
      expect(deathCaption(flame, flame.players[0]).length).toBeLessThanOrEqual(CAPTION_MAX_CHARS);
      const own = knockOut(state, 1, { kind: 'blast', byPlayerId: 'player2' });
      expect(deathCaption(own, own.players[1])).toMatch(/^P2 \S+ caught in own blast$/);
    }));
  });

  it('falls back to a short line when an enemy name would run past 40 characters', () => {
    const state = knockOut(versus(['deidara', 'naruto']), 0, {
      kind: 'enemy', sourceName: 'Elite Hidden Mist Water Clone Captain',
    });
    expect(deathCaption(state, state.players[0])).toBe('An enemy caught P1 Deidara');
  });

  it('calls a simultaneous knockout by slots only', () => {
    const state = knockOut(knockOut(versus(['naruto', 'naruto']), 0, { kind: 'pressure' }), 1, { kind: 'pressure' });
    expect(knockoutCaption(state, ['player1', 'player2'])).toBe('Double KO · P1 and P2');
  });

  it('keeps the most important caption whole and drops what would pass 40 characters', () => {
    expect(composeCaption(['P2 Deidara\'s blast caught P1 Deidara', 'Enemy defeated']))
      .toBe('P2 Deidara\'s blast caught P1 Deidara');
    expect(composeCaption(['Boss hit', 'Enemy defeated'])).toBe('Boss hit. Enemy defeated');
  });

  it('banners the round and the match winner with the final score', () => {
    const state = versus(['itachi', 'gaara']);
    expect(roundOverBanner({
      ...state, phase: 'round_end', round: 2, roundWinners: ['player1', 'player2'],
    })).toBe('P2 Gaara takes round 2');
    expect(roundOverBanner({ ...state, phase: 'round_end', roundWinners: ['draw'] }))
      .toBe('Round 1 · Draw');
    expect(roundOverBanner({
      ...state, phase: 'game_over', round: 3, roundWinners: ['player1', 'player2', 'player1'],
    })).toBe('P1 Itachi wins 2–1');
  });
});
