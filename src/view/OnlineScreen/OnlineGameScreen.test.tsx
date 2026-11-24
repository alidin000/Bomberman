import React from 'react';
import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import { createInitialState } from '../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../engine/mapLoader';
import { GameEngineState } from '../../engine/types';
import { createEngineStore, PublishingEngineStore } from '../../hooks/engineStore';
import { setTouchMode } from '../../input/touchMode';
import { OnlineSessionSnapshot } from '../../network/onlineSession';
import theme from '../../theme/InstructionsTheme';
import {
  LANDSCAPE_HINT_DISMISSED_KEY,
} from '../GameScreen/TouchControls';
import { OnlineGameScreen } from './OnlineGameScreen';

const mocks = vi.hoisted(() => ({
  input: vi.fn(),
  leave: vi.fn(),
  rejoin: vi.fn(),
  resumeStored: vi.fn(() => true),
  setRematch: vi.fn(),
  useOnlineInput: vi.fn(),
  snapshot: null as OnlineSessionSnapshot | null,
  engine: null as {
    store: PublishingEngineStore;
    motion: null;
    getState: () => GameEngineState | null;
    advanceFrame: (now: number) => void;
  } | null,
}));

vi.mock('../../network/onlineSession', () => ({
  getOnlineSession: () => ({
    input: mocks.input,
    leave: mocks.leave,
    rejoin: mocks.rejoin,
    resumeStored: mocks.resumeStored,
    setRematch: mocks.setRematch,
  }),
}));

vi.mock('../../hooks/useOnlineGame', () => ({
  useOnlineStatusSnapshot: () => mocks.snapshot,
  useOnlineEngine: () => mocks.engine,
  useOnlineInput: mocks.useOnlineInput,
}));

vi.mock('../GameScreen/useGameFeedback', () => ({
  useEngineFeedback: () => ({ impact: 0, caption: '', eventId: 0 }),
}));

vi.mock('../GameScreen/MatchLeaves', () => ({
  MatchHud: () => <div data-testid="online-hud" />,
  MatchScene: () => <div data-testid="online-scene" />,
  MatchAnnouncer: () => null,
}));

const openArena = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

