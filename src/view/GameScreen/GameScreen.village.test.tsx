import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { GameEngineState } from '../../engine/types';
import { loadCampaignMapRows } from '../../engine/mapLoader';
import { setTouchMode } from '../../input/touchMode';

// A real solo mission in the leaf village's square, on the real engine. The
// only stand-in is the 3D scene. Walk beside Wren (4,1), press the bomb key
// or A, and her talk opens over a paused match with no bomb dropped.

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

type TestPad = {
  index: number;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
};
const A = 0;
const B = 1;
const DPAD_RIGHT = 15;
let pads: TestPad[] = [];

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function live(): GameEngineState {
  const state = sceneProps.liveState?.();
  if (!state) throw new Error('the match has not started');
  return state;
}

function key(type: 'keydown' | 'keyup', name: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: name }));
  });
}

// Walk right until the ninja stands on cell x 3, beside Wren.
function walkBesideWren(press: (down: boolean) => void) {
  press(true);
  for (let step = 0; step < 60 && Math.round(live().players[0].x) < 3; step += 1) wait(20);
  press(false);
  wait(200);
  expect(Math.round(live().players[0].x)).toBe(3);
}

function startMission() {
  render(
    <MemoryRouter initialEntries={['/game/1/1/hiddenLeaf']}>
      <App />
    </MemoryRouter>
  );
  wait(3100); // the round-start countdown
}

describe('using the village square in a solo mission', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    localStorage.setItem('selectedMap', JSON.stringify(loadCampaignMapRows('hiddenLeaf')));
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'solo',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      village: { reputationTier: 'stranger', embers: 40, offeredRequestIds: ['leaf-tea-tins'] },
    }));
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('opens talk on the bomb key, paused and without a bomb, and Escape plays on', () => {
    startMission();
    expect(live().config.village).toEqual({
      reputationTier: 'stranger', embers: 40, offeredRequestIds: ['leaf-tea-tins'],
    });
    walkBesideWren((down) => key(down ? 'keydown' : 'keyup', 'd'));

    key('keydown', '2');
    key('keyup', '2');
    expect(screen.getByRole('dialog', { name: 'Wren' })).toBeInTheDocument();
    expect(live().paused).toBe(true);
    expect(live().bombs).toHaveLength(0);
    // The pause menu stays out of the way of the talk.
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();

    key('keydown', 'Escape');
    expect(screen.queryByRole('dialog', { name: 'Wren' })).not.toBeInTheDocument();
    expect(live().paused).toBe(false);
  });

  it('reaches the square with a pad: A opens the prop, B closes it', () => {
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
    startMission();
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
    const hold = (button: number, pressed: boolean) => {
      pads[0].buttons[button].pressed = pressed;
      wait(20);
    };
    walkBesideWren((down) => hold(DPAD_RIGHT, down));

    hold(A, true);
    hold(A, false);
    const talk = screen.getByRole('dialog', { name: 'Wren' });
    expect(live().bombs).toHaveLength(0);
    wait(700); // the menus' hand-off pause
    // The first reply has focus: A asks it.
    hold(A, true);
    hold(A, false);
    expect(talk).toHaveTextContent('You: Anything hidden nearby?');
    hold(B, true);
    hold(B, false);
    expect(screen.queryByRole('dialog', { name: 'Wren' })).not.toBeInTheDocument();
    expect(live().paused).toBe(false);
  });

  it('reaches the square by touch: the bomb button opens the prop, a tap plays on', () => {
    setTouchMode(false);
    startMission();
    walkBesideWren((down) => key(down ? 'keydown' : 'keyup', 'd'));
    // A touch brings the controls up (a key press would put them away).
    fireEvent.pointerDown(document.body, { pointerType: 'touch', pointerId: 99 });
    fireEvent.pointerUp(document.body, { pointerType: 'touch', pointerId: 99 });
    const bomb = document.querySelector('[data-touch-button="bomb"]') as HTMLElement;
    fireEvent.pointerDown(bomb, { pointerId: 2, pointerType: 'touch' });
    fireEvent.pointerUp(bomb, { pointerId: 2, pointerType: 'touch' });
    expect(screen.getByRole('dialog', { name: 'Wren' })).toBeInTheDocument();
    expect(live().bombs).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Goodbye' }));
    expect(screen.queryByRole('dialog', { name: 'Wren' })).not.toBeInTheDocument();
    expect(live().paused).toBe(false);
    setTouchMode(false);
  });
});
