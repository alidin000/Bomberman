import { act } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';
import { useGameEngine } from './useGameEngine';
import { DEFAULT_KEY_BINDINGS } from '../constants/props';
import { loadCampaignMapRows, parseMapRows } from '../engine/mapLoader';
import { GameConfig } from '../engine/types';

// Two shinobi on the leaf village's campaign map: P1 spawns at 1,1 with
// nothing in reach, P2 at 9,7, diagonal to Pell's stall at 10,6.
const config: GameConfig = {
  mode: 'solo',
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
  selectedCharacters: ['sasuke', 'naruto'],
  seed: 5,
  village: { reputationTier: 'stranger', embers: 30, offeredRequestIds: ['leaf-tea-tins'] },
};

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

describe('the bomb key in the village square', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the prop in reach instead of dropping a bomb', () => {
    const onSquareUse = vi.fn();
    const { result } = renderHook(
      () => useGameEngine(config, DEFAULT_KEY_BINDINGS, { onSquareUse })
    );
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.state!.phase).toBe('playing');

    // P1's bomb key ('2') with nothing in reach: no bomb, nothing opens.
    press('2');
    expect(result.current.state!.bombs).toHaveLength(0);
    expect(onSquareUse).not.toHaveBeenCalled();

    // P2's bomb key ('o') beside the stall opens it, and still no bomb.
    press('o');
    expect(result.current.state!.bombs).toHaveLength(0);
    expect(onSquareUse).toHaveBeenCalledTimes(1);
    expect(onSquareUse).toHaveBeenCalledWith('player2', expect.objectContaining({ id: 'shop', kind: 'shop' }));
  });
});
