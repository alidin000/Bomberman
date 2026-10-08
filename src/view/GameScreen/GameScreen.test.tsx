import { vi } from 'vitest';
import React from 'react';
import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen } from './GameScreen';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

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

vi.mock('../../hooks/useGameEngine', () => ({
  useGameEngine: () => ({
    state: currentMockState,
    dispatch: vi.fn(),
    pause: engineMocks.pause,
    resume: engineMocks.resume,
    restart: engineMocks.restart,
    dismissDialog: engineMocks.dismissDialog,
  }),
}));

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

  it('restarts the same setup from the top controls', () => {
    render(
      <MemoryRouter initialEntries={['/game/2/1/map1']}>
        <ThemeProvider theme={theme}>
          <GameScreen />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('restart same setup'));

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
      explosions: [{
        x: 2, y: 1, ticksRemaining: 500, kind: 'standard',
      }],
    };
    rerender(screenTree());

    expect(screen.getByRole('status')).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent('Blast detonates');
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
