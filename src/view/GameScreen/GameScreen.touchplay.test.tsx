import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { GameEngineState } from '../../engine/types';
import { setTouchMode } from '../../input/touchMode';
import { reloadTouchPreferences, TOUCH_PREFERENCES_KEY } from '../../input/touchPreferences';

// A real match on the real engine, played with the touch controls. The only
// stand-in is the 3D scene, which hands over the live engine state.

vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('./GameScreen');
  return { ...actual, lazyScreen: () => GameScreen };
});

const sceneProps = vi.hoisted(() => ({
  liveState: null as null | (() => GameEngineState | null),
}));
vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ liveState }: { liveState: () => GameEngineState | null }) => {
    sceneProps.liveState = liveState;
    return <div data-testid="scene" />;
  },
}));

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function live() {
  const state = sceneProps.liveState?.();
  if (!state) throw new Error('the match has not started');
  return state;
}

const controls = () => document.querySelector('[data-touch-controls]');
const pad = () => document.querySelector('[data-touch-pad]') as HTMLElement;
const button = (id: string) => document.querySelector(`[data-touch-button="${id}"]`) as HTMLElement;

// The first touch anywhere brings the controls up (no user-agent sniffing).
function touchScreen() {
  fireEvent.pointerDown(document.body, { pointerType: 'touch', pointerId: 99 });
  fireEvent.pointerUp(document.body, { pointerType: 'touch', pointerId: 99 });
}

function thumb(type: 'down' | 'move' | 'up', x: number, y: number) {
  const init = {
    pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true,
  };
  if (type === 'down') fireEvent.pointerDown(pad(), init);
  else if (type === 'move') fireEvent.pointerMove(pad(), init);
  else fireEvent.pointerUp(pad(), init);
}

function startMatch() {
  render(
    <MemoryRouter initialEntries={['/game/2/1/map1']}>
      <App />
    </MemoryRouter>
  );
  touchScreen();
  wait(3100); // the round-start countdown
}

describe('touch controls playing a real match', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', selectedCharacters: ['sasuke', 'naruto'],
    }));
    setTouchMode(false);
    reloadTouchPreferences();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks P1 with the pad and plants a bomb with the bomb button', () => {
    startMatch();
    expect(controls()).not.toBeNull();
    const start = live().players[0];

    // Inside the dead zone nothing moves.
    thumb('down', 100, 600);
    thumb('move', 106, 603);
    wait(300);
    expect(live().players[0].x).toBe(start.x);

    // Past it, to the right: the arena is open along the top row.
    thumb('move', 140, 604);
    wait(300);
    const walked = live().players[0];
    expect(walked.x).toBeGreaterThan(start.x);
    expect(walked.y).toBe(start.y);

    // Lifting the thumb stops the walk.
    thumb('up', 140, 604);
    wait(50);
    const stopped = live().players[0].x;
    wait(300);
    expect(live().players[0].x).toBe(stopped);

    // A press of the bomb button is one bomb, on P1's cell.
    fireEvent.pointerDown(button('bomb'), { pointerId: 2, pointerType: 'touch' });
    expect(button('bomb')).toHaveAttribute('data-pressed');
    fireEvent.pointerUp(button('bomb'), { pointerId: 2, pointerType: 'touch' });
    expect(button('bomb')).not.toHaveAttribute('data-pressed');
    const { bombs } = live();
    expect(bombs).toHaveLength(1);
    expect(bombs[0].ownerId).toBe(live().players[0].id);
  });

  it('turns through the engine: a slide from right to down takes the opening below', () => {
    startMatch();
    // Right along the top row, then the thumb rolls down: the turn is
    // buffered while P1 is between cells, and taken at the next opening.
    thumb('down', 100, 600);
    thumb('move', 130, 600);
    wait(120);
    thumb('move', 128, 640);
    wait(600);
    thumb('up', 128, 640);
    const player = live().players[0];
    expect(player.y).toBeGreaterThan(1.5);
    expect(player.x).toBeGreaterThan(1);
  });

  it('puts the controls away when a keyboard is used, and back on the next touch', () => {
    startMatch();
    expect(controls()).not.toBeNull();

    fireEvent.keyDown(window, { key: 'd' });
    fireEvent.keyUp(window, { key: 'd' });
    expect(controls()).toBeNull();
    expect(document.documentElement).toHaveAttribute('data-touch', 'off');

    touchScreen();
    expect(controls()).not.toBeNull();
    expect(document.documentElement).toHaveAttribute('data-touch', 'on');
  });

  it('puts the controls away when a gamepad plays', () => {
    const gamepad = {
      index: 0,
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [gamepad] });
    try {
      startMatch();
      expect(controls()).not.toBeNull();
      act(() => {
        window.dispatchEvent(new Event('gamepadconnected'));
      });
      gamepad.buttons[0].pressed = true; // A: P1's bomb
      wait(20);
      expect(live().bombs).toHaveLength(1);
      expect(controls()).toBeNull();
    } finally {
      delete (navigator as { getGamepads?: unknown }).getGamepads;
    }
  });

  it('lets go of a held direction when the pause menu opens', () => {
    startMatch();
    thumb('down', 100, 600);
    thumb('move', 140, 600);
    wait(100);
    fireEvent.click(screen.getByRole('button', { name: 'pause game' }));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    const resumedAt = live().players[0].x;
    wait(400);
    // The thumb never lifted, but the menu released it: no walking on.
    expect(live().players[0].x).toBe(resumedAt);
  });

  it('buzzes on a press only with Vibration on', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    try {
      startMatch();
      fireEvent.pointerDown(button('bomb'), { pointerId: 2, pointerType: 'touch' });
      fireEvent.pointerUp(button('bomb'), { pointerId: 2, pointerType: 'touch' });
      expect(vibrate).not.toHaveBeenCalled();

      localStorage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify({ vibration: true }));
      act(() => reloadTouchPreferences());
      fireEvent.pointerDown(button('bomb'), { pointerId: 3, pointerType: 'touch' });
      expect(vibrate).toHaveBeenCalledWith(10);
    } finally {
      delete (navigator as { vibrate?: unknown }).vibrate;
    }
  });
});
