import React from 'react';
import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import { OnlineSessionSnapshot } from '../../network/onlineSession';
import theme from '../../theme/InstructionsTheme';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  rejoin: vi.fn(),
  resumeStored: vi.fn(),
  selectCharacter: vi.fn(),
  setReady: vi.fn(),
  startMatch: vi.fn(),
  snapshot: {
    status: 'idle',
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
  } as OnlineSessionSnapshot,
}));

vi.mock('../../network/onlineSession', () => ({
  getOnlineSession: () => ({
    create: mocks.create,
    join: mocks.join,
    leave: mocks.leave,
    rejoin: mocks.rejoin,
    resumeStored: mocks.resumeStored,
    selectCharacter: mocks.selectCharacter,
    setReady: mocks.setReady,
    startMatch: mocks.startMatch,
  }),
}));

vi.mock('../../hooks/useOnlineGame', () => ({
  useOnlineSessionSnapshot: () => mocks.snapshot,
}));

function renderLobby(route = '/online') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/online" element={<OnlineLobbyScreen />} />
          <Route path="/online/:roomId" element={<OnlineLobbyScreen />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('OnlineLobbyScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.create.mockClear();
    mocks.join.mockClear();
    mocks.leave.mockClear();
    mocks.resumeStored.mockClear();
    mocks.setReady.mockClear();
    mocks.startMatch.mockClear();
    mocks.snapshot = {
      status: 'idle',
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
    };
  });

  it('creates a private room with the chosen identity', () => {
    renderLobby();
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Hinata' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sasuke' }));
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    expect(mocks.create).toHaveBeenCalledWith('Hinata', 'sasuke', 'coop', 'hiddenLeaf', 3);
  });

  it('creates an arena with the selected village and rounds', () => {
    renderLobby();
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Hinata' } });
    fireEvent.click(screen.getByRole('button', { name: /Online Arena/i }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'arena' }));
    fireEvent.click(screen.getByRole('option', { name: 'Hidden Sand Village' }));
    fireEvent.click(screen.getByRole('button', { name: '5 rounds' }));
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    expect(mocks.create).toHaveBeenCalledWith('Hinata', 'naruto', 'arena', 'hiddenSand', 5, 'hiddenSand');
  });

  it('creates an arena on a city, and lists every city but the playtest\'s control', () => {
    renderLobby();
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Hinata' } });
    fireEvent.click(screen.getByRole('button', { name: /Online Arena/i }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'arena' }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['Rome', 'Barcelona', 'Budapest', 'Hidden Leaf Village']));
    expect(options.some((label) => /control/i.test(label ?? ''))).toBe(false);
    fireEvent.click(screen.getByRole('option', { name: 'Budapest' }));
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    // A city names a village for the room's stage; the map is the city.
    expect(mocks.create).toHaveBeenCalledWith('Hinata', 'naruto', 'arena', 'hiddenLeaf', 3, 'budapest');
  });

  it('keeps co-op rooms on a village', () => {
    renderLobby();
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Hinata' } });
    fireEvent.click(screen.getByRole('button', { name: /Co-op/i }));
    expect(screen.queryByRole('combobox', { name: 'arena' })).toBeNull();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'village' }));
    expect(screen.queryByRole('option', { name: 'Rome' })).toBeNull();
  });

  it('prefills an invite code and joins it', () => {
    renderLobby('/online/ABC234');
    expect(mocks.resumeStored).toHaveBeenCalledWith('ABC234');
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Shikamaru' } });
    expect(screen.getByLabelText('room code')).toHaveValue('ABC234');
    fireEvent.click(screen.getByRole('button', { name: /join room/i }));
    expect(mocks.join).toHaveBeenCalledWith('ABC234', 'Shikamaru', 'naruto');
  });

  it('shows both seats and readies only the local seat', () => {
    mocks.snapshot = {
      ...mocks.snapshot,
      status: 'lobby',
      connected: true,
      roomId: 'ABC234',
      seat: 0,
      players: [
        {
          seat: 0, name: 'Hinata', characterId: 'naruto', ready: false, connected: true
        },
        {
          seat: 1, name: 'Shikamaru', characterId: 'sasuke', ready: true, connected: true
        },
      ],
      roomMode: 'coop',
      stageId: 'hiddenSand',
      arenaMapId: 'hiddenSand',
      capacity: 4,
      totalRounds: 1,
    };
    renderLobby('/online/ABC234');
    expect(screen.getByText('P1 · Hinata · Host')).toBeInTheDocument();
    expect(screen.getByText('P2 · Shikamaru')).toBeInTheDocument();
    expect(screen.getByText('P3 · Open')).toBeInTheDocument();
    expect(screen.getByText('P4 · Open')).toBeInTheDocument();
    expect(screen.getByText(/2 open seats/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
    expect(mocks.setReady).toHaveBeenCalledWith(true);
  });

  it('lets the ready host start without filling all four seats', () => {
    mocks.snapshot = {
      ...mocks.snapshot,
      status: 'lobby',
      connected: true,
      roomId: 'ABC234',
      seat: 0,
      players: [
        {
          seat: 0, name: 'Host', characterId: 'naruto', ready: true, connected: true,
        },
        {
          seat: 1, name: 'Friend', characterId: 'sasuke', ready: true, connected: true,
        },
      ],
    };
    renderLobby('/online/ABC234');
    fireEvent.click(screen.getByRole('button', { name: 'Start battle' }));
    expect(mocks.startMatch).toHaveBeenCalledTimes(1);
  });
});

