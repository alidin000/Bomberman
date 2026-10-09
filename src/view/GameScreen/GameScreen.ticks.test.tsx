import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { GameEngineState } from '../../engine/types';
import { VERSUS_ROUND_MS } from '../../engine/suddenDeath';
import { RESULT_HOLD_MS } from './GameScreen';
import { RESULT_INPUT_LOCK_MS } from './RoundResultDialog';

// What re-renders on the page while a real match ticks. A stand-in for the
// React DevTools hook sees every commit and lists the components that ran
// in it, and which of them sat highest (the one whose update started it).

type Fiber = {
  tag: number;
  type: unknown;
  flags: number;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
};

const devtools = vi.hoisted(() => {
  // Function, class, forwardRef, memo and simple memo components.
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
  const PERFORMED_WORK = 1;
  const log = { on: false, rendered: [] as string[], tops: [] as string[] };
  const nameOf = (fiber: Fiber): string => {
    const type = fiber.type as {
      displayName?: string;
      name?: string;
      render?: { displayName?: string; name?: string };
      type?: { displayName?: string; name?: string };
    };
    return type.displayName || type.name || type.render?.displayName || type.render?.name
      || type.type?.displayName || type.type?.name || 'anonymous';
  };
  const walk = (root: Fiber) => {
    const stack: [Fiber, boolean][] = [[root, false]];
    while (stack.length) {
      const [fiber, underRendered] = stack.pop() as [Fiber, boolean];
      const { alternate: previous } = fiber;
      // eslint-disable-next-line no-bitwise -- React's fiber flags are a bit set.
      const performed = (fiber.flags & PERFORMED_WORK) !== 0;
      const ran = COMPONENT_TAGS.has(fiber.tag) && (!previous || performed);
      if (ran) {
        log.rendered.push(nameOf(fiber));
        if (!underRendered) log.tops.push(nameOf(fiber));
      }
      // A subtree React bailed out of keeps its old children.
      if (!previous || fiber.child !== previous.child) {
        // eslint-disable-next-line prefer-destructuring -- walks the sibling list.
        for (let child = fiber.child; child; child = child.sibling) {
          stack.push([child, underRendered || ran]);
        }
      }
    }
  };
  Object.assign(globalThis, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      renderers: new Map(),
      supportsFiber: true,
      isDisabled: false,
      inject: () => 1,
      onScheduleFiberRoot: () => undefined,
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
        if (log.on) walk(root.current);
      },
      onCommitFiberUnmount: () => undefined,
      onPostCommitFiberRoot: () => undefined,
      checkDCE: () => undefined,
    },
  });
  return log;
});

// These tests drive the match screen, not the lazy route: render it eagerly.
vi.mock('../routeChunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routeChunks')>();
  const { GameScreen } = await import('./GameScreen');
  return { ...actual, lazyScreen: () => GameScreen };
});

// The scene stands in for the canvas and reports what it was given.
const scene = vi.hoisted(() => ({
  liveState: null as null | (() => GameEngineState | null),
  idle: undefined as boolean | undefined,
}));
vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ liveState, idle }: {
    liveState: () => GameEngineState | null;
    idle: boolean;
  }) => {
    scene.liveState = liveState;
    scene.idle = idle;
    return <div data-testid="scene" />;
  },
}));

// No crates and, on a map the monster table does not know, no monsters: a
// tick changes nothing but clocks.
const OPEN_ARENA = [
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
].map((row) => row.split(''));

