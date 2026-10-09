import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RESULT_INPUT_LOCK_MS, RoundResultDialog } from './RoundResultDialog';
import { createBossForConfig, createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

describe('RoundResultDialog', () => {
  // Every case clicks after the input lock (600 ms after opening) unless it
  // is testing the lock itself.
  let now = 0;
  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const pastLock = () => { now += RESULT_INPUT_LOCK_MS; };

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

    pastLock();
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));

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
    expect(new Set(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).size).toBe(2);
    const winner = rows.find((row) => within(row).queryByRole('img', { name: '1 of 1 wins' }));
    expect(winner).toHaveTextContent(/^P2/);
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

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('P2 Deidara wins 1–0');
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

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Draw · 1–1');
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

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('P3 Gaara takes round 1');
    expect(screen.getByRole('button', { name: 'Next Round' })).toHaveFocus();
    expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
  });

  it('tallies the round with pips toward first to N and how each player went out, by slot', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 3,
      selectedMap: 'map1',
      selectedCharacters: ['itachi', 'itachi'],
      map: parseMapRows(defaultMap),
      controllers: ['human', 'cpu-normal'],
    });
    const roundOver = {
      ...state,
      phase: 'round_end' as const,
      roundWinners: ['player1'],
      players: state.players.map((player, index) => (
        index === 1
          ? { ...player, alive: false, deathCause: { kind: 'blast' as const, byPlayerId: 'player1' } }
          : player
      )),
    };

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={vi.fn()}
          resultMessage="Itachi wins the round. Itachi was caught in Itachi's Crow Clone blast."
          isGameOver={false}
          state={roundOver}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('P1 Itachi takes round 1');
    expect(screen.getByText('Score 1–0 · first to 2')).toBeInTheDocument();
    const [p1, p2] = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(p1).getByRole('img', { name: '1 of 2 wins' })).toBeInTheDocument();
    expect(p1).toHaveTextContent('Standing');
    expect(within(p2).getByRole('img', { name: '0 of 2 wins' })).toBeInTheDocument();
    expect(p2).toHaveTextContent("Out · P1 Itachi's blast");
    expect(p2).toHaveTextContent('CPU · Normal');
    // The engine's name-only sentence is not what a mirror match reads.
    expect(screen.queryByText(/Itachi was caught in Itachi's/)).not.toBeInTheDocument();
  });

  it('ignores clicks and Enter for 600 ms after it opens', () => {
    const handleClose = vi.fn();
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 3,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={handleClose}
          onRestart={vi.fn()}
          resultMessage=""
          isGameOver={false}
          state={{ ...state, phase: 'round_end', roundWinners: ['player1'] }}
        />
      </MemoryRouter>
    );

    const next = screen.getByRole('button', { name: 'Next Round' });
    // A bomb-mashing player's Enter lands as a click on the focused button.
    fireEvent.click(next);
    now += RESULT_INPUT_LOCK_MS - 1;
    fireEvent.click(next);
    expect(handleClose).not.toHaveBeenCalled();

    now += 1;
    fireEvent.click(next);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('ends the match on the final score, with Rematch focused and a way to change the setup', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 3,
      selectedMap: 'map1',
      selectedCharacters: ['gaara', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const over = {
      ...state, phase: 'game_over' as const, round: 3, roundWinners: ['player1', 'player2', 'player1'],
    };

    render(
      <MemoryRouter initialEntries={['/game/2/3/map1']}>
        <Routes>
          <Route
            path="/game/:a/:b/:c"
            element={(
              <RoundResultDialog
                open
                onClose={vi.fn()}
                onRestart={vi.fn()}
                resultMessage="Gaara wins the match!"
                isGameOver
                state={over}
              />
            )}
          />
          <Route path="/config" element={<p>Mission Deck</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('P1 Gaara wins 2–1');
    expect(screen.getByText('Final score 2–1 · first to 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rematch' })).toHaveFocus();
    act(() => { pastLock(); });
    fireEvent.click(screen.getByRole('button', { name: 'Change setup' }));
    expect(screen.getByText('Mission Deck')).toBeInTheDocument();
  });
});
