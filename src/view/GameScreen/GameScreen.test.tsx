import { vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('../../hooks/useGameEngine', () => ({
  useGameEngine: () => ({
    state: mockState,
    dispatch: vi.fn(),
    pause: engineMocks.pause,
    resume: engineMocks.resume,
    restart: engineMocks.restart,
    dismissDialog: engineMocks.dismissDialog,
  }),
}));

describe('GameScreen', () => {
  beforeEach(() => {
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
    expect(screen.getAllByText('Deidara').length).toBeGreaterThan(0);
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
});
