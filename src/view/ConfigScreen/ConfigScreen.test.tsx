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
    const title = screen.getByText('Mission Deck');
    expect(title).toBeInTheDocument();
  });

  it('should show the selected campaign mission briefing', () => {
    setup();
    expect(screen.getByText('Hidden Leaf Emergency')).toBeInTheDocument();
    expect(screen.getByText('Rescue Villagers')).toBeInTheDocument();
    expect(screen.getByText('Protect Hokage Building')).toBeInTheDocument();
    expect(screen.getByText('Deploy Mission')).toBeInTheDocument();
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
    expect(screen.getAllByText('Upgrade Arsenal').length).toBeGreaterThan(0);
  });

  it('should proceed from upgrade screen to keyboard configuration', () => {
    setup(2);
    expect(screen.getByText('Key Bindings')).toBeInTheDocument();
  });

  it('should handle key configuration without errors', () => {
    setup(2);
    const playerInput = screen.getByDisplayValue('W');
    fireEvent.keyDown(playerInput, { key: 'E' });
    const noErrorMessages = screen.queryByText('Please correct the highlighted key conflicts before proceeding.');
    expect(noErrorMessages).not.toBeInTheDocument();
  });

  it('keeps keyboard navigation available on key inputs', () => {
    setup(2);
    const playerInput = screen.getByDisplayValue('W');

    expect(fireEvent.keyDown(playerInput, { key: 'Tab' })).toBe(true);
  });

  it('shows a readable label when Space is assigned', () => {
    setup(2);
    const playerInput = screen.getByDisplayValue('W');

    fireEvent.keyDown(playerInput, { key: ' ' });

    expect(screen.getByDisplayValue('Space')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Local Arena'));
    expect(screen.getByLabelText('Hidden Sand Village')).toBeInTheDocument();
    expect(screen.getByLabelText('Hidden Mist Village')).toBeInTheDocument();
    expect(screen.getByLabelText('Akatsuki Hideout')).toBeInTheDocument();
  });

  it('should use campaign route cards instead of the arena grid in solo setup', () => {
    setup();
    expect(screen.getByLabelText('Hidden Leaf campaign route')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hidden Leaf Village')).not.toBeInTheDocument();
  });

  it('should select a stage when a stage button is clicked', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    const mistButton = screen.getByLabelText('Hidden Mist Village');
    fireEvent.click(mistButton);
    expect(screen.getByText('Water cannons fire long telegraphed lines.')).toBeInTheDocument();
  });

  it('should not ask players to choose rounds in local setup', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));

    expect(screen.queryByText('Victory Seals:')).not.toBeInTheDocument();
    expect(screen.getByText('Shinobi Count:')).toBeInTheDocument();
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
    // Continue Campaign only shows once the selection differs from the saved run.
    fireEvent.click(screen.getByLabelText('Hidden Leaf campaign route'));

    const [continueButton] = screen.getAllByText('Continue Campaign');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(localStorage.getItem('selectedMap')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).toContain('hiddenMist');
      expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenMist');
    });
  });

  it('should start the selected campaign mission directly from the briefing', async () => {
    setup();

    fireEvent.click(screen.getByText('Deploy Mission'));

    await waitFor(() => {
      expect(localStorage.getItem('selectedMap')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).toContain('hiddenLeaf');
      expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf');
    });
  });

  it('does not carry a locked local stage into solo campaign', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByLabelText('Akatsuki Hideout'));
    fireEvent.click(screen.getByText('Solo Campaign'));
    fireEvent.click(screen.getByText('Deploy Mission'));

    await waitFor(() => {
      expect(localStorage.getItem('gameSetup')).toContain('hiddenLeaf');
      expect(localStorage.getItem('gameSetup')).not.toContain('akatsukiHideout');
    });
  });

  it('hides Continue Campaign while it would repeat Deploy Mission', () => {
    setup();
    expect(screen.getByText('Deploy Mission')).toBeInTheDocument();
    expect(screen.queryByText('Continue Campaign')).not.toBeInTheDocument();
  });

  it('starts a local battle from the setup step without the controls step', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByLabelText('Hidden Mist Village'));
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenMist');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        stageId: 'hiddenMist',
        selectedCharacters: ['deidara', 'naruto'],
      });
      expect(localStorage.getItem('playerKeyBindings')).not.toBeNull();
    });
  });

  it('reopens on the last local battle setup', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenCloud',
      selectedCharacters: ['gaara', 'itachi', 'minato'],
      selectedUpgrade: 'extraClay',
    }));
    setup();

    expect(screen.getByLabelText('Hidden Cloud Village')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Itachi player 2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/3/1/hiddenCloud');
    });
  });

  it('goes back one step on Escape instead of leaving the deck', () => {
    setup(1);
    expect(screen.getAllByText('Upgrade Arsenal').length).toBeGreaterThan(0);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.getByText('Mission Deck')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows each stage mechanic on its own line under the stage name', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    const mechanic = screen.getByText('Water cannons fire long telegraphed lines.');

    expect(window.getComputedStyle(mechanic).display).toBe('block');
  });

  it('says which village unlocks a locked campaign shinobi', () => {
    setup();
    const naruto = screen.getByLabelText('Naruto player 1, locked');

    expect(naruto).toBeDisabled();
    expect(naruto).toHaveTextContent('Clear Hidden Leaf');
  });

  it('should save configuration and navigate to game screen on play', async () => {
    setup(2);
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    await waitFor(() => {
      expect(localStorage.getItem('playerKeyBindings')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).not.toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf');
    });
  });
});