function wait(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

function live(): GameEngineState {
  const state = scene.liveState?.();
  if (!state) throw new Error('the match has not started');
  return state;
}

/** Plays `ms` and returns what rendered on the page meanwhile. */
function recordWhile(ms: number) {
  devtools.rendered = [];
  devtools.tops = [];
  devtools.on = true;
  wait(ms);
  devtools.on = false;
  return { rendered: devtools.rendered, tops: [...new Set(devtools.tops)] };
}

function openMatch() {
  render(
    <MemoryRouter initialEntries={['/game/2/1/openArena']}>
      <App />
    </MemoryRouter>
  );
}

/** Play time until the round clock prints its next second. */
function untilNextSecond(state: GameEngineState): number {
  const remaining = VERSUS_ROUND_MS - state.roundElapsedMs;
  return remaining - (Math.ceil(remaining / 1000) - 1) * 1000;
}

const clock = () => screen.getByRole('timer', { name: 'round clock' }).textContent;

describe('game screen renders while a real match ticks', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    localStorage.setItem('selectedMap', JSON.stringify(OPEN_ARENA));
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', selectedCharacters: ['sasuke', 'naruto'],
    }));
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    devtools.on = false;
  });

  it('renders nothing for a tick that only moves clocks, and only the HUD for a new clock second', () => {
    openMatch();
    wait(3000 + 1000); // the countdown, then past GO
    let state = live();
    expect(state.roundStartTicksRemaining).toBe(0);
    expect(state.monsters).toHaveLength(0);
    if (untilNextSecond(state) < 400) {
      wait(untilNextSecond(state) + 60);
      state = live();
    }
    const printed = clock();
    const tickBefore = state.tick;

    const quiet = recordWhile(untilNextSecond(state) - 150);
    expect(live().tick - tickBefore).toBeGreaterThanOrEqual(5);
    expect(clock()).toBe(printed);
    expect(quiet.rendered).toEqual([]);

    const nextSecond = recordWhile(300);
    expect(clock()).not.toBe(printed);
    // The HUD's own subscription re-rendered it; the screen around it did not.
    expect(nextSecond.tops).toEqual(['MatchHud']);
    expect(nextSecond.rendered).toContain('GameHUD');
  });

  it('counts down 3, 2, 1 and GO, re-rendering only the countdown for each number', () => {
    openMatch();
    wait(100);
    expect(screen.getByLabelText('round countdown')).toHaveTextContent('3');

    const toTwo = recordWhile(1000);
    expect(screen.getByLabelText('round countdown')).toHaveTextContent('2');
    expect(toTwo.tops).toEqual(['MatchAnnouncer']);
    expect(screen.getByRole('status')).toHaveTextContent(/^2$/);

    wait(1000);
    expect(screen.getByLabelText('round countdown')).toHaveTextContent('1');
    wait(1000);
    expect(screen.queryByLabelText('round countdown')).not.toBeInTheDocument();
    expect(screen.getByText('GO!')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Go!');
    wait(800);
    expect(screen.queryByText('GO!')).not.toBeInTheDocument();
  });

  it('pauses on Escape with the arena idle and frozen, and resumes from the menu', () => {
    openMatch();
    wait(3500);
    expect(scene.idle).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(scene.idle).toBe(true);
    const frozenAt = live().tick;
    wait(500);
    expect(live().tick).toBe(frozenAt);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
    expect(scene.idle).toBe(false);
    wait(500);
    expect(live().tick).toBeGreaterThan(frozenAt);
  });

  it('holds on a real knockout, then shows the result, which ignores a mashed Rematch', () => {
    openMatch();
    wait(3500);
    // P1 bombs the cell they stand on and stays.
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyUp(window, { key: '2' });
    for (let ms = 0; ms < 8000 && live().phase === 'playing'; ms += 50) wait(50);
    expect(live().phase).toBe('game_over');

    // The deciding moment plays out under the banner first.
    expect(screen.queryByRole('button', { name: 'Rematch' })).not.toBeInTheDocument();
    expect(scene.idle).toBe(false);
    wait(RESULT_HOLD_MS - 100);
    expect(screen.queryByRole('button', { name: 'Rematch' })).not.toBeInTheDocument();
    wait(100);
    const rematch = screen.getByRole('button', { name: 'Rematch' });
    expect(scene.idle).toBe(true);

    fireEvent.click(rematch);
    expect(live().phase).toBe('game_over');
    wait(RESULT_INPUT_LOCK_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(live().phase).toBe('playing');
    expect(live().roundStartTicksRemaining).toBeGreaterThan(0);
  });
});
