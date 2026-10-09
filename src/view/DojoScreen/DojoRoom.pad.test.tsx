import { vi } from 'vitest';
import React from 'react';
import {
  act, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { GameEngineState } from '../../engine/types';

// The Training Dojo on the real engine, played from one pad: the room list,
// a room cleared with the d-pad, Start for the next room, and Skip room from
// the pause menu. The only stand-in is the 3D scene.

vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('../GameScreen/GameScreen');
  const { DojoRoomScreen } = await import('./DojoRoomScreen');
  return {
    ...actual,
    lazyScreen: (_chunk: unknown, name: string) => (
      name === 'DojoRoomScreen' ? DojoRoomScreen : GameScreen
    ),
  };
});

const sceneProps = vi.hoisted(() => ({
  liveState: null as null | (() => GameEngineState | null),
}));
vi.mock('../GameScreen/GameScene3D', () => ({
  GameScene3D: ({ liveState }: { liveState: () => GameEngineState | null }) => {
    sceneProps.liveState = liveState;
    return <div data-testid="scene" />;
  },
}));

type TestPad = {
  index: number;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
};

const A = 0;
const START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

let pads: TestPad[] = [];

// jsdom has no layout: the pause menu's two columns of buttons.
const LAYOUT: Record<string, [number, number, number, number]> = {
  Resume: [400, 270, 280, 48],
  Restart: [690, 270, 280, 48],
  'Skip room': [400, 330, 280, 48],
  Settings: [690, 330, 280, 48],
  'Quit Game': [400, 390, 280, 48],
};

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function hold(button: number, ms: number) {
  pads[0].buttons[button].pressed = true;
  wait(ms);
  pads[0].buttons[button].pressed = false;
  wait(40);
}

function tap(button: number) {
  hold(button, 20);
}

function live() {
  const state = sceneProps.liveState?.();
  if (!state) throw new Error('no room is running');
  return state;
}

function progress() {
  return JSON.parse(localStorage.getItem('shinobiDojoProgress') ?? '{}');
}

describe('the Training Dojo on one pad', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
        'setTimeout', 'clearTimeout', 'Date',
      ],
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function box(
      this: HTMLElement
    ) {
      const [x, y, width, height] = LAYOUT[this.textContent?.trim() ?? ''] ?? [0, 0, 0, 0];
      return {
        x,
        y,
        width,
        height,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      } as DOMRect;
    });
    pads = [{
      index: 0,
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    }];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => pads,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('starts, clears Lantern Walk with the d-pad, goes on with Start, and skips a room', () => {
    render(
      <MemoryRouter initialEntries={['/dojo']}>
        <App />
      </MemoryRouter>
    );
    act(() => {
      window.dispatchEvent(new Event('gamepadconnected'));
    });
    expect(screen.getByRole('button', { name: /start training/i })).toHaveFocus();
    tap(A);

    // Room 1: the goal line names the pad, then the d-pad walks the path;
    // each press is held until a wall stops it.
    const band = screen.getByRole('region', { name: 'dojo goal' });
    // One reading for screen readers: the goal, then the keys and the pad.
    expect(within(band).getByText('Walk to the lantern. Move: W A S D or D-pad'))
      .toBeInTheDocument();
    wait(3100); // the 3-2-1 freeze
    [DPAD_RIGHT, DPAD_DOWN, DPAD_RIGHT, DPAD_UP, DPAD_RIGHT, DPAD_DOWN, DPAD_LEFT]
      .forEach((direction) => hold(direction, 1600));
    expect(live().phase).toBe('game_over');
    const [ninja] = live().players;
    expect(ninja.alive).toBe(true);
    expect([Math.round(ninja.x), Math.round(ninja.y)]).toEqual([7, 3]);
    // Saved the moment it is cleared.
    expect(progress().cleared).toEqual(['lanternWalk']);

    wait(1300); // the hold on the deciding moment
    const debrief = screen.getByRole('dialog', { name: 'Lantern Walk cleared' });
    expect(debrief).toHaveTextContent('Old Willow');
    wait(700); // the debrief ignores input at first, like the round result
    tap(START);

    // Room 2 is a fresh match.
    expect(screen.getByRole('region', { name: 'dojo goal' })).toHaveTextContent('Room 2 of 4');
    expect(screen.getByRole('region', { name: 'dojo goal' })).toHaveTextContent('Pad A');
    wait(3100);
    expect(live().config.training?.roomId).toBe('fuseStep');

    // Skip it from the pause menu, pad only.
    tap(START);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    wait(700);
    tap(DPAD_DOWN);
    expect(screen.getByRole('button', { name: 'Skip room' })).toHaveFocus();
    tap(A);
    expect(screen.getByRole('region', { name: 'dojo goal' })).toHaveTextContent('Room 3 of 4');
    expect(progress()).toMatchObject({ cleared: ['lanternWalk'], skipped: ['fuseStep'] });
  });

  it('keeps a first-time player in play, and Start retries a room after a fall', () => {
    localStorage.removeItem('shinobiControlsGuideSeen');
    render(
      <MemoryRouter initialEntries={['/dojo/fuseStep']}>
        <App />
      </MemoryRouter>
    );
    act(() => {
      window.dispatchEvent(new Event('gamepadconnected'));
    });
    // The dojo prompts its own controls: no guide pausing the first room.
    expect(screen.queryByLabelText('controls guide')).not.toBeInTheDocument();
    wait(3100);
    expect(live().paused).toBe(false);

    tap(A); // a bomb at the player's feet, and no step away
    wait(3000);
    expect(live().players[0].alive).toBe(false);
    wait(1300);
    const debrief = screen.getByRole('dialog', { name: 'Caught' });
    expect(debrief).toHaveTextContent('leave its row and column');
    expect(progress().cleared ?? []).toEqual([]);
    wait(700);
    tap(START);
    expect(live()).toMatchObject({ phase: 'playing', bombs: [] });
    expect(live().players[0].alive).toBe(true);
  });
});
