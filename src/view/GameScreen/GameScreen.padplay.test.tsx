import { vi } from 'vitest';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { GameEngineState } from '../../engine/types';

// A real match on the real engine, played and paused from one pad. The only
// stand-in is the 3D scene, which reports what it would draw.

// These tests drive the match's menus, not the lazy route: render the game
// screen eagerly so App shows it on the first render.
vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('./GameScreen');
  return { ...actual, lazyScreen: () => GameScreen };
});

// The scene's `state` prop skips movement-only frames (the real scene draws
// those from the motion store), so the stand-in reads the live engine state.
const sceneProps = vi.hoisted(() => ({
  liveState: null as null | (() => GameEngineState | null),
}));
vi.mock('./GameScene3D', () => ({
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
const B = 1;
const START = 9;
const DPAD_RIGHT = 15;

let pads: TestPad[] = [];

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function hold(button: number, pressed: boolean) {
  pads[0].buttons[button].pressed = pressed;
  wait(20);
}

function tap(button: number) {
  hold(button, true);
  hold(button, false);
}

function scene() {
  screen.getByTestId('scene');
  const state = sceneProps.liveState?.();
  if (!state) throw new Error('the match has not started');
  return { bombs: state.bombs.length, x: state.players[0].x, y: state.players[0].y };
}

function startMatch() {
  render(
    <MemoryRouter initialEntries={['/game/2/1/map1']}>
      <App />
    </MemoryRouter>
  );
  wait(3100); // the round-start countdown
  pads = [{
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  }];
  act(() => {
    window.dispatchEvent(new Event('gamepadconnected'));
  });
  wait(20);
}

describe('one pad playing and pausing a real match', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', selectedCharacters: ['sasuke', 'naruto'],
    }));
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => pads,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('pauses on Start, resumes on A, and the A that resumed plants no bomb', () => {
    startMatch();

    tap(START);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    wait(700); // past the hand-off pause that swallows mashed presses

    hold(A, true);
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
    wait(200);
    hold(A, false);
    expect(scene().bombs).toBe(0);

    // The next press is a game press again.
    tap(A);
    expect(scene().bombs).toBe(1);
  });

  it('backs out with B without detonating, and a d-pad press in the menu never walks', () => {
    startMatch();
    const before = scene();

    tap(START);
    wait(700);
    // Right in the menu moves focus; held while B resumes, it must not then
    // carry the ninja across the arena.
    hold(DPAD_RIGHT, true);
    tap(B);
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
    wait(400);
    hold(DPAD_RIGHT, false);

    expect(scene().x).toBe(before.x);
    expect(scene().y).toBe(before.y);

    // The same press in play does walk: the arena is open to the right.
    hold(DPAD_RIGHT, true);
    wait(400);
    hold(DPAD_RIGHT, false);
    expect(scene().x).toBeGreaterThan(before.x);
  });

  it('ignores a mashed A for a moment after the match hands the pad to a menu', () => {
    startMatch();

    tap(START);
    tap(A); // within the hand-off pause: swallowed, Resume stays focused
    expect(screen.getByText('Paused')).toBeInTheDocument();
    wait(700);
    tap(A);
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
    expect(scene().bombs).toBe(0);
  });
});
