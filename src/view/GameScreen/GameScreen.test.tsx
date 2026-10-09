import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen, RESULT_HOLD_MS } from './GameScreen';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { hudInsets } from './scene/cameraFraming';

const engineMocks = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  restart: vi.fn(),
  dismissDialog: vi.fn(),
}));

vi.mock('./GameScene3D', () => ({
  GameScene3D: () => <div data-testid="game-scene-3d" />,
}));

const mockState = createInitialState({
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: parseMapRows(defaultMap),
});
let currentMockState = mockState;

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const engine = testEngineStore(() => currentMockState);
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

// The key shown for one player and action in a controls table.
function controlKey(table: HTMLElement, slot: string, column: string): string | null {
  const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
  const row = within(table).getAllByRole('row')
    .find((candidate) => within(candidate).queryByRole('rowheader')?.textContent?.startsWith(slot));
  if (!row) return null;
  return within(row).getAllByRole('cell')[headers.indexOf(column) - 1]?.textContent ?? null;
}

describe('GameScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom's default window; one test sets a laptop size.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    currentMockState = mockState;
    engineMocks.pause.mockClear();
    engineMocks.resume.mockClear();
    engineMocks.restart.mockClear();
    engineMocks.dismissDialog.mockClear();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('game-scene-3d')).toBeInTheDocument();
  });

  it('shows themed player names in HUD', () => {
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('group', { name: 'P1 Deidara' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'P2 Deidara' })).toBeInTheDocument();
  });

  it('restarts the same setup only from the pause menu, after confirming', async () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, paused: true };
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    // No one-click restart beside Pause any more.
    expect(screen.queryByLabelText('restart same setup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    expect(engineMocks.restart).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: 'Restart The Match?' });
    expect(within(confirm).getByRole('button', { name: 'Stay' })).toHaveFocus();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Stay' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Restart The Match?' })).not.toBeInTheDocument();
    });
    expect(engineMocks.restart).not.toHaveBeenCalled();
    expect(screen.getByText('Paused')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Match' }));
    expect(engineMocks.restart).toHaveBeenCalledTimes(1);
  });

  it('pauses the game with Escape', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(engineMocks.pause).toHaveBeenCalledTimes(1);
  });

  it('shows a pause menu with controls and quit action when paused', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, paused: true };

    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /resume/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /restart/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /settings/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /quit game/i })).toBeInTheDocument();
    const controls = screen.getByRole('table', { name: 'controls' });
    expect(controlKey(controls, 'P1', 'Move')).toBe('W A S D');
    expect(controlKey(controls, 'P2', 'Bomb')).toBe('O');
    // The static kit text moved off the HUD cards into the pause menu.
    expect(within(screen.getByRole('list', { name: 'shinobi kits' }))
      .getAllByText(/Clay Art Shinobi/)).toHaveLength(2);
  });

  it('loads saved bindings before rendering the controls guide', () => {
    localStorage.setItem('playerKeyBindings', JSON.stringify({
      1: ['t', 'f', 'g', 'h', 'b', 'n', 'm', ','],
    }));

    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    const controls = screen.getByRole('table', { name: 'controls' });
    expect(controlKey(controls, 'P1', 'Move')).toBe('T F G H');
    expect(controlKey(controls, 'P1', 'Bomb')).toBe('B');
  });

  it('pauses first-time play while the controls guide is open', () => {
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('controls guide')).toBeInTheDocument();
    expect(engineMocks.pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('hide controls guide'));

    expect(engineMocks.resume).toHaveBeenCalledTimes(1);
  });

  it('dismisses the first-time guide with Escape and resumes play', () => {
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByLabelText('controls guide')).not.toBeInTheDocument();
    expect(engineMocks.resume).toHaveBeenCalledTimes(1);
  });

  it('returns to the pause menu when controls were opened from pause', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, paused: true };
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('show controls'));
    fireEvent.click(screen.getByLabelText('hide controls guide'));

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(engineMocks.resume).not.toHaveBeenCalled();
  });

  it('can hide and restore the HUD without changing game state', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('match status')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('hide HUD'));
    expect(screen.queryByLabelText('match status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('show HUD'));
    expect(screen.getByLabelText('match status')).toBeInTheDocument();
    expect(engineMocks.pause).not.toHaveBeenCalled();
  });

  it('hands off from settings to controls without stacking dialogs', async () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('open settings'));
    expect(screen.getByText('Match Command')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /modify controls/i }));

    expect(screen.getByRole('heading', { name: 'Modify Controls' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('heading', {
        name: 'Match Command',
        hidden: true,
      })).not.toBeInTheDocument();
    });
  });

  it('applies saved controls and resumes even when browser storage rejects the write', async () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('open settings'));
    fireEvent.click(screen.getByRole('button', { name: /modify controls/i }));
    fireEvent.keyDown(screen.getByLabelText('player 1 bomb key'), { key: 'b' });
    engineMocks.resume.mockClear();

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    } finally {
      setItem.mockRestore();
    }

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Modify Controls' })).not.toBeInTheDocument();
    });
    expect(engineMocks.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('show controls'));
    expect(controlKey(screen.getByRole('table', { name: 'controls' }), 'P1', 'Bomb')).toBe('B');
  });

  it('falls back to default keys when stored bindings hold non-key values', () => {
    localStorage.setItem('playerKeyBindings', JSON.stringify({
      1: [5, null, {}, 'd', 2, '1', '3', '4'],
    }));

    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    const controls = screen.getByRole('table', { name: 'controls' });
    expect(controlKey(controls, 'P1', 'Move')).toBe('W A S D');
    expect(controlKey(controls, 'P1', 'Bomb')).toBe('2');
  });

  it('still resumes after the guide when the controls button is pressed twice mid-match', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    const screenTree = () => (
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    const { rerender } = render(screenTree());

    fireEvent.click(screen.getByLabelText('show controls'));
    expect(engineMocks.pause).toHaveBeenCalled();
    currentMockState = { ...mockState, paused: true };
    rerender(screenTree());
    expect(screen.getByLabelText('resume game')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('show controls'));
    fireEvent.click(screen.getByLabelText('hide controls guide'));

    expect(engineMocks.resume).toHaveBeenCalledTimes(1);
  });

  it('announces captions through a live region that exists before the first event', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, roundStartTicksRemaining: 0 };
    const screenTree = () => (
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    const { rerender } = render(screenTree());
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('');

    currentMockState = {
      ...mockState,
      roundStartTicksRemaining: 0,
      tick: mockState.tick + 1,
      players: mockState.players.map((player, index) => (
        index === 1 ? { ...player, alive: false } : player
      )),
    };
    rerender(screenTree());

    expect(screen.getByRole('status')).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent('P2 Deidara is out');
  });

  it('holds on the deciding moment before the round result opens', () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('shinobiControlsGuideSeen', 'true');
      currentMockState = {
        ...mockState,
        totalRounds: 3,
        phase: 'round_end',
        paused: true,
        roundWinners: ['player1'],
        roundStartTicksRemaining: 0,
      };
      render(
        <MemoryRouter initialEntries={['/game/2/3/map1']}>
          <ThemeProvider theme={theme}>
            <GameScreen />
          </ThemeProvider>
        </MemoryRouter>
      );

      // The frozen arena first, under a banner that names the winner by slot.
      expect(screen.queryByRole('button', { name: 'Next Round' })).not.toBeInTheDocument();
      expect(screen.getByText('P1 Deidara takes round 1', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getAllByRole('status')[0]).toHaveTextContent('P1 Deidara takes round 1');

      act(() => { vi.advanceTimersByTime(RESULT_HOLD_MS - 50); });
      expect(screen.queryByRole('button', { name: 'Next Round' })).not.toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(50); });
      expect(screen.getByRole('button', { name: 'Next Round' })).toBeInTheDocument();
      expect(screen.queryByText('Next Trial')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the score line under the countdown, slot first, and reads it once', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = {
      ...mockState,
      totalRounds: 3,
      round: 2,
      roundWinners: ['player2'],
      roundStartTicksRemaining: 3000,
    };
    const screenTree = () => (
      <MemoryRouter initialEntries={['/game/2/3/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    const { rerender } = render(screenTree());

    expect(screen.getByText('Round 2 · P2 Deidara leads 1–0')).toBeInTheDocument();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Round 2 · P2 Deidara leads 1–0. 3');

    currentMockState = { ...currentMockState, roundStartTicksRemaining: 2000 };
    rerender(screenTree());
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(/^2$/);
  });

  it('moves the countdown off the middle of the arena: under the HUD band, or above it in the campaign', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const plateLayer = () => screen.getByLabelText('round countdown').parentElement as HTMLElement;
    const versusBand = hudInsets(100, 1366, 768);

    currentMockState = { ...mockState, roundStartTicksRemaining: 3000 };
    const { unmount } = render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    // Versus players start at the corners of their box: the plate hangs
    // from the bottom of the top HUD band, where the camera keeps them out.
    expect(parseFloat(plateLayer().style.top)).toBeGreaterThanOrEqual(versusBand.top * 768);
    expect(parseFloat(plateLayer().style.top)).toBeLessThan(768 * 0.3);
    unmount();

    // The campaign camera centres its lone player: the plate sits low.
    const campaign = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });
    currentMockState = { ...campaign, roundStartTicksRemaining: 3000 };
    render(
      <MemoryRouter initialEntries={['/game/1/1/hiddenLeaf']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(plateLayer().style.top).toBe('');
    expect(parseFloat(plateLayer().style.bottom)).toBeGreaterThanOrEqual(versusBand.bottom * 768);
  });

  it('keeps the full mission list in the pause menu for the one-line phone HUD', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    const campaign = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });
    currentMockState = { ...campaign, paused: true };
    render(
      <MemoryRouter initialEntries={['/game/1/1/hiddenLeaf']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    const pause = screen.getByRole('dialog', { name: /Paused/ });
    const list = within(pause).getByLabelText('mission objectives');
    campaign.campaign!.objectives.forEach((objective) => {
      expect(list).toHaveTextContent(objective.label);
    });
  });

  it('shows GO for the first moments of play after the countdown, and announces both', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    const screenTree = () => (
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );
    currentMockState = { ...mockState, roundStartTicksRemaining: 1000 };
    const { rerender } = render(screenTree());
    expect(screen.getByLabelText('round countdown')).toHaveTextContent('1');
    expect(screen.getByRole('status')).toHaveTextContent('1');

    // The countdown hits zero: the round is live and GO! takes over.
    const liveTick = mockState.tick;
    currentMockState = { ...mockState, roundStartTicksRemaining: 0, tick: liveTick };
    rerender(screenTree());
    expect(screen.queryByLabelText('round countdown')).not.toBeInTheDocument();
    expect(screen.getByText('GO!')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Go!');

    currentMockState = { ...currentMockState, tick: liveTick + 13 };
    rerender(screenTree());
    expect(screen.getByText('GO!')).toBeInTheDocument();

    // 14 ticks (700 ms) of play later it is gone.
    currentMockState = { ...currentMockState, tick: liveTick + 14 };
    rerender(screenTree());
    expect(screen.queryByText('GO!')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('does not show GO when the screen mounts on a round already in play', () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, roundStartTicksRemaining: 0 };
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText('GO!')).not.toBeInTheDocument();
  });

  it('returns to the pause menu when settings were opened from it', async () => {
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    currentMockState = { ...mockState, paused: true };
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(screen.getByText('Match Command')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Match Command' })).not.toBeInTheDocument();
    });
    expect(engineMocks.resume).not.toHaveBeenCalled();
    expect(screen.getByText('Paused')).toBeInTheDocument();

    // The explicit Resume button in settings still gives play back.
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    fireEvent.click(screen.getByRole('button', { name: /resume game/i }));
    expect(engineMocks.resume).toHaveBeenCalledTimes(1);
  });
});
