import { vi, type Mock } from 'vitest';
/* eslint-disable no-plusplus */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { BrowserRouter, useNavigate, NavigateFunction } from 'react-router-dom';
import { ConfigScreen } from './ConfigScreen';
import { STORY_PROGRESS_KEY } from '../../story/progress';

vi.mock('react-router-dom', async () => {
  const originalModule = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...originalModule,
    useNavigate: vi.fn(),
  };
});

const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('ConfigScreen', () => {
  let mockNavigate: Mock<NavigateFunction>;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    global.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('###########\n#         #\n###########'),
    }) as Mock;
  });

  const setup = (step = 0) => {
    render(
      <BrowserRouter>
        <ConfigScreen />
      </BrowserRouter>
    );
    if (step > 0) {
      for (let i = 0; i < step; i++) {
        fireEvent.click(screen.getByText('Next'));
      }
    }
  };

  it('should initialize with the game configuration step', () => {
    setup();
    const title = screen.getByText('Story Mode Setup');
    expect(title).toBeInTheDocument();
  });

  it('should show the selected campaign mission briefing', () => {
    setup();
    expect(screen.getByText('Hidden Leaf Emergency')).toBeInTheDocument();
    expect(screen.getByText('Rescue Villagers')).toBeInTheDocument();
    expect(screen.getByText('Protect Hokage Building')).toBeInTheDocument();
    expect(screen.getByText('Start Mission')).toBeInTheDocument();
  });

  it('should navigate to the home page when the cancel button is clicked', () => {
    setup();
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should proceed to the next step when the next button is clicked', () => {
    setup();
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    expect(screen.getAllByText('Upgrade Screen').length).toBeGreaterThan(0);
  });

  it('should proceed from upgrade screen to keyboard configuration', () => {
    setup(2);
    expect(screen.getByText('Keyboard Configuration')).toBeInTheDocument();
  });

  it('should handle key configuration without errors', () => {
    setup(2);
    const playerInput = screen.getByDisplayValue('W');
    fireEvent.keyDown(playerInput, { key: 'E' });
    const noErrorMessages = screen.queryByText('Please correct the highlighted key conflicts before proceeding.');
    expect(noErrorMessages).not.toBeInTheDocument();
  });

  it('should display an error when there is a key conflict', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByText('Next'));
    const playerInputs = screen.getAllByRole('textbox');
    fireEvent.keyDown(playerInputs[0], { key: 'A' });
    fireEvent.keyDown(playerInputs[8], { key: 'A' });
    const errorMessage = screen.getByText('Please correct the highlighted key conflicts before proceeding.');
    expect(errorMessage).toBeInTheDocument();
  });

  it('should render stage selection buttons', () => {
    setup();
    expect(screen.getByLabelText('Hidden Sand Village')).toBeInTheDocument();
    expect(screen.getByLabelText('Hidden Mist Village')).toBeInTheDocument();
    expect(screen.getByLabelText('Akatsuki Hideout')).toBeInTheDocument();
  });

  it('should select a stage when a stage button is clicked', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    const mistButton = screen.getByLabelText('Hidden Mist Village');
    fireEvent.click(mistButton);
    expect(screen.getByText('Water cannons fire long telegraphed lines.')).toBeInTheDocument();
  });

  it('should continue campaign from the saved village', async () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: 1,
      completedBosses: ['shukaku'],
      completedStages: ['hiddenSand'],
      unlockedCharacters: ['deidara', 'gaara'],
      unlockedStages: ['hiddenLeaf', 'hiddenSand', 'hiddenMist'],
      unlockedUpgrades: ['extraClay'],
      selectedUpgrade: 'extraClay',
      lastCharacter: 'gaara',
      lastStage: 'hiddenMist',
      currentFlowStep: 'exploration',
      storyCompleted: false,
    }));
    setup();

    fireEvent.click(screen.getByText('Continue Campaign'));

    await waitFor(() => {
      expect(localStorage.getItem('selectedMap')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).toContain('hiddenMist');
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/game\/1\/1\/hiddenMist/));
    });
  });

  it('should start the selected campaign mission directly from the briefing', async () => {
    setup();

    fireEvent.click(screen.getByText('Start Mission'));

    await waitFor(() => {
      expect(localStorage.getItem('selectedMap')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).toContain('hiddenLeaf');
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/game\/1\/1\/hiddenLeaf/));
    });
  });

  it('should save configuration and navigate to game screen on play', async () => {
    setup(2);
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    await waitFor(() => {
      expect(localStorage.getItem('playerKeyBindings')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).not.toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/game\/\d+\/\d+\/hiddenLeaf/));
    });
  });
});
