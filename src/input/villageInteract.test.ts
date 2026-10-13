import { createInitialState } from '../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../engine/mapLoader';
import type { GameConfig, GameEngineState } from '../engine/types';
import { createVillageRuntime } from '../engine/villageSquare';
import { squareBombPress, squareKindOpen } from './villageInteract';

function leafMission(village?: GameConfig['village']): GameEngineState {
  return createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['deidara'],
    map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
    seed: 11,
    ...(village ? { village } : {}),
  });
}

function at(state: GameEngineState, x: number, y: number): GameEngineState {
  return { ...state, players: state.players.map((player) => ({ ...player, x, y })) };
}

describe('the bomb key in a village square', () => {
  it('uses the prop in reach, diagonals included, and never bombs inside the square', () => {
    const state = leafMission();
    const p1 = state.players[0].id;
    // At the spawn nothing is in reach, but the key still does not bomb.
    expect(squareBombPress(at(state, 1, 1), p1)).toEqual({ item: null });
    expect(squareBombPress(at(state, 3, 2), p1)?.item?.id).toBe('villager-a');
    expect(squareBombPress(at(state, 9, 7), p1)?.item?.id).toBe('shop');
    expect(squareBombPress(at(state, 3, 7), p1)?.item?.id).toBe('shrine');
    // Mid-step positions count as the nearest cell.
    expect(squareBombPress(at(state, 4.9, 7.2), p1)?.item?.id).toBe('gate');
    // Out through the east way: an ordinary bomb again.
    expect(squareBombPress(at(state, 11, 4), p1)).toBeNull();
  });

  it('finds Tamsin only from Known', () => {
    // Co-op and online rooms have no visit: stranger, so no Tamsin to talk to.
    const stranger = at(leafMission(), 8, 2);
    expect(squareBombPress(stranger, stranger.players[0].id)).toEqual({ item: null });
    const known = at(leafMission({ reputationTier: 'known', embers: 0, offeredRequestIds: [] }), 8, 2);
    expect(squareBombPress(known, known.players[0].id)?.item?.id).toBe('villager-wanderer');
  });

  it('opens the stall and the board only on a solo visit with one player', () => {
    const visit = { reputationTier: 'stranger' as const, embers: 10, offeredRequestIds: [] };
    // The visit's runtime as the engine builds it at INIT.
    const withRuntime = (state: GameEngineState): GameEngineState => ({
      ...state,
      campaign: { ...state.campaign!, village: createVillageRuntime(state.config) },
    });
    const coop = withRuntime(leafMission());
    const solo = withRuntime(leafMission(visit));
    const pair = withRuntime(createInitialState({ ...leafMission(visit).config, numPlayers: 2 }));
    expect(squareKindOpen(coop, 'villager')).toBe(true);
    expect(squareKindOpen(coop, 'gate')).toBe(true);
    expect(squareKindOpen(coop, 'shop')).toBe(false);
    expect(squareKindOpen(coop, 'board')).toBe(false);
    expect(squareKindOpen(solo, 'shop')).toBe(true);
    expect(squareKindOpen(solo, 'board')).toBe(true);
    expect(squareKindOpen(pair, 'shop')).toBe(false);
  });

  it('keeps the bomb key a bomb outside the campaign and off the campaign map', () => {
    const base = leafMission();
    const versus = createInitialState({ ...base.config, mode: 'local' });
    expect(squareBombPress(at(versus, 3, 2), versus.players[0].id)).toBeNull();
    // A campaign mission on a small test board has no square (engine rule).
    const small = createInitialState({
      ...base.config,
      map: parseMapRows(Array.from({ length: 15 }, () => ' '.repeat(15).split(''))),
    });
    expect(squareBombPress(at(small, 3, 2), small.players[0].id)).toBeNull();
  });
});
