import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows, parseMapText } from './mapLoader';
import { GameConfig, GameEngineState } from './types';

// An open yard with a walled arena in its south-east corner. G marks the
// two gate cells: walls until the arena opens.
const YARD = parseMapText(`
WWWWWWWWWWWWWWW
W             W
W             W
W             W
W             W
W      WWGWWWWW
W      W     WW
W      G     WW
W      W     WW
W      W     WW
WWWWWWWWWWWWWWW
`);

const config: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  selectedCharacters: ['naruto'],
  map: parseMapRows(YARD),
  seed: 5,
};

const GATES = [{ x: 9, y: 5 }, { x: 7, y: 7 }];

function arenaCampaign(): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    campaign: {
      ...state.campaign!,
      bossArena: {
        ...state.campaign!.bossArena,
        x: 10,
        y: 7,
        bounds: {
          x: 8, y: 6, width: 5, height: 4,
        },
        gates: GATES,
      },
    },
  };
}

// Every objective done: the next step unlocks the boss.
function clearObjectives(state: GameEngineState): GameEngineState {
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      objectives: state.campaign!.objectives.map((objective) => ({
        ...objective, status: 'complete',
      })),
    },
  };
}

describe('the walled boss arena', () => {
  it('keeps its gates shut while the mini boss gate stands', () => {
    let state = arenaCampaign();
    for (let step = 0; step < 4; step += 1) {
      state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
    }
    GATES.forEach((gate) => expect(state.map[gate.y][gate.x]).toBe('Wall'));
    expect(state.boss).toBeNull();
  });

  it('opens the gates and brings the boss in at the arena centre once cleared', () => {
    let state = clearObjectives(arenaCampaign());
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.campaign!.bossUnlocked).toBe(true);
    GATES.forEach((gate) => expect(state.map[gate.y][gate.x]).toBe('Empty'));
    expect(state.boss).toMatchObject({ x: 10, y: 7 });
    // The entrance still freezes the arena for the intro.
    expect(state.bossIntroMsRemaining).toBeGreaterThan(0);
    expect(state.campaign!.missionStep).toBe('boss');
  });

  it('shuts the gates again on a restart', () => {
    let state = clearObjectives(arenaCampaign());
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
    state = gameReducer(state, { type: 'RESTART' })!;
    GATES.forEach((gate) => expect(state.map[gate.y][gate.x]).toBe('Wall'));
  });
});
