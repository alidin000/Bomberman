import { vi, type Mock } from 'vitest';
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { BrowserRouter, useNavigate, NavigateFunction } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { WelcomeScreen } from './WelcomeScreen';
import { setTouchMode } from '../../input/touchMode';

vi.mock('react-router-dom', async () => {
  const originalModule = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...originalModule,
    useNavigate: vi.fn(),
  };
});

describe('WelcomeScreen', () => {
  let mockNavigate: Mock<NavigateFunction>;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    global.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('###\n# #\n###'),
    }) as Mock;
  });

  const setup = () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <WelcomeScreen />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('puts Battle a CPU first on a touch screen: a phone is one player', async () => {
    setTouchMode(true);
    try {
      setup();
      const cpu = screen.getByRole('button', { name: /battle a cpu/i });
      const quick = screen.getByRole('button', { name: /quick play/i });
      expect(cpu).toHaveFocus();
      // First in reading and Tab order, and the summary describes it.
      const order = screen.getAllByRole('button');
      expect(order.indexOf(cpu)).toBeLessThan(order.indexOf(quick));
      expect(cpu).toHaveAccessibleDescription(/Deidara vs Naruto \(CPU Normal\)/);
      expect(screen.getByText(/Touch controls: slide a thumb low on the left/)).toBeInTheDocument();

      fireEvent.click(cpu);
      await waitFor(() => {
        expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
          mode: 'local', controllers: ['human', 'cpu-normal'],
        });
      });
    } finally {
      setTouchMode(false);
    }
  });

  it('should display the game title', () => {
    setup();
    expect(screen.getByText('Explosive Shinobi Arena')).toBeInTheDocument();
  });

  it('should navigate to /config when Enter the Arena is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /enter the arena/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/config');
  });

  it('should navigate to /instructions when Shinobi Manual is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /shinobi manual/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/instructions');
  });

  it('focuses Quick Play on arrival so one key press starts a match', () => {
    setup();
    expect(screen.getByRole('button', { name: /quick play/i })).toHaveFocus();
  });

  it('starts the current campaign mission from Quick Play on a first visit', async () => {
    setup();
    expect(screen.getByText(/Mission 1 · Hidden Leaf Emergency · Deidara/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quick play/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'solo',
        stageId: 'hiddenLeaf',
        selectedCharacters: ['deidara'],
      });
      expect(localStorage.getItem('selectedMap')).not.toBeNull();
    });
  });

  it('keeps the round count when Quick Play rematches a best-of match', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenMist',
      selectedCharacters: ['gaara', 'itachi'],
      rounds: '3',
    }));
    setup();
    expect(screen.getByText(/Gaara vs Itachi · Best of 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quick play/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/3/hiddenMist');
    });
  });

  it('keeps the CPU opponents in a Quick Play rematch', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenMist',
      selectedCharacters: ['gaara', 'itachi'],
      selectedUpgrade: 'extraClay',
      controllers: ['human', 'cpu-hard'],
    }));
    setup();
    expect(screen.getByText(/Local rematch · Hidden Mist Village · Gaara vs Itachi \(CPU Hard\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quick play/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenMist');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        controllers: ['human', 'cpu-hard'],
      });
    });
  });

  it('starts a local match against one CPU Normal from Battle a CPU on a first visit', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /battle a cpu/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenLeaf');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        stageId: 'hiddenLeaf',
        selectedCharacters: ['deidara', 'naruto'],
        controllers: ['human', 'cpu-normal'],
        rounds: '1',
      });
    });
  });

  it('keeps the last local stage, shinobi and rounds when battling a CPU', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenMist',
      selectedCharacters: ['gaara', 'itachi', 'minato'],
      rounds: '3',
    }));
    setup();
    // Quick Play keeps its rematch and stays the focused default.
    expect(screen.getByRole('button', { name: /quick play/i })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /battle a cpu/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/3/hiddenMist');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        selectedCharacters: ['gaara', 'itachi'],
        controllers: ['human', 'cpu-normal'],
      });
    });
  });

  it('offers a rematch of the last local battle from Quick Play', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenMist',
      selectedCharacters: ['gaara', 'itachi'],
      selectedUpgrade: 'extraClay',
    }));
    localStorage.setItem('playerKeyBindings', JSON.stringify({
      1: ['w', 'a', 's', 'd', 'e', '1', '3', '4'],
      2: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'o', 'i', 'p', '['],
      3: ['u', 'h', 'j', 'k', '7', '6', '8', '9'],
    }));
    setup();
    expect(screen.getByText(/Local rematch · Hidden Mist Village · Gaara vs Itachi/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quick play/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenMist');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        selectedCharacters: ['gaara', 'itachi'],
      });
      // The player's own key bindings carry over unchanged.
      expect(JSON.parse(localStorage.getItem('playerKeyBindings') as string)[1][4]).toBe('e');
    });
  });
});
