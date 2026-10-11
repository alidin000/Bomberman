import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
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
  resumeStored: vi.fn(() => true),
  setRematch: vi.fn(),
  useOnlineInput: vi.fn(),
  snapshot: null as OnlineSessionSnapshot | null,
  engine: null as {
    store: PublishingEngineStore;
    motion: null;
    getState: () => GameEngineState;
    advanceFrame: (now: number) => void;
  } | null,
}));

vi.mock('../../network/onlineSession', () => ({
  getOnlineSession: () => ({
    input: mocks.input,
    leave: mocks.leave,
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
    expect(mocks.useOnlineInput).toHaveBeenCalledWith(expect.anything(), true);
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
