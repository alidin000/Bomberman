import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  MemoryRouter, Route, Routes, useLocation,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { ConfigScreen } from '../ConfigScreen/ConfigScreen';
import { HubScreen } from './HubScreen';
import { GameScreen } from '../GameScreen/GameScreen';
import { BOSS_SEAL_HOLD_MS } from '../GameScreen/bossBeats';
import { RESULT_INPUT_LOCK_MS } from '../GameScreen/RoundResultDialog';
import { createBossForConfig, createInitialState } from '../../engine/initialState';
import type { GameConfig, GameEngineState } from '../../engine/types';
import {
  StoryProgress, loadStoryProgress, saveStoryProgress,
} from '../../story/progress';

vi.mock('../GameScreen/GameScene3D', () => ({
  GameScene3D: () => <div data-testid="game-scene-3d" />,
}));

// The match screen gets the engine state INIT builds from the config the
// screen assembled, already played out to a sealed boss.
const engine = vi.hoisted(() => ({
  configs: [] as unknown[],
  state: null as unknown,
}));

function wonMission(config: GameConfig): GameEngineState {
  const initial = createInitialState(config);
  return {
    ...initial,
    phase: 'game_over',
    paused: true,
    roundProcessed: true,
    roundStartTicksRemaining: 0,
    tick: 2400,
    resultMessage: 'Kurama has been sealed! New reward unlocked.',
    boss: { ...createBossForConfig(initial.config)!, health: 0 },
    campaign: {
      ...initial.campaign!,
      missionResult: 'success',
      missionStep: 'complete',
      objectives: initial.campaign!.objectives.map((objective) => ({
        ...objective, status: 'complete' as const,
      })),
      discoveredSecrets: ['hiddenLeaf-scroll-cache'],
    },
  };
}

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const store = testEngineStore(() => engine.state as GameEngineState | null);
  return {
    useGameEngineStore: (config: GameConfig | null) => {
      if (config && engine.configs[engine.configs.length - 1] !== config) {
        engine.configs.push(config);
        engine.state = wonMission(config);
      }
      store.usePublish();
      return {
        store: store.store,
        dispatch: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        restart: vi.fn(),
        dismissDialog: vi.fn(),
      };
    },
  };
});

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

describe('campaign hub flow', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    engine.configs = [];
    engine.state = null;
  });

  it('goes from the campaign route to the hub, deploys, and returns after the result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      storeProgress({
        currency: 40,
        pack: ['paperWard'],
        upgradeRanks: { regroupDrill: 1 },
      });
      render(
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/config']}>
            <Routes>
              <Route path="/config" element={<ConfigScreen />} />
              <Route path="/hub/:stageId" element={<HubScreen />} />
              <Route path="/game/:numOfPlayers/:numOfRounds/:selectedMap" element={<GameScreen />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </ThemeProvider>
      );

      // The Mission Deck's campaign briefing leads into the village.
      fireEvent.click(screen.getByRole('button', { name: 'Visit Hidden Leaf hub' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/hub/hiddenLeaf');

      // One press deploys: Deploy Mission holds focus on arrival.
      const deploy = screen.getByRole('button', { name: 'Deploy Mission' });
      expect(deploy).toHaveFocus();
      fireEvent.click(deploy);
      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent('/game/1/1/hiddenLeaf');
      });

      // The mission's INIT carried the pack and the upgrade; the pack is spent.
      const config = engine.configs[0] as GameConfig;
      expect(config.mode).toBe('solo');
      expect(config.loadout).toEqual({
        consumables: ['paperWard'],
        upgrades: { regroupDrill: 1 },
      });
      expect(loadStoryProgress().pack).toEqual([]);
      // A reload of the match would not pack the ward again.
      expect(JSON.parse(localStorage.getItem('gameSetup') as string).loadout.consumables)
        .toEqual([]);

      // A sealed boss holds its collapse longer than a round's deciding moment.
      act(() => { vi.advanceTimersByTime(BOSS_SEAL_HOLD_MS); });
      // A first clear on Normal: 50 + 4 objectives (rescue, defense, route
      // puzzle, mini-boss gate) x 6 + one scroll cache 10.
      expect(await screen.findByText('+84 Embers')).toBeInTheDocument();
      expect(screen.getByText('Clear 50 · Objectives 24 · Secrets 10')).toBeInTheDocument();
      expect(screen.getByText('Used up: Paper Ward')).toBeInTheDocument();
      const onward = screen.getByRole('button', { name: 'Continue to Hidden Sand' });
      expect(onward).toHaveFocus();

      act(() => { vi.advanceTimersByTime(RESULT_INPUT_LOCK_MS); });
      fireEvent.click(onward);
      expect(screen.getByTestId('location')).toHaveTextContent('/hub/hiddenSand');
      expect(screen.getByRole('dialog', { name: 'Hidden Sand Hub' })).toBeInTheDocument();
      expect(screen.getByLabelText('124 Embers to spend')).toBeInTheDocument();
      expect(screen.getByText('Hidden Leaf mission: +84 Embers')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Deploy Mission' })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});
