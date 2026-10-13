import { act } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { createInitialState } from '../../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../../engine/mapLoader';
import type { GameEngineState } from '../../../engine/types';
import { createEngineStore } from '../../../hooks/engineStore';
import { loadStoryProgress, saveStoryProgress } from '../../../story/progress';
import { useStallSpendSaver } from './useStallSpendSaver';

function withSpend(state: GameEngineState, embersSpent: number): GameEngineState {
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      village: { requests: [], purchases: embersSpent ? ['fusePouch'] : [], embersSpent },
    },
  };
}

describe('the village stall spend', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is saved the moment the match shows it, and a reload starts with what is left', () => {
    saveStoryProgress({ ...loadStoryProgress(), currency: 70 });
    const village = { reputationTier: 'stranger' as const, embers: 70, offeredRequestIds: [] };
    localStorage.setItem('gameSetup', JSON.stringify({ mode: 'solo', stageId: 'hiddenLeaf', village }));
    const start = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
      seed: 3,
      village,
    });
    const store = createEngineStore();
    act(() => store.publish(start));
    renderHook(() => useStallSpendSaver(store));
    expect(loadStoryProgress().currency).toBe(70);

    act(() => store.publish(withSpend(start, 25)));
    expect(loadStoryProgress().currency).toBe(45);
    expect(JSON.parse(localStorage.getItem('gameSetup') as string).village.embers).toBe(45);
    // Later frames with the same spend take nothing more.
    act(() => store.publish({ ...withSpend(start, 25), tick: start.tick + 1 }));
    expect(loadStoryProgress().currency).toBe(45);
  });
});
