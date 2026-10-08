import { vi } from 'vitest';
import React from 'react';
import {
  fireEvent, render, screen, waitFor,
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
    expect(screen.getAllByText(/P\d · Deidara/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clay Art Shinobi').length).toBeGreaterThan(0);
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
    expect(screen.getByText('P1 move')).toBeInTheDocument();
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

    expect(screen.getByText('P1 move')).toBeInTheDocument();
    expect(screen.getByText('T F G H')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
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
});
