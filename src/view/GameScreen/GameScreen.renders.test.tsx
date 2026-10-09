import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen, RESULT_HOLD_MS } from './GameScreen';
import { createInitialState } from '../../engine/initialState';
import { gameReducer } from '../../engine/reducer';
import { parseMapRows } from '../../engine/mapLoader';
import { GameEngineState } from '../../engine/types';
import { createMotionStore } from '../../hooks/motionStore';
import { GAME_PREFERENCES_KEY } from './gamePreferences';

// Counts how often GameScreen re-renders the 3D scene and the HUD.
const counts = vi.hoisted(() => ({ scene: 0, hud: 0, idle: undefined as boolean | undefined }));

vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ idle }: { idle: boolean }) => {
    counts.scene += 1;
    counts.idle = idle;
    return <div data-testid="game-scene-3d" />;
  },
}));

vi.mock('./GameHUD', () => ({
  GameHUD: () => {
    counts.hud += 1;
    return null;
  },
  PauseMissionDetails: () => null,
}));

// Like the real hook: callbacks and the motion store keep their identity.
const engine = vi.hoisted(() => {
  const noop = () => undefined;
  const hook = {
    state: null as unknown,
    motion: null as unknown,
    getState: () => hook.state,
    advanceFrame: noop,
    dispatch: noop,
    pause: noop,
    resume: noop,
    restart: noop,
    dismissDialog: noop,
  };
  return hook;
});
engine.motion = createMotionStore();

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const published = testEngineStore(() => engine.state as GameEngineState | null);
  return {
    useGameEngineStore: () => {
      published.usePublish();
      return { ...engine, store: published.store };
    },
  };
});

// No monsters or crates: a tick changes only clocks.
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

const reduce = (state: GameEngineState, action: Parameters<typeof gameReducer>[1]) => (
  gameReducer(state, action) as GameEngineState
);
const tick = (state: GameEngineState) => reduce(state, { type: 'TICK', deltaMs: 50 });

// A live versus round 10 s in, with a bomb burning and ultimates recharging.
function liveRound(): GameEngineState {
  let state = createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['sasuke', 'naruto'],
    map: openArena,
  });
  state = {
    ...state, monsters: [], roundStartTicksRemaining: 0, roundElapsedMs: 10000,
  };
  state = reduce(state, { type: 'DROP_BOMB', playerId: state.players[0].id });
  return tick(state);
}

function renderScreen() {
  // A new element each time, so React re-renders GameScreen as the engine
  // hook's state update would.
  const tree = () => (
    <MemoryRouter initialEntries={['/game/2/1/map1']}>
      <ThemeProvider theme={theme}>
        <GameScreen />
      </ThemeProvider>
    </MemoryRouter>
  );
  const view = render(tree());
  return { publish: (state: GameEngineState) => { engine.state = state; view.rerender(tree()); } };
}

describe('GameScreen re-renders the scene and HUD only for what they draw', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    counts.scene = 0;
    counts.hud = 0;
  });

  it('skips both on a tick that only moves clocks, fuses and cooldowns', () => {
    const before = liveRound();
    const after = tick(before);
    // The tick really is clocks only: counter, round time, fuse, recharge.
    expect(after.tick).toBe(before.tick + 1);
    expect(after.bombs[0].ticksRemaining).toBeLessThan(before.bombs[0].ticksRemaining);
    expect(after.players[0]).not.toBe(before.players[0]);

    engine.state = before;
    const screen = renderScreen();
    const { scene, hud } = counts;

    screen.publish(after);
    screen.publish(tick(after));

    expect(counts.scene).toBe(scene);
    expect(counts.hud).toBe(hud);
    // GameScreen itself did re-render: a real change reaches the scene.
    screen.publish({ ...tick(after), paused: true });
    expect(counts.scene).toBe(scene + 1);
  });

  it('still re-renders the scene for a new bomb and the HUD for the clock', () => {
    const before = liveRound();
    engine.state = before;
    const screen = renderScreen();
    const { scene } = counts;

    const secondBomb = reduce(before, { type: 'DROP_BOMB', playerId: before.players[1].id });
    screen.publish(secondBomb);
    expect(counts.scene).toBe(scene + 1);

    // 80 s left becomes 79 s left: the HUD clock changes, the arena does not.
    let clock = secondBomb;
    while (Math.ceil((90000 - clock.roundElapsedMs) / 1000) === 80) clock = tick(clock);
    const sceneBefore = counts.scene;
    const hudBefore = counts.hud;
    screen.publish(clock);
    expect(counts.hud).toBe(hudBefore + 1);
    expect(counts.scene).toBe(sceneBefore);
  });

  it('mirrors high contrast and reduced motion onto <html>', () => {
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify({
      highContrast: true, reducedMotion: true,
    }));
    engine.state = liveRound();
    renderScreen();
    expect(document.documentElement.getAttribute('data-contrast')).toBe('more');
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduce');
  });

  it('keeps drawing through the hold before the result, and idles under pause and the dialog', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const live = liveRound();
      engine.state = live;
      const screen = renderScreen();
      expect(counts.idle).toBe(false);

      screen.publish({ ...tick(live), paused: true });
      expect(counts.idle).toBe(true);

      // The round ends: the reducer sets `paused` too, but the deciding
      // moment still plays out until the result dialog covers the arena.
      const ended = {
        ...tick(live), phase: 'round_end' as const, paused: true, roundWinners: [live.players[0].id],
      };
      screen.publish(ended);
      expect(counts.idle).toBe(false);
      act(() => { vi.advanceTimersByTime(RESULT_HOLD_MS); });
      expect(counts.idle).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds again when a rematch ends on the same tick as the last match', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const live = liveRound();
      engine.state = live;
      const screen = renderScreen();
      const over = {
        ...tick(live), phase: 'game_over' as const, paused: true, roundWinners: [live.players[0].id],
      };
      screen.publish(over);
      act(() => { vi.advanceTimersByTime(RESULT_HOLD_MS); });
      expect(counts.idle).toBe(true);

      // Rematch, and the new match ends on the very same tick and round.
      screen.publish(live);
      expect(counts.idle).toBe(false);
      screen.publish({ ...over });
      expect(counts.idle).toBe(false);
      act(() => { vi.advanceTimersByTime(RESULT_HOLD_MS); });
      expect(counts.idle).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
