import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';
import { GAME_PREFERENCES_KEY, GamePreferences } from './gamePreferences';

// The Stage scenery switch, reached from the pause menu's Settings the ways
// players reach it: a pad and the keyboard. The engine is a stub; the scene
// stand-in reports the preferences it is drawn with.

const engineMocks = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  restart: vi.fn(),
  dismissDialog: vi.fn(),
}));

vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('./GameScreen');
  return { ...actual, lazyScreen: () => GameScreen };
});

const scene = vi.hoisted(() => ({ preferences: null as GamePreferences | null }));
vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ preferences }: { preferences: GamePreferences }) => {
    scene.preferences = preferences;
    return <div data-testid="game-scene-3d" />;
  },
}));

const pausedState: GameEngineState = {
  ...createInitialState({
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: 'map1',
    map: parseMapRows(defaultMap),
  }),
  paused: true,
};

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const engine = testEngineStore(() => pausedState);
  const controls = {
    dispatch: vi.fn(),
    pause: engineMocks.pause,
    resume: engineMocks.resume,
    restart: engineMocks.restart,
    dismissDialog: engineMocks.dismissDialog,
  };
  return {
    useGameEngineStore: () => {
      engine.usePublish();
      return { store: engine.store, ...controls };
    },
    // The same engine for a screen that renders from the whole state.
    useGameEngine: () => ({ state: pausedState, ...controls }),
  };
});

type TestPad = {
  index: number;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
};
const A = 0;
const B = 1;
const DPAD_DOWN = 13;
let pads: TestPad[] = [];

function wait(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

function connectPad() {
  pads = [{
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  }];
  act(() => { window.dispatchEvent(new Event('gamepadconnected')); });
  wait(20);
}

function tap(button: number) {
  pads[0].buttons[button].pressed = true;
  wait(20);
  pads[0].buttons[button].pressed = false;
  wait(20);
}

// Settings at 1366x768: the switches in two columns, the new one starting
// the third row, then the slider rails.
const LAYOUT: Record<string, [number, number, number, number]> = {
  'Resume Game': [470, 200, 205, 48],
  'Reduce motion': [470, 370, 200, 38],
  'High contrast': [682, 370, 200, 38],
  'Stage scenery': [470, 410, 200, 38],
  'effects volume rail': [594, 460, 290, 34],
  'effects volume': [874, 467, 20, 20],
};

function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function box(
    this: HTMLElement
  ) {
    const input = this.classList.contains('MuiSlider-root') ? this.querySelector('input') : null;
    const key = input
      ? `${input.getAttribute('aria-label')} rail`
      : this.getAttribute('aria-label') ?? this.textContent?.trim() ?? '';
    const [x, y, width, height] = LAYOUT[key] ?? [0, 0, 0, 0];
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
}

const stored = (): Partial<GamePreferences> => (
  JSON.parse(localStorage.getItem(GAME_PREFERENCES_KEY) ?? '{}')
);

function openSettingsFromPause() {
  render(
    <MemoryRouter initialEntries={['/game/2/3/map1']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('Paused')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
  expect(screen.getByRole('heading', { name: 'Match Command' })).toBeInTheDocument();
  return screen.getByRole('checkbox', { name: 'Stage scenery' });
}

describe('the Stage scenery switch in the pause menu Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    // A device that would start with scenery on.
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify({ scenery: true }));
    Object.values(engineMocks).forEach((mock) => mock.mockClear());
    scene.preferences = null;
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    pads = [];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('is reached with the d-pad and flipped with A; the arena follows and the choice is kept', async () => {
    stubLayout();
    const scenery = openSettingsFromPause();
    expect(scenery).toBeChecked();
    expect(scene.preferences?.scenery).toBe(true);
    connectPad();

    screen.getByRole('checkbox', { name: 'Reduce motion' }).focus();
    tap(DPAD_DOWN);
    expect(scenery).toHaveFocus();
    tap(A);

    expect(screen.getByRole('checkbox', { name: 'Stage scenery' })).not.toBeChecked();
    expect(scene.preferences?.scenery).toBe(false);
    expect(stored().scenery).toBe(false);

    // B goes back to the pause menu; the game stays paused.
    tap(B);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Match Command' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(engineMocks.resume).not.toHaveBeenCalled();
  });

  it('is reached with Tab and flipped with Space', () => {
    const scenery = openSettingsFromPause();
    for (let presses = 0; presses < 30 && document.activeElement !== scenery; presses += 1) {
      userEvent.tab();
    }
    expect(scenery).toHaveFocus();

    userEvent.keyboard(' ');

    expect(scenery).not.toBeChecked();
    expect(scene.preferences?.scenery).toBe(false);
    expect(stored().scenery).toBe(false);
    expect(engineMocks.resume).not.toHaveBeenCalled();
  });
});
