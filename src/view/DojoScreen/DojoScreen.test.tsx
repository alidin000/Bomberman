import { vi, type Mock } from 'vitest';
import React from 'react';
import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter, NavigateFunction, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { WelcomeScreen } from '../WelcomeScreen/WelcomeScreen';
import { InstructionsScreen } from '../InstructionsScreen/InstructionsScreen';
import { ConfigScreen } from '../ConfigScreen/ConfigScreen';
import { DojoScreen } from './DojoScreen';

vi.mock('react-router-dom', async () => {
  const originalModule = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...originalModule, useNavigate: vi.fn() };
});

let mockNavigate: Mock<NavigateFunction>;

function show(element: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{element}</ThemeProvider>
    </MemoryRouter>
  );
}

const suggestion = () => screen.queryByRole('complementary', { name: 'Training Dojo suggestion' });

describe('Training Dojo entry points', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
  });

  it('suggests the dojo once: the next visit to the title screen goes without it', () => {
    const first = show(<WelcomeScreen />);
    expect(suggestion()).toBeInTheDocument();
    first.unmount();

    // Nothing was played or dismissed; it was shown, and that is enough.
    show(<WelcomeScreen />);
    expect(suggestion()).not.toBeInTheDocument();
  });

  it('never stands in the way of Quick Play: still focused, and one press starts', async () => {
    show(<WelcomeScreen />);
    expect(suggestion()).toBeInTheDocument();
    const quickPlay = screen.getByRole('button', { name: /quick play/i });
    expect(quickPlay).toHaveFocus();

    fireEvent.click(quickPlay);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('opens the room list from the suggestion, and "Not now" puts it away', () => {
    show(<WelcomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Train in the Dojo' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dojo');

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(suggestion()).not.toBeInTheDocument();
  });

  it('does not suggest the dojo to a player who already trained there', () => {
    localStorage.setItem('shinobiDojoProgress', JSON.stringify({ cleared: ['lanternWalk'] }));
    show(<WelcomeScreen />);
    expect(suggestion()).not.toBeInTheDocument();
  });

  it('opens the dojo from the Mission Deck campaign briefing', () => {
    show(<ConfigScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Training Dojo' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dojo');
  });

  it('links the dojo from the Shinobi Manual', () => {
    show(<InstructionsScreen />);
    expect(screen.getByRole('link', { name: /try the inkstone dojo/i }))
      .toHaveAttribute('href', '/dojo');
  });
});

describe('DojoScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
  });

  it('starts at the first room on a first visit, and leaving is one press', () => {
    show(<DojoScreen />);
    const start = screen.getByRole('button', { name: /start training/i });
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(mockNavigate).toHaveBeenCalledWith('/dojo/lanternWalk');

    fireEvent.click(screen.getByRole('button', { name: 'Skip the dojo' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/');
  });

  it('shows saved progress and continues at the first room neither cleared nor skipped', () => {
    localStorage.setItem('shinobiDojoProgress', JSON.stringify({
      version: 1, cleared: ['lanternWalk'], skipped: ['fuseStep'],
    }));
    show(<DojoScreen />);
    const rooms = within(screen.getByRole('list', { name: 'training rooms' })).getAllByRole('listitem');
    expect(rooms.map((room) => room.querySelector('span')?.textContent)).toEqual([
      'Room 1 · Cleared', 'Room 2 · Skipped', 'Room 3 · New', 'Room 4 · New',
    ]);

    const resume = screen.getByRole('button', { name: 'Continue: Pillar Shade' });
    expect(resume).toHaveFocus();
    fireEvent.click(resume);
    expect(mockNavigate).toHaveBeenCalledWith('/dojo/pillarShade');

    // Any room replays, cleared or skipped.
    fireEvent.click(screen.getByRole('button', { name: 'Replay room 1: Lantern Walk' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/dojo/lanternWalk');
    fireEvent.click(screen.getByRole('button', { name: 'Play room 2: Fuse Step' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/dojo/fuseStep');
  });

  it('comes back for skipped rooms once every other room is cleared', () => {
    localStorage.setItem('shinobiDojoProgress', JSON.stringify({
      cleared: ['lanternWalk', 'pillarShade', 'scrollSentry'], skipped: ['fuseStep'],
    }));
    show(<DojoScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue: Fuse Step' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dojo/fuseStep');
  });

  it('offers the main menu once every room is cleared', () => {
    localStorage.setItem('shinobiDojoProgress', JSON.stringify({
      cleared: ['lanternWalk', 'fuseStep', 'pillarShade', 'scrollSentry'],
    }));
    show(<DojoScreen />);
    expect(screen.queryByRole('button', { name: /continue|start training/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main Menu' })).toHaveFocus();
  });
});
