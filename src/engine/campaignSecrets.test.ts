import type { CampaignHiddenAreaDefinition } from '../content/campaignMissions';
import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows, parseMapText } from './mapLoader';
import { getCampaignDestructionOutcome } from './campaignExploration';
import { GameConfig, GameEngineState } from './types';

// Two walled rooms in an open yard: the west room is shut by a cracked wall
// (C), the east one opens through a hidden passage (H) that looks like wall.
const ROOMS = parseMapText(`
WWWWWWWWWWWWWWWWW
W               W
W WWWWW   WWWWW W
W W   W   W   W W
W W   W   W   H W
W W   W   W   W W
W WWCWW   WWWWW W
W               W
W               W
WWWWWWWWWWWWWWWWW
`);

const scroll: CampaignHiddenAreaDefinition = {
  id: 'test-scroll-cache',
  label: 'Test Scroll Cache',
  description: 'A scroll in the cracked-wall room.',
  x: 4,
  y: 3,
  kind: 'scroll',
  rewardPowerUp: 'Rasengan',
  room: {
    x: 3, y: 3, width: 3, height: 3, entry: 'crackedWall', door: { x: 4, y: 6 },
  },
};

const burrow: CampaignHiddenAreaDefinition = {
  id: 'test-zetsu-burrow',
  label: 'Test Zetsu Burrow',
  description: 'An elite ambush behind the false wall.',
  x: 11,
  y: 4,
  kind: 'zetsuBurrow',
  enemyArchetype: 'blackZetsu',
  room: {
    x: 11, y: 3, width: 3, height: 3, entry: 'hiddenPassage', door: { x: 14, y: 4 },
  },
};

const config: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  selectedCharacters: ['naruto'],
  map: parseMapRows(ROOMS),
  seed: 11,
};

function withRooms(areas: CampaignHiddenAreaDefinition[]): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    campaign: { ...state.campaign!, hiddenAreas: areas, discoveredSecrets: [] },
  };
}

function standAt(state: GameEngineState, x: number, y: number): GameEngineState {
  return gameReducer({
    ...state,
    players: state.players.map((player) => ({ ...player, x, y })),
  }, { type: 'TICK', deltaMs: 50 })!;
}

describe('secret rooms', () => {
  it('parses the campaign map marks: cracked walls break like crates, passages are floor', () => {
    const map = parseMapRows(ROOMS);
    expect(map[6][4]).toBe('Box');
    expect(map[4][14]).toBe('Empty');
    expect(parseMapRows([['W', 'G', 'W']])[0][1]).toBe('Wall');
  });

  it('crumbles a cracked wall without the random crate roll', () => {
    const plain = withRooms([]);
    const roomed = withRooms([scroll]);
    // A tick on which this very cell would roll a reward or an ambush as a crate.
    const tick = Array.from({ length: 400 }, (_, index) => index)
      .find((t) => getCampaignDestructionOutcome({ ...plain, tick: t }, 4, 6).kind !== 'nothing');
    expect(tick).toBeDefined();
    expect(getCampaignDestructionOutcome({ ...roomed, tick: tick! }, 4, 6))
      .toEqual({ kind: 'nothing' });
  });

  it('reveals the room secret on its floor once someone walks in, and only once', () => {
    let state = withRooms([scroll]);
    // Outside the shut room, at its cracked wall: nothing yet.
    state = standAt(state, 4, 7);
    expect(state.campaign!.discoveredSecrets).toEqual([]);
    expect(state.map[3][4]).toBe('Empty');

    state = { ...state, map: state.map.map((row) => [...row]) };
    state.map[6][4] = 'Empty';
    state = standAt(state, 4, 5);
    expect(state.campaign!.discoveredSecrets).toEqual(['test-scroll-cache']);
    expect(state.map[3][4]).toBe('Rasengan');
    expect(state.campaign!.message).toBe('Secret discovered: Test Scroll Cache.');

    // Picked up or not, walking back in never pays out again.
    state = { ...state, map: state.map.map((row) => [...row]) };
    state.map[3][4] = 'Empty';
    state = standAt(standAt(state, 4, 7), 4, 4);
    expect(state.map.flat().filter((cell) => cell === 'Rasengan')).toHaveLength(0);
  });

  it('wakes the burrow ambush at the far end when a player slips through the passage', () => {
    let state = withRooms([burrow]);
    // The passage is open floor: walking into it is how the room is found.
    state = standAt(state, 14, 4);
    expect(state.monsters).toHaveLength(0);

    state = standAt(state, 13, 4);
    const ambush = state.monsters.find((monster) => monster.id === 'test-zetsu-burrow-enemy');
    expect(ambush).toMatchObject({ archetype: 'blackZetsu' });
    // Never on top of the player: at least two steps away.
    expect(Math.abs(ambush!.x - 13) + Math.abs(ambush!.y - 4)).toBeGreaterThanOrEqual(2);
    expect(state.campaign!.discoveredSecrets).toEqual(['test-zetsu-burrow']);
  });
});
