import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen, RESULT_HOLD_MS } from './GameScreen';
import { BOSS_SEAL_HOLD_MS } from './bossBeats';
import { SEAL_DONE_MS } from './scene/bossPresentation';
import { createBossForConfig, createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { GameConfig, GameEngineState } from '../../engine/types';
import { createMotionStore } from '../../hooks/motionStore';

// The boss's entrance and seal on the match screen: the title card over the
// frozen arena, Start skipping it, and the seal's hold drawing the collapse
// and the reward card before the result covers the arena.

const counts = vi.hoisted(() => ({ idle: undefined as boolean | undefined }));

vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ idle }: { idle: boolean }) => {
    counts.idle = idle;
    return <div data-testid="game-scene-3d" />;
  },
}));

vi.mock('./GameHUD', () => ({
  GameHUD: () => null,
  PauseMissionDetails: () => null,
}));

const engine = vi.hoisted(() => {
  const hook = {
    state: null as unknown,
    motion: null as unknown,
    getState: () => hook.state,
    advanceFrame: () => undefined,
    dispatch: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    restart: vi.fn(),
    dismissDialog: vi.fn(),
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

const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const config: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenSand',
  stageId: 'hiddenSand',
  selectedCharacters: ['gaara'],
  map: openStage,
  seed: 5,
};

function bossFight(extra: Partial<GameEngineState> = {}): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    boss: createBossForConfig({ ...config, map: state.map }),
    ...extra,
  };
}

function renderScreen() {
  const tree = () => (
    <MemoryRouter initialEntries={['/game/1/1/hiddenSand']}>
      <ThemeProvider theme={theme}>
        <GameScreen />
      </ThemeProvider>
    </MemoryRouter>
  );
  const view = render(tree());
  return { publish: (state: GameEngineState) => { engine.state = state; view.rerender(tree()); } };
}

describe('GameScreen boss entrance and seal', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    localStorage.setItem('gameSetup', JSON.stringify({ mode: 'solo', stageId: 'hiddenSand' }));
    engine.dispatch.mockClear();
    engine.pause.mockClear();
  });

  it('shows the boss title card over its entrance, and Start skips it instead of pausing', () => {
    // Just before the arena opens: no boss yet.
    engine.state = bossFight({ boss: null });
    const view = renderScreen();
    view.publish(bossFight({ bossIntroMsRemaining: 2500 }));
    // The camera is still on its way: no card yet.
    expect(screen.queryByTestId('boss-title-card')).toBeNull();

    view.publish(bossFight({ bossIntroMsRemaining: 1500 }));
    // The entrance is announced (the card itself is hidden from screen readers).
    expect(screen.getAllByRole('status').map((node) => node.textContent))
      .toContain('Shukaku enters the arena');
    const card = screen.getByTestId('boss-title-card');
    expect(card).toHaveTextContent('Shukaku');
    expect(card).toHaveTextContent('Sand Burial Spiral · Desert Spear Field');

    // A pad's Start arrives as Escape.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(engine.dispatch).toHaveBeenCalledWith({ type: 'SKIP_BOSS_INTRO' });
    expect(engine.pause).not.toHaveBeenCalled();

    // Nothing is drawn under the card: a ninja standing low on screen moves it up.
    expect(card).toHaveAttribute('data-side', 'bottom');
    // And it stacks above the entrance caption.
    expect(parseFloat(card.style.bottom)).toBeGreaterThanOrEqual(28 + 44);
    const fight = bossFight({ bossIntroMsRemaining: 1400 });
    view.publish({
      ...fight,
      players: fight.players.map((player) => ({ ...player, x: 17, y: fight.boss!.y + 5 })),
    });
    expect(screen.getByTestId('boss-title-card')).toHaveAttribute('data-side', 'top');

    // Once the fight is on, Escape pauses as always.
    view.publish(bossFight({ bossIntroMsRemaining: 0 }));
    expect(screen.queryByTestId('boss-title-card')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(engine.pause).toHaveBeenCalled();
  });

  it('announces a phase change in words, alongside the hit', () => {
    const fight = bossFight();
    engine.state = fight;
    const view = renderScreen();
    view.publish({
      ...fight,
      tick: fight.tick + 1,
      boss: { ...fight.boss!, health: Math.floor(fight.boss!.maxHealth / 2) - 10, phase: 2 },
    });
    const said = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(said.some((text) => text.includes('Shukaku enrages · phase 2'))).toBe(true);
  });

  it('holds a sealed boss on screen, drawing, with its reward card before the result', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const fight = bossFight();
      engine.state = fight;
      const view = renderScreen();
      expect(counts.idle).toBe(false);

      // The deciding blast seals the boss: the engine stops the match.
      view.publish({
        ...fight,
        boss: { ...fight.boss!, health: 0 },
        phase: 'game_over',
        paused: true,
        resultMessage: 'Shukaku has been sealed! New reward unlocked.',
      });
      expect(counts.idle).toBe(false);
      expect(screen.getByText('Shukaku sealed')).toBeInTheDocument();
      expect(screen.getByText('Reward · Sand Armor Powerup')).toBeInTheDocument();
      // Clear of the caption that arrives with it ("Boss hit"), 28 px up and
      // about 44 px tall.
      const plate = screen.getByText('Shukaku sealed').parentElement as HTMLElement;
      expect(parseFloat(plate.style.bottom)).toBeGreaterThanOrEqual(28 + 44);

      // A plain round end would open the result here; the collapse still plays.
      act(() => { vi.advanceTimersByTime(RESULT_HOLD_MS + 100); });
      expect(counts.idle).toBe(false);
      expect(screen.queryByRole('dialog')).toBeNull();

      // The scene's collapse (frame time) is over before the hold ends and the
      // canvas goes on demand.
      expect(SEAL_DONE_MS).toBeLessThan(BOSS_SEAL_HOLD_MS - 300);
      act(() => { vi.advanceTimersByTime(BOSS_SEAL_HOLD_MS - RESULT_HOLD_MS); });
      expect(screen.getByRole('dialog')).toHaveTextContent('Mission Accomplished');
      expect(counts.idle).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
