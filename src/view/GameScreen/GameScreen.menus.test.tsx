import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';
import { RESULT_HOLD_MS } from './GameScreen';
import { RESULT_INPUT_LOCK_MS } from './RoundResultDialog';

// Menus on the game screen, driven the way players drive them: a pad, a
// mouse, a held Escape. The whole app is mounted so whatever listens for
// pads at the root is in play; the engine is a stub whose controls we watch.

const engineMocks = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  restart: vi.fn(),
  dismissDialog: vi.fn(),
}));

// These tests drive the match's menus, not the lazy route: render the game
// screen eagerly so App shows it on the first render.
vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('./GameScreen');
  return { ...actual, lazyScreen: () => GameScreen };
});

vi.mock('./GameScene3D', () => ({
  GameScene3D: () => <div data-testid="game-scene-3d" />,
}));

const baseState = createInitialState({
  numPlayers: 2,
  totalRounds: 3,
  selectedMap: 'map1',
  map: parseMapRows(defaultMap),
});
let currentState: GameEngineState = baseState;

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const engine = testEngineStore(() => currentState);
  return {
    useGameEngineStore: () => {
      engine.usePublish();
      return {
        store: engine.store,
        dispatch: vi.fn(),
        pause: engineMocks.pause,
        resume: engineMocks.resume,
        restart: engineMocks.restart,
        dismissDialog: engineMocks.dismissDialog,
      };
    },
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
const START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

let pads: TestPad[] = [];

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function connectPad() {
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

function tap(button: number) {
  pads[0].buttons[button].pressed = true;
  wait(20);
  pads[0].buttons[button].pressed = false;
  wait(20);
}

// jsdom has no layout. Give the named controls the boxes the real 2-column
// menus have (1366x768), so focus can move by direction.
const LAYOUT: Record<string, [number, number, number, number]> = {
  Resume: [400, 300, 280, 42],
  Restart: [690, 300, 280, 42],
  Settings: [400, 351, 280, 42],
  'Quit Game': [690, 351, 280, 42],
  Stay: [560, 420, 90, 48],
  'Restart Match': [660, 420, 150, 48],
  'Leave Match': [660, 420, 150, 48],
  'Resume Game': [470, 200, 205, 48],
};

function stubLayout() {
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
}

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/game/2/3/map1']}>
      <App />
    </MemoryRouter>
  );
}

// sRGB contrast ratio of two `rgb()`/`rgba()` strings, the second opaque.
function luminance([r, g, b]: number[]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}
function channels(color: string): number[] {
  return (color.match(/[\d.]+/g) ?? []).map(Number);
}
function over(top: string, base: number[]): number[] {
  const [r, g, b, alpha = 1] = channels(top);
  return [r, g, b].map((channel, i) => channel * alpha + base[i] * (1 - alpha));
}
function contrast(fg: number[], bg: number[]): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const PAPER_LIGHT = [0xff, 0xf8, 0xe7];

