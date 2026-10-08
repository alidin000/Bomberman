import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { GameConfig, GameEngineState } from './types';

const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const campaignConfig: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  selectedCharacters: ['naruto'],
  map: openStage,
  seed: 7,
};

function liveCampaign(): GameEngineState {
  return { ...createInitialState(campaignConfig), roundStartTicksRemaining: 0 };
}

describe('campaign objectives between events', () => {
  it('keeps the campaign and monsters when a movement step reaches no objective', () => {
    const state = liveCampaign();
    const player = state.players[0];

    const next = gameReducer(state, { type: 'MOVE', playerId: player.id, direction: 'right' })!;

    expect(next.players[0].x).toBeGreaterThan(player.x);
    // Same objects, so the HUD and scene can skip the step (useRenderState).
    expect(next.campaign).toBe(state.campaign);
    expect(next.monsters).toBe(state.monsters);
  });

  it('still updates the campaign when a step reaches a rescue target', () => {
    const state = liveCampaign();
    const rescue = state.campaign!.objectives.find((objective) => objective.kind === 'rescue')!;
    const target = rescue.targets![0];
    const beside = {
      ...state,
      players: state.players.map((p) => ({ ...p, x: target.x - 0.8, y: target.y })),
    };

    const next = gameReducer(beside, { type: 'MOVE', playerId: state.players[0].id, direction: 'right' })!;

    const updated = next.campaign!.objectives.find((objective) => objective.id === rescue.id)!;
    expect(updated.current).toBe(rescue.current + 1);
    expect(updated.targets!.find((item) => item.id === target.id)!.rescued).toBe(true);
  });
});
