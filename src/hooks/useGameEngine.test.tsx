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

function press(type: 'keydown' | 'keyup', key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key }));
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useGameEngine keyboard input', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function startMatch() {
    const hook = renderHook(() => useGameEngine(config, DEFAULT_KEY_BINDINGS));
    wait(3100);
    return hook;
  }

  it('moves both players at once while each holds a direction', () => {
    const { result } = startMatch();
    const [p1, p2] = result.current.state!.players;

    press('keydown', 'd');
    press('keydown', 'ArrowLeft');
    wait(300);

    expect(result.current.state!.players[0].x).toBeGreaterThan(p1.x + 0.5);
    expect(result.current.state!.players[1].x).toBeLessThan(p2.x - 0.5);
  });

  it('keeps going in a still-held direction after the newer key is released', () => {
    const { result } = startMatch();

    press('keydown', 'ArrowLeft');
    wait(100);
    press('keydown', 'ArrowUp');
    wait(100);
    press('keyup', 'ArrowUp');
    const xAtRelease = result.current.state!.players[1].x;
    wait(300);

    expect(result.current.state!.players[1].x).toBeLessThan(xAtRelease - 0.5);

    press('keyup', 'ArrowLeft');
    const xStopped = result.current.state!.players[1].x;
    wait(300);
    expect(result.current.state!.players[1].x).toBe(xStopped);
  });
});

const pillarArena = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));
const pillarConfig: GameConfig = { ...config, map: pillarArena };

describe('useGameEngine buffered turns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function startPillarMatch() {
    const hook = renderHook(() => useGameEngine(pillarConfig, DEFAULT_KEY_BINDINGS));
    wait(3100);
    return hook;
  }

  function walkRightUntil(result: { current: ReturnType<typeof useGameEngine> }, x: number) {
    press('keydown', 'd');
    for (let frame = 0; frame < 120 && result.current.state!.players[0].x < x; frame += 1) wait(16);
    return result.current.state!.players[0].x;
  }

  it('turns at the next opening when the turn is pressed early with the old key still held', () => {
    const { result } = startPillarMatch();
    const xAtPress = walkRightUntil(result, 1.6);
    expect(xAtPress).toBeLessThan(2.1); // nearest lane is the blocked pillar column

    press('keydown', 's');
    wait(800);

    expect(result.current.state!.players[0].x).toBe(3);
    expect(result.current.state!.players[0].y).toBeGreaterThan(2);
  });

  it('still lands a turn pressed just after releasing the old direction', () => {
    const { result } = startPillarMatch();
    const xAtPress = walkRightUntil(result, 2.25);
    expect(xAtPress).toBeLessThan(2.55); // outside the lane-snap window of x=3

    press('keyup', 'd');
    press('keydown', 's');
    wait(600);

    expect(result.current.state!.players[0].x).toBe(3);
    expect(result.current.state!.players[0].y).toBeGreaterThan(2);
  });
});
