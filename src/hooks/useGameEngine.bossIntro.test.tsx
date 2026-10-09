import { act } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';
import { useGameEngine } from './useGameEngine';
import { DEFAULT_KEY_BINDINGS } from '../constants/props';
import { parseMapRows } from '../engine/mapLoader';
import { GameConfig, GameEngineState } from '../engine/types';

// Any action key (A on a pad, which presses the bomb key) skips the boss's
// entrance; direction keys do not, and nothing lands while it plays.

// A match that opens on the boss's entrance, as if the arena had just opened.
vi.mock('../engine/initialState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/initialState')>();
  return {
    ...actual,
    createInitialState: (config: GameConfig): GameEngineState => {
      const state = actual.createInitialState(config);
      return {
        ...state,
        roundStartTicksRemaining: 0,
        monsters: [],
        boss: actual.createBossForConfig({ ...config, map: state.map }),
        // Past the first moment, which cannot be skipped.
        bossIntroMsRemaining: 2000,
      };
    },
  };
});

const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const config: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenSand',
  stageId: 'hiddenSand',
  selectedCharacters: ['gaara'],
  map: openStage,
  seed: 2,
};

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

describe('useGameEngine during the boss intro', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the intro on an action key and ignores direction keys meanwhile', () => {
    const { result } = renderHook(() => useGameEngine(config, DEFAULT_KEY_BINDINGS));
    const start = result.current.state!;
    expect(start.bossIntroMsRemaining).toBe(2000);

    press('d');
    expect(result.current.state!.bossIntroMsRemaining).toBe(2000);
    expect(result.current.state!.players[0].x).toBe(start.players[0].x);

    // P1's bomb key (a pad's A): the fight starts, and the press drops no bomb.
    press('2');
    const skipped = result.current.state!;
    expect(skipped.bossIntroMsRemaining).toBe(0);
    expect(skipped.bombs).toHaveLength(0);

    // The next press plays normally.
    press('2');
    expect(result.current.state!.bombs.length).toBeGreaterThan(0);
  });
});
