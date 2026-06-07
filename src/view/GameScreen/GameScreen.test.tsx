import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen } from './GameScreen';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

jest.mock('./GameScene3D', () => ({
  GameScene3D: () => <div data-testid="game-scene-3d" />,
}));

const mockState = createInitialState({
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: parseMapRows(defaultMap),
});

jest.mock('../../hooks/useGameEngine', () => ({
  useGameEngine: () => ({
    state: mockState,
    dispatch: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    restart: jest.fn(),
    dismissDialog: jest.fn(),
  }),
}));

describe('GameScreen', () => {
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
});
