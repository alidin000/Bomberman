import React from 'react';
import { vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameHUD } from './GameHUD';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import * as content from '../../content';

// Counts player-card renders: each card looks its character up once per render.
const characterLookups = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof content>();
  return {
    ...actual,
    getCharacterDefinition: (...args: Parameters<typeof actual.getCharacterDefinition>) => {
      characterLookups.count += 1;
      return actual.getCharacterDefinition(...args);
    },
  };
});

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

  it('never shows a negative bomb count while extra bombs are out', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    // Naruto's shadow clone puts one bomb more than his limit on the field.
    const cloneOut = {
      ...state,
      players: state.players.map((player, index) => (
        index === 1 ? { ...player, activeBombs: player.maxBombs + 1 } : player
      )),
    };

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={cloneOut} scale={100} />
      </ThemeProvider>
    );

    const bombsReady = (name: string) => within(screen.getByRole('group', { name }))
      .getByText('Bombs').nextSibling?.textContent;
    expect(bombsReady('P1 Sasuke')).toBe(`${state.players[0].maxBombs}/${state.players[0].maxBombs}`);
    expect(bombsReady('P2 Naruto')).toBe(`0/${state.players[1].maxBombs}`);
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

  it('renders player status ribbons without React DOM attribute warnings', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    try {
      render(
        <ThemeProvider theme={theme}>
          <GameHUD state={state} scale={100} />
        </ThemeProvider>
      );
      expect(screen.getAllByText('Ult ready')).toHaveLength(2);
      const warnings = errors.mock.calls.map((call) => call.map(String).join(' '));
      expect(warnings.filter((text) => /non-boolean attribute/.test(text))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('tells two players on the same shinobi apart by slot', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['naruto', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={state} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByRole('group', { name: 'P1 Naruto' })).toHaveTextContent(/^P1/);
    expect(screen.getByRole('group', { name: 'P2 Naruto' })).toHaveTextContent(/^P2/);
  });

  it('re-renders a player card only when its own numbers change', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const tree = (current: typeof state) => (
      <ThemeProvider theme={theme}>
        <GameHUD state={current} scale={100} />
      </ThemeProvider>
    );
    const { rerender } = render(tree(state));
    const afterMount = characterLookups.count;

    // An engine tick inside the same clock second: nothing on the cards moved.
    rerender(tree({ ...state, tick: state.tick + 1, roundElapsedMs: state.roundElapsedMs + 50 }));
    expect(characterLookups.count).toBe(afterMount);

    // P2 drops a bomb: only P2's card renders again.
    rerender(tree({
      ...state,
      tick: state.tick + 2,
      players: state.players.map((player, index) => (
        index === 1 ? { ...player, activeBombs: player.activeBombs + 1 } : player
      )),
    }));
    expect(characterLookups.count).toBe(afterMount + 1);
  });

  it('exposes the round clock as a timer that is not read out every second', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 80000 }} scale={100} />
      </ThemeProvider>
    );

    const clock = screen.getByRole('timer', { name: 'round clock' });
    expect(clock).toHaveTextContent('0:10');
    expect(clock).not.toHaveAttribute('aria-live');
  });
});
