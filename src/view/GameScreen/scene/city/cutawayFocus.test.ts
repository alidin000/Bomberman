import { arenaMapRows } from '../../../../content/arenaMaps';
import { createInitialState } from '../../../../engine/initialState';
import { parseMapRows } from '../../../../engine/mapLoader';
import type { GameEngineState } from '../../../../engine/types';
import { cutawayFocus } from './CityBuildings';

function arenaState(): GameEngineState {
  return createInitialState({
    mode: 'local',
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto', 'sasuke'],
    map: parseMapRows(arenaMapRows('hiddenLeaf')),
  });
}

const cells = (focus: { x: number; y: number }[]) => new Set(focus.map(({ x, y }) => `${x},${y}`));

describe('what the cut-away keeps in view', () => {
  it('follows a bomb\'s blast lines up to the first wall, and the pickups on the map', () => {
    const start = arenaState();
    const map = start.map.map((row) => [...row]);
    // Row 1 of the Leaf arena: open from x=1; put a wall at x=5 and a pickup at (2,3).
    map[1][5] = 'Wall';
    map[3][2] = 'AddBomb';
    const bomb = { x: 2, y: 1, range: 4 } as GameEngineState['bombs'][number];
    const state: GameEngineState = { ...start, map, bombs: [bomb] };
    const focus = cells(cutawayFocus(state));
    expect(focus.has('3,1')).toBe(true);
    expect(focus.has('4,1')).toBe(true);
    // The wall stops the blast: nothing past it.
    expect(focus.has('5,1')).toBe(false);
    expect(focus.has('6,1')).toBe(false);
    expect(focus.has('2,3')).toBe(true);
  });

  it('under fog, counts only what is in sight', () => {
    const state = arenaState();
    const [p1, p2] = state.players;
    const seen = new Set([`${p1.x},${p1.y}`]);
    const focus = cells(cutawayFocus(state, seen));
    expect(focus.has(`${p1.x},${p1.y}`)).toBe(true);
    expect(focus.has(`${p2.x},${p2.y}`)).toBe(false);
  });
});