describe('OnlineLobbyScreen connection states', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.create.mockClear();
    mocks.leave.mockClear();
    mocks.snapshot = {
      status: 'idle',
      connected: false,
      roomId: '',
      seat: null,
      playerId: '',
      token: '',
      players: [],
      roomMode: 'coop',
      stageId: 'hiddenLeaf',
      arenaMapId: 'hiddenLeaf',
      capacity: 4,
      totalRounds: 3,
      gameState: null,
      ack: -1,
      error: '',
    };
  });

  it('shows a room-shaped skeleton, not the forms, while the socket opens', () => {
    mocks.snapshot = { ...mocks.snapshot, status: 'connecting' };
    renderLobby();

    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the online server...');
    expect(screen.queryByRole('button', { name: /create room/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main Menu' })).toBeInTheDocument();
  });

  it('says what failed inline and tries the same create again', () => {
    mocks.create.mockImplementationOnce(() => {
      mocks.snapshot = {
        ...mocks.snapshot, status: 'closed', error: 'Could not connect to the online server.',
      };
    });
    renderLobby();
    fireEvent.change(screen.getByLabelText('display name'), { target: { value: 'Hinata' } });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));

    const problem = screen.getByRole('alert', { name: 'Could not reach the online server' });
    expect(problem).toHaveTextContent('Check your connection, then try again in a moment.');
    fireEvent.click(within(problem).getByRole('button', { name: 'Try again' }));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith('Hinata', 'naruto', 'coop', 'hiddenLeaf', 3);

    fireEvent.click(within(problem).getByRole('button', { name: 'Main Menu' }));
    expect(mocks.leave).toHaveBeenCalledTimes(1);
  });

  it('tries the seat it still holds again, not a new room, after rejoining gave up', () => {
    mocks.join.mockClear();
    mocks.rejoin.mockClear();
    mocks.snapshot = {
      ...mocks.snapshot,
      status: 'closed',
      roomId: 'ABC234',
      seat: 0,
      token: 'resume-token',
      error: 'Could not rejoin the room.',
    };
    renderLobby('/online/ABC234');

    const problem = screen.getByRole('alert', { name: 'Could not rejoin the room' });
    fireEvent.click(within(problem).getByRole('button', { name: 'Try again' }));
    expect(mocks.rejoin).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it('offers no try again when this build has no online server', () => {
    mocks.snapshot = {
      ...mocks.snapshot, status: 'closed', error: 'Online play is not configured on this build.',
    };
    renderLobby();

    const problem = screen.getByRole('alert', { name: 'Online play is off in this build' });
    expect(within(problem).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(within(problem).getByRole('button', { name: 'Main Menu' })).toBeInTheDocument();
  });
});
