import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameHUD } from './GameHUD';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

describe('GameHUD', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows campaign event and progression intel in the objective panel', () => {
    const state = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={state} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByText('Nine Tails Alert')).toBeInTheDocument();
    expect(screen.getByText('Reputation')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Fragments')).toBeInTheDocument();
  });

  it('counts down the versus round clock and then announces sudden death', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 60500 }} scale={100} />
      </ThemeProvider>
    );
    expect(screen.getByLabelText('round clock')).toHaveTextContent('Clock0:30');

    rerender(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 90000 }} scale={100} />
      </ThemeProvider>
    );
    expect(screen.getByLabelText('round clock')).toHaveTextContent('Sudden deathWalls closing');
  });

  it('shows the concrete death reason on sealed player cards', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const reason = 'Sasuke was caught in their own Chidori Mine blast.';
    const defeatedState = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0 ? { ...player, alive: false, deathReason: reason } : player
      )),
    };

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={defeatedState} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});