describe('game screen menus', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentState = baseState;
    Object.values(engineMocks).forEach((mock) => mock.mockClear());
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    pads = [];
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

  // The result opens RESULT_HOLD_MS after the round ends and then ignores
  // input for RESULT_INPUT_LOCK_MS, so these also fake timeouts and the clock.
  function showResult() {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'],
    });
    renderGame();
    connectPad();
    tap(START);
    wait(RESULT_HOLD_MS);
  }

  it('lets a pad continue from the round result with A, and with Start', () => {
    currentState = {
      ...baseState, phase: 'round_end', paused: true, roundWinners: [baseState.players[0].id],
    };
    showResult();
    expect(screen.getByRole('button', { name: 'Next Round' })).toHaveFocus();
    // Neither the hold nor a mash in the first moments of the dialog skips it.
    tap(A);
    tap(START);
    expect(engineMocks.dismissDialog).not.toHaveBeenCalled();
    wait(RESULT_INPUT_LOCK_MS);

    tap(A);
    expect(engineMocks.dismissDialog).toHaveBeenCalledTimes(1);

    tap(START);
    expect(engineMocks.dismissDialog).toHaveBeenCalledTimes(2);
    expect(engineMocks.restart).not.toHaveBeenCalled();
  });

  it('rematches with Start on the final result', () => {
    currentState = { ...baseState, phase: 'game_over', paused: true };
    showResult();
    tap(START);
    expect(engineMocks.restart).not.toHaveBeenCalled();
    wait(RESULT_INPUT_LOCK_MS);

    tap(START);

    expect(engineMocks.restart).toHaveBeenCalledTimes(1);
    expect(engineMocks.dismissDialog).not.toHaveBeenCalled();
  });

  it('lets a pad reach and press Resume, Restart and Quit, each risky one behind a confirm', async () => {
    stubLayout();
    currentState = { ...baseState, paused: true };
    renderGame();
    const pauseMenu = screen.getByRole('dialog', { name: /paused/i });
    expect(within(pauseMenu).getByRole('button', { name: 'Resume' })).toHaveFocus();
    connectPad();

    // Right to Restart: A asks first, B backs out without restarting.
    tap(DPAD_RIGHT);
    expect(within(pauseMenu).getByRole('button', { name: 'Restart' })).toHaveFocus();
    expect(within(pauseMenu).getByRole('button', { name: 'Restart' })).toHaveAttribute('data-pad-focus');
    tap(A);
    expect(screen.getByRole('dialog', { name: 'Restart The Match?' })).toBeInTheDocument();
    expect(engineMocks.restart).not.toHaveBeenCalled();
    tap(B);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Restart The Match?' })).not.toBeInTheDocument();
    });
    expect(engineMocks.restart).not.toHaveBeenCalled();
    expect(engineMocks.resume).not.toHaveBeenCalled();

    // Confirming it: A, right to "Restart Match", A.
    within(pauseMenu).getByRole('button', { name: 'Restart' }).focus();
    tap(A);
    tap(DPAD_RIGHT);
    expect(screen.getByRole('button', { name: 'Restart Match' })).toHaveFocus();
    tap(A);
    expect(engineMocks.restart).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Restart The Match?' })).not.toBeInTheDocument();
    });

    // Down to Quit Game, through its confirm, out to the title screen.
    within(pauseMenu).getByRole('button', { name: 'Restart' }).focus();
    tap(DPAD_DOWN);
    expect(within(pauseMenu).getByRole('button', { name: 'Quit Game' })).toHaveFocus();
    tap(A);
    expect(screen.getByRole('dialog', { name: 'Leave The Arena?' })).toBeInTheDocument();
    tap(DPAD_RIGHT);
    tap(A);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Explosive Shinobi Arena' })).toBeInTheDocument();
    });
  });

  it('resumes from the pause menu with A on Resume, B, or Start', () => {
    currentState = { ...baseState, paused: true };
    renderGame();
    connectPad();

    tap(A);
    tap(B);
    tap(START);

    expect(engineMocks.resume).toHaveBeenCalledTimes(3);
  });

  it('returns to the pause menu when B backs out of Settings opened from it', async () => {
    stubLayout();
    currentState = { ...baseState, paused: true };
    renderGame();
    connectPad();

    tap(DPAD_DOWN);
    expect(screen.getByRole('button', { name: /^settings$/i })).toHaveFocus();
    tap(A);
    expect(screen.getByRole('heading', { name: 'Match Command' })).toBeInTheDocument();

    tap(B);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Match Command' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(engineMocks.resume).not.toHaveBeenCalled();
  });

  it('returns to the pause menu when B backs out of the key dialog opened from it', async () => {
    currentState = { ...baseState, paused: true };
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    fireEvent.click(screen.getByRole('button', { name: /modify controls/i }));
    expect(await screen.findByRole('heading', { name: /modify controls/i })).toBeInTheDocument();
    connectPad();

    tap(B);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /modify controls/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(engineMocks.resume).not.toHaveBeenCalled();
  });

  it('closes the first-run controls guide with B and gives play back', () => {
    localStorage.removeItem('shinobiControlsGuideSeen');
    renderGame();
    expect(screen.getByLabelText('controls guide')).toBeInTheDocument();
    connectPad();

    tap(B);

    expect(screen.queryByLabelText('controls guide')).not.toBeInTheDocument();
    expect(engineMocks.resume).toHaveBeenCalledTimes(1);
  });

  it('keeps a held Escape from resuming play after it closed Settings', async () => {
    currentState = { ...baseState, paused: true };
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    const settings = screen.getByRole('dialog', { name: 'Match Command' });

    fireEvent.keyDown(settings, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Match Command' })).not.toBeInTheDocument();
    });
    // The key is still down: the browser repeats it at the pause menu.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resume' }), { key: 'Escape', repeat: true });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resume' }), { key: 'Escape', repeat: true });

    expect(engineMocks.resume).not.toHaveBeenCalled();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('lets a pad change Settings: A flips a switch, left and right step a slider', () => {
    currentState = { ...baseState, paused: true };
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    connectPad();

    const reduceMotion = screen.getByRole('checkbox', { name: 'Reduce motion' });
    expect(reduceMotion).not.toBeChecked();
    reduceMotion.focus();
    tap(A);
    expect(screen.getByRole('checkbox', { name: 'Reduce motion' })).toBeChecked();
    // The ring sits on the whole row, not the invisible input.
    expect(reduceMotion.closest('label')).toHaveAttribute('data-pad-focus');

    const hudSize = screen.getByRole('slider', { name: 'HUD size' });
    expect(hudSize).toHaveValue('100');
    hudSize.focus();
    tap(DPAD_RIGHT);
    expect(screen.getByRole('slider', { name: 'HUD size' })).toHaveValue('105');
    tap(DPAD_LEFT);
    tap(DPAD_LEFT);
    expect(screen.getByRole('slider', { name: 'HUD size' })).toHaveValue('95');
  });

  it('walks down Settings one row at a time, sliders included, whatever their values', () => {
    // Settings at 1366x768: switches in two columns, then three slider rails.
    // A slider's input sits in its thumb, placed by value, so HUD size (at
    // 44%) is nearer the left column than the other two thumbs (at 100%).
    const rows: Record<string, [number, number, number, number]> = {
      'Resume Game': [470, 200, 205, 48],
      'Modify Controls': [470, 258, 205, 48],
      'Sound effects': [470, 330, 200, 38],
      'Sound captions': [682, 330, 200, 38],
      'Reduce motion': [470, 370, 200, 38],
      'High contrast': [682, 370, 200, 38],
      'effects volume rail': [594, 420, 290, 34],
      'screen shake rail': [594, 456, 290, 34],
      'HUD size rail': [594, 492, 290, 34],
      'effects volume': [874, 427, 20, 20],
      'screen shake': [874, 463, 20, 20],
      'HUD size': [712, 499, 20, 20],
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function box(
      this: HTMLElement
    ) {
      const input = this.classList.contains('MuiSlider-root') ? this.querySelector('input') : null;
      const key = input
        ? `${input.getAttribute('aria-label')} rail`
        : this.getAttribute('aria-label') ?? this.textContent?.trim() ?? '';
      const [x, y, width, height] = rows[key] ?? [0, 0, 0, 0];
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
    currentState = { ...baseState, paused: true };
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    connectPad();

    screen.getByRole('checkbox', { name: 'Reduce motion' }).focus();
    tap(DPAD_DOWN);
    expect(screen.getByRole('slider', { name: 'effects volume' })).toHaveFocus();
    tap(DPAD_DOWN);
    expect(screen.getByRole('slider', { name: 'screen shake' })).toHaveFocus();
    tap(DPAD_DOWN);
    expect(screen.getByRole('slider', { name: 'HUD size' })).toHaveFocus();
    tap(DPAD_UP);
    tap(DPAD_UP);
    tap(DPAD_UP);
    // Back up past the rails to the switch above their centre.
    expect(screen.getByRole('checkbox', { name: 'High contrast' })).toHaveFocus();
  });

  it('asks before Settings restarts or quits the match', async () => {
    currentState = { ...baseState, paused: true };
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));

    fireEvent.click(screen.getByRole('button', { name: /restart same setup/i }));
    expect(engineMocks.restart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restart Match' }));
    expect(engineMocks.restart).toHaveBeenCalledTimes(1);

    // Settings closed with the restart; the pause menu is back once it fades.
    fireEvent.click(await screen.findByRole('button', { name: /^settings$/i }));
    fireEvent.click(screen.getByRole('button', { name: /quit game/i }));
    expect(screen.getByRole('dialog', { name: 'Leave The Arena?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
  });

  it('puts the pause menu above the top controls and makes them inert while paused', () => {
    currentState = { ...baseState, paused: true };
    renderGame();

    const bar = screen.getByRole('button', { name: 'resume game' }).parentElement as HTMLElement;
    const pauseMenu = screen.getByRole('dialog', { name: /paused/i });
    expect(bar).toHaveAttribute('inert');
    expect(Number(getComputedStyle(pauseMenu).zIndex))
      .toBeGreaterThan(Number(getComputedStyle(bar).zIndex));
  });

  it('leaves the top controls live during play', () => {
    renderGame();

    const bar = screen.getByRole('button', { name: 'pause game' }).parentElement as HTMLElement;
    expect(bar).not.toHaveAttribute('inert');
  });

  it('draws Quit Game at 4.5:1 or better in the pause menu and in Settings', () => {
    currentState = { ...baseState, paused: true };
    renderGame();

    const pauseQuit = screen.getByRole('button', { name: /quit game/i });
    expect(contrast(channels(getComputedStyle(pauseQuit).color), PAPER_LIGHT))
      .toBeGreaterThanOrEqual(4.5);

    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    const settingsQuit = within(screen.getByRole('dialog', { name: 'Match Command' }))
      .getByRole('button', { name: /quit game/i });
    const style = getComputedStyle(settingsQuit);
    const fill = over(style.backgroundColor || 'rgba(0, 0, 0, 0)', PAPER_LIGHT);
    expect(contrast(channels(style.color), fill)).toBeGreaterThanOrEqual(4.5);
  });
});
