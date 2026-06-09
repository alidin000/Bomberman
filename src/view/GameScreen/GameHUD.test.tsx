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
        <GameHUD state={state} />
      </ThemeProvider>
    );

    expect(screen.getByText('Nine Tails Alert')).toBeInTheDocument();
    expect(screen.getByText('Reputation')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Fragments')).toBeInTheDocument();
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
        <GameHUD state={defeatedState} />
      </ThemeProvider>
    );

    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});
