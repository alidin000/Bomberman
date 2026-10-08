import { vi } from 'vitest';
import React from 'react';
import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoundResultDialog } from './RoundResultDialog';
import { createBossForConfig, createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

describe('RoundResultDialog', () => {
  it('restarts the current match with the same setup from game over', () => {
    const handleRestart = vi.fn();
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={handleRestart}
          resultMessage="Kurama has been sealed!"
          isGameOver
          state={state}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Retry Same Setup'));

    expect(handleRestart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('table')).toHaveAccessibleName('match breakdown');
    expect(screen.getByText('P1 · Deidara')).toBeInTheDocument();
  });

  it('counts a boss still standing as a threat left, like the HUD', () => {
    const config = {
      mode: 'solo' as const,
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf' as const,
      selectedCharacters: ['deidara' as const],
      map: parseMapRows(defaultMap),
    };
    const initial = createInitialState(config);
    const defeatedAtBoss = {
      ...initial,
      monsters: [],
      boss: createBossForConfig(config),
      phase: 'game_over' as const,
      players: initial.players.map((player) => ({ ...player, alive: false })),
    };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="Try again."
          isGameOver
          tone="defeat"
          state={defeatedAtBoss}
        />
      </MemoryRouter>
    );

    const threats = screen.getByText('Threats left');
    expect(within(threats).getByText('1')).toBeInTheDocument();
  });

  it('tells two players on the same character apart in the report', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['deidara', 'deidara'],
      map: parseMapRows(defaultMap),
    });
    const scored = { ...state, phase: 'game_over' as const, roundWinners: ['player2'] };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="Deidara wins the match!"
          isGameOver
          state={scored}
        />
      </MemoryRouter>
    );

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    const cells = rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
    expect(new Set(cells.map((row) => row[0])).size).toBe(2);
    expect(cells.find((row) => row[2] === '1')?.[0]).toMatch(/P2/);
  });

  it('headlines the versus winner by slot, even when both picked the same shinobi', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['deidara', 'deidara'],
      map: parseMapRows(defaultMap),
    });
    const scored = { ...state, phase: 'game_over' as const, roundWinners: ['player2'] };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="Deidara wins the match!"
          isGameOver
          state={scored}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('P2 · Deidara wins');
    // Campaign-only intel (secrets, threats) is not shown for a versus match.
    expect(screen.queryByText('Secrets')).not.toBeInTheDocument();
  });

  it('calls a tied versus match a draw', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 2,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });
    const tied = { ...state, phase: 'game_over' as const, roundWinners: ['player1', 'player2'] };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="The match ends in a draw!"
          isGameOver
          state={tied}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Draw');
  });

  it('names the round and its winner between rounds', () => {
    const state = createInitialState({
      numPlayers: 3,
      totalRounds: 3,
      selectedMap: 'map1',
      selectedCharacters: ['naruto', 'sasuke', 'gaara'],
      map: parseMapRows(defaultMap),
    });
    const roundOver = { ...state, phase: 'round_end' as const, roundWinners: ['player3'] };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="Gaara wins the round."
          isGameOver={false}
          state={roundOver}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Round 1: P3 · Gaara wins');
    expect(screen.getByRole('button', { name: 'Next Trial' })).toBeInTheDocument();
  });
});