function onlineState(): GameEngineState {
  const state = createInitialState({
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: 'map1',
    map: openArena,
    selectedCharacters: ['sasuke', 'naruto'],
    seed: 42,
  });
  return {
    ...state,
    roundStartTicksRemaining: 0,
    players: state.players.map((player, slot) => (
      slot === 0 ? { ...player, alive: false } : player
    )),
  };
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function renderOnlineGame() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/online/ABC234/play']}>
        <Routes>
          <Route path="/online/:roomId/play" element={<OnlineGameScreen />} />
          <Route path="/online" element={<p>Online menu page</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('OnlineGameScreen touch play', () => {
  beforeEach(() => {
    localStorage.clear();
    setTouchMode(true);
    setViewport(390, 844);
    const state = onlineState();
    const store = createEngineStore();
    store.publish(state);
    mocks.engine = {
      store,
      motion: null,
      getState: () => state,
      advanceFrame: vi.fn(),
    };
    mocks.snapshot = {
      status: 'playing',
      connected: true,
      roomId: 'ABC234',
      seat: 1,
      playerId: 'player2',
      token: 'resume-token',
      players: [],
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 3,
      gameState: state,
      ack: 1,
      error: '',
    };
    mocks.useOnlineInput.mockClear();
  });

  afterEach(() => {
    setTouchMode(false);
    setViewport(1024, 768);
  });

  it('mounts enabled controls for the local online seat', () => {
    renderOnlineGame();

    expect(document.querySelector('[data-touch-controls]')).not.toBeNull();
    // P1 is defeated in this fixture. An active bomb button proves the
    // controls read P2, the seat assigned by the online server.
    expect(document.querySelector('[data-touch-button="bomb"]')).not.toHaveAttribute('data-out');
    expect(mocks.useOnlineInput)
      .toHaveBeenCalledWith(expect.anything(), true, expect.any(Function));
  });

  it('suggests landscape without blocking portrait play and remembers dismissal', () => {
    renderOnlineGame();

    expect(screen.getByText('Rotate for a wider arena')).toBeInTheDocument();
    expect(document.querySelector('[data-touch-button="bomb"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'dismiss orientation suggestion' }));
    expect(screen.queryByText('Rotate for a wider arena')).not.toBeInTheDocument();
    expect(localStorage.getItem(LANDSCAPE_HINT_DISMISSED_KEY)).toBe('true');
  });
});

describe('OnlineGameScreen co-op village square', () => {
  beforeEach(() => {
    localStorage.clear();
    // A co-op room runs as 'solo' on the server, with no village visit.
    const start = createInitialState({
      mode: 'solo',
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
      selectedCharacters: ['sasuke', 'naruto'],
      seed: 9,
    });
    // P2 (this seat) stands beside the shrine at 2,8.
    const state = {
      ...start,
      roundStartTicksRemaining: 0,
      players: start.players.map((player, slot) => (
        slot === 1 ? { ...player, x: 2, y: 7 } : player
      )),
    };
    const store = createEngineStore();
    store.publish(state);
    mocks.engine = {
      store, motion: null, getState: () => state, advanceFrame: vi.fn(),
    };
    mocks.snapshot = {
      status: 'playing',
      connected: true,
      roomId: 'ABC234',
      seat: 1,
      playerId: 'player2',
      token: 'resume-token',
      players: [],
      roomMode: 'coop',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 1,
      gameState: state,
      ack: 1,
      error: '',
    };
    mocks.useOnlineInput.mockClear();
  });

  it('opens the shrine on the bomb key without pausing, and this seat stands still while it is open', () => {
    renderOnlineGame();
    const squareBomb = mocks.useOnlineInput.mock.calls.at(-1)?.[2] as () => boolean;
    let taken = false;
    act(() => {
      taken = squareBomb();
    });
    // The square took the press: the room never hears a bomb.
    expect(taken).toBe(true);
    const shrine = screen.getByRole('dialog', { name: 'Secrets Shrine' });
    expect(within(shrine).getByText(/This village · 0 of 3 found/)).toBeInTheDocument();
    expect(mocks.useOnlineInput)
      .toHaveBeenLastCalledWith(expect.anything(), false, expect.any(Function));

    fireEvent.click(within(shrine).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Secrets Shrine' })).not.toBeInTheDocument();
    expect(mocks.useOnlineInput)
      .toHaveBeenLastCalledWith(expect.anything(), true, expect.any(Function));
  });
});

describe('OnlineGameScreen connection curtain', () => {
  beforeEach(() => {
    const state = onlineState();
    const store = createEngineStore();
    store.publish(state);
    mocks.engine = {
      store, motion: null, getState: () => state, advanceFrame: vi.fn(),
    };
    mocks.snapshot = {
      status: 'playing',
      connected: true,
      roomId: 'ABC234',
      seat: 1,
      playerId: 'player2',
      token: 'resume-token',
      players: [],
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 3,
      gameState: state,
      ack: 1,
      error: 'Player 1 disconnected. The match is paused.',
    };
    mocks.leave.mockClear();
  });

  it('keeps a way out while the match waits on a dropped seat', () => {
    renderOnlineGame();

    expect(screen.getByRole('status')).toHaveTextContent('Player 1 disconnected. The match is paused.');
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(mocks.leave).toHaveBeenCalledTimes(1);
  });
});

describe('OnlineGameScreen match result', () => {
  it('shows who a rematch waits on', () => {
    const state: GameEngineState = {
      ...onlineState(), phase: 'game_over', resultMessage: 'Player 2 wins the match!',
    };
    const store = createEngineStore();
    store.publish(state);
    mocks.engine = {
      store, motion: null, getState: () => state, advanceFrame: vi.fn(),
    };
    mocks.snapshot = {
      status: 'playing',
      connected: true,
      roomId: 'ABC234',
      seat: 1,
      playerId: 'player2',
      token: 'resume-token',
      players: [],
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 3,
      gameState: state,
      ack: 1,
      error: 'Player 1 reconnecting (12s)',
    };
    renderOnlineGame();

    const result = screen.getByRole('dialog', { name: 'online match result' });
    expect(within(result).getByRole('status')).toHaveTextContent('Player 1 reconnecting (12s)');
    expect(within(result).getByRole('button', { name: 'Ready for rematch' })).toBeInTheDocument();
  });
});

describe('OnlineGameScreen when the match cannot go on', () => {
  function endedSnapshot(patch: Partial<OnlineSessionSnapshot>): OnlineSessionSnapshot {
    return {
      status: 'closed',
      connected: false,
      roomId: '',
      seat: null,
      playerId: '',
      token: '',
      players: [],
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 3,
      gameState: null,
      ack: -1,
      error: '',
      ...patch,
    };
  }

  beforeEach(() => {
    mocks.engine = {
      store: createEngineStore(), motion: null, getState: () => null, advanceFrame: vi.fn(),
    };
    mocks.leave.mockClear();
    mocks.rejoin.mockClear();
    mocks.resumeStored.mockClear();
  });

  it('sends the player to the online menu once the room is gone', () => {
    mocks.snapshot = endedSnapshot({ error: 'A player did not reconnect in time.' });
    renderOnlineGame();

    const problem = screen.getByRole('alert', { name: 'A player did not reconnect in time' });
    expect(within(problem).queryByRole('button', { name: 'Back to the room' })).not.toBeInTheDocument();
    fireEvent.click(within(problem).getByRole('button', { name: 'Online menu' }));
    expect(mocks.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Online menu page')).toBeInTheDocument();
  });

  it('tries the kept seat again after the session gave up rejoining', () => {
    mocks.snapshot = endedSnapshot({
      roomId: 'ABC234', seat: 1, token: 'resume-token', error: 'Could not rejoin the room.',
    });
    renderOnlineGame();

    const problem = screen.getByRole('alert', { name: 'Could not rejoin the room' });
    fireEvent.click(within(problem).getByRole('button', { name: 'Try again' }));
    expect(mocks.rejoin).toHaveBeenCalledTimes(1);
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(within(problem).getByRole('button', { name: 'Main Menu' }));
    expect(mocks.leave).toHaveBeenCalledTimes(1);
  });

  it('shows a rejoin in progress, and leaves it to the session', () => {
    mocks.snapshot = endedSnapshot({
      status: 'reconnecting',
      roomId: 'ABC234',
      seat: 1,
      token: 'resume-token',
      error: 'Connection lost. Rejoining the room...',
    });
    renderOnlineGame();

    expect(screen.getByRole('status')).toHaveTextContent('Connection lost. Rejoining the room...');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // A second resume from the screen would race the session's own.
    expect(mocks.resumeStored).not.toHaveBeenCalled();
  });
});
