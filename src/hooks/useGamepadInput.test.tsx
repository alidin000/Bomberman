import { act } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';
import { useGameEngine } from './useGameEngine';
import { DEFAULT_KEY_BINDINGS } from '../constants/props';
import { parseMapRows } from '../engine/mapLoader';
import { GameConfig } from '../engine/types';

const openArena = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const config: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: openArena,
  selectedCharacters: ['sasuke', 'naruto'],
  seed: 1,
};

type TestPad = {
  index: number;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
};

function createPad(index: number): TestPad {
  return {
    index,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useGameEngine gamepad input', () => {
  let pads: (TestPad | null)[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    pads = [];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => pads,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  function startMatch() {
    const hook = renderHook(() => useGameEngine(config, DEFAULT_KEY_BINDINGS));
    wait(3100);
    pads = [createPad(0), createPad(1)];
    act(() => {
      window.dispatchEvent(new Event('gamepadconnected'));
    });
    return hook;
  }

  it('moves each player with their own pad, by d-pad or stick', () => {
    const { result } = startMatch();
    const [p1, p2] = result.current.state!.players;

    pads[0]!.buttons[15].pressed = true; // d-pad right
    pads[1]!.axes[0] = -1; // left stick fully left
    wait(300);

    expect(result.current.state!.players[0].x).toBeGreaterThan(p1.x + 0.5);
    expect(result.current.state!.players[1].x).toBeLessThan(p2.x - 0.5);

    pads[0]!.buttons[15].pressed = false;
    wait(50);
    const stoppedAt = result.current.state!.players[0].x;
    wait(300);
    expect(result.current.state!.players[0].x).toBe(stoppedAt);
  });

  it('plants a bomb for the pad owner on the face button', () => {
    const { result } = startMatch();

    pads[0]!.buttons[0].pressed = true;
    wait(50);

    const { bombs } = result.current.state!;
    expect(bombs).toHaveLength(1);
    expect(bombs[0].ownerId).toBe(result.current.state!.players[0].id);
  });
});
