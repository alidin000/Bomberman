import { vi, type Mock } from 'vitest';
/* eslint-disable no-plusplus */
import React from 'react';
import {
  render, screen, fireEvent, waitFor, within,
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

  it('goes back to the main menu from the first step', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));
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
    expect(mistButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Water cannons fire long telegraphed lines\./)).toBeInTheDocument();
  });

  const seat = (label: string) => screen.getByRole('group', { name: new RegExp(`^${label} · `) });

  it('adds a third shinobi from the "Add shinobi" seat and removes it again', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    expect(screen.queryByRole('group', { name: /^P3 · / })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add shinobi/i }));
    expect(within(seat('P3')).getByText('Sasuke')).toBeInTheDocument();
    // Three seats is the most: the add seat is gone.
    expect(screen.queryByRole('button', { name: /add shinobi/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove P3' }));
    expect(screen.queryByRole('group', { name: /^P3 · / })).not.toBeInTheDocument();
    // Two seats is the least: nothing else can be removed.
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add shinobi/i }));
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/3/1/hiddenLeaf');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        selectedCharacters: ['deidara', 'naruto', 'sasuke'],
      });
    });
  });

  it('starts a CPU match from the seat cards: shinobi picker and Human/CPU chip', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    // Each seat names its keys, so players see who plays where.
    expect(within(seat('P1')).getByText('W A S D · Bomb 2')).toBeInTheDocument();
    expect(within(seat('P2')).getByText('↑ ← ↓ → · Bomb O')).toBeInTheDocument();

    fireEvent.click(within(seat('P2')).getByRole('button', { name: 'Next shinobi for P2' }));
    expect(within(seat('P2')).getByText('Sasuke')).toBeInTheDocument();

    // One press makes the seat the usual opponent; more presses walk the levels.
    const chip = screen.getByRole('button', { name: 'P2 controller: Human' });
    fireEvent.click(chip);
    expect(chip).toHaveAccessibleName('P2 controller: CPU Normal');
    expect(within(seat('P2')).getByText('No keys needed')).toBeInTheDocument();
    fireEvent.click(chip);
    expect(chip).toHaveAccessibleName('P2 controller: CPU Hard');
    fireEvent.click(chip);
    expect(chip).toHaveAccessibleName('P2 controller: CPU Easy');
    fireEvent.click(chip);
    expect(chip).toHaveAccessibleName('P2 controller: Human');
    fireEvent.click(chip);

    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenLeaf');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        selectedCharacters: ['deidara', 'sasuke'],
        controllers: ['human', 'cpu-normal'],
      });
    });
  });

  it('flags a key clash on both seats and blocks the start until it is fixed', () => {
    localStorage.setItem('playerKeyBindings', JSON.stringify({
      1: ['w', 'a', 's', 'd', 'o', '1', '3', '4'],
      2: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'o', 'i', 'p', '['],
    }));
    setup();
    fireEvent.click(screen.getByText('Local Arena'));

    expect(within(seat('P1')).getByText('Clashes with P2: O')).toBeInTheDocument();
    expect(within(seat('P2')).getByText('Clashes with P1: O')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start battle/i })).toBeDisabled();

    // A CPU seat needs no keys, so the clash is gone.
    fireEvent.click(screen.getByRole('button', { name: 'P2 controller: Human' }));
    expect(within(seat('P1')).getByText('W A S D · Bomb O')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start battle/i })).toBeEnabled();
  });

  it('makes each toggle group and card grid a single Tab stop', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    const dialog = screen.getByRole('dialog');
    const tabStops = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('button, input, a[href]'))
      .filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
    const groups = within(dialog).getAllByRole('group')
      .filter((group) => !group.parentElement?.closest('[role="group"]'));

    expect(groups.length).toBeGreaterThanOrEqual(4);
    groups.forEach((group) => expect(tabStops(group)).toHaveLength(1));
    // Mode, seats, stage, rounds and the three footer actions.
    expect(tabStops(dialog).length).toBeLessThanOrEqual(8);

    // The stop follows the focus, so Tab returns to the last seat control used.
    const chip = screen.getByRole('button', { name: 'P2 controller: Human' });
    fireEvent.focus(chip);
    expect(chip).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Next shinobi for P1' })).toHaveAttribute('tabindex', '-1');
  });

  it('focuses the selected mode when the deck opens and the new step heading on Next and Back', () => {
    setup();
    expect(screen.getByRole('button', { name: /solo campaign/i })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Upgrade Arsenal' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Mission Deck' })).toHaveFocus();
  });

  it('asks the mission questions in order, with Deploy Mission after them in the footer', () => {
    setup();
    const route = screen.getByLabelText('Hidden Leaf campaign route');
    const difficulty = screen.getByRole('group', { name: 'Difficulty' });
    const shinobi = screen.getByLabelText('Deidara player 1');
    const deploy = screen.getByRole('button', { name: /deploy mission/i });
    const follows = (a: Element, b: Element) => Boolean(
      // eslint-disable-next-line no-bitwise
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(follows(screen.getByText('Hidden Leaf Emergency'), route)).toBe(true);
    expect(follows(route, difficulty)).toBe(true);
    expect(follows(difficulty, shinobi)).toBe(true);
    expect(follows(shinobi, deploy)).toBe(true);
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

  it('starts a one-human, one-CPU battle and asks keys only of the human', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByRole('button', { name: 'P2 controller: Human' }));
    // The last human slot cannot be turned into a CPU.
    expect(screen.getByRole('button', { name: 'P1 controller: Human' })).toBeDisabled();

    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Player 1 Loadout Keys')).toBeInTheDocument();
    expect(screen.queryByText('Player 2 Loadout Keys')).not.toBeInTheDocument();
    expect(screen.getByText('P2 · CPU')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/1/hiddenLeaf');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        controllers: ['human', 'cpu-normal'],
      });
    });
  });

  it('keeps an all-human local battle free of controllers', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem('gameSetup') as string).controllers).toBeUndefined();
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
    expect(within(seat('P1')).getByText('Gaara')).toBeInTheDocument();
    expect(within(seat('P2')).getByText('Itachi')).toBeInTheDocument();
    expect(within(seat('P3')).getByText('Minato')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/3/1/hiddenCloud');
    });
  });

  it('starts a best-of-3 local battle and remembers the round count', async () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByLabelText('Hidden Mist Village'));
    fireEvent.click(screen.getByRole('button', { name: 'best of 3' }));
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/3/hiddenMist');
      expect(JSON.parse(localStorage.getItem('gameSetup') as string)).toMatchObject({
        mode: 'local',
        rounds: '3',
      });
    });
  });

  it('reopens a local battle on its saved round count', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      stageId: 'hiddenCloud',
      selectedCharacters: ['gaara', 'itachi'],
      rounds: '5',
    }));
    setup();

    expect(screen.getByRole('button', { name: 'best of 5' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/2/5/hiddenCloud');
    });
  });

  it('goes back one step on Escape instead of leaving the deck', () => {
    setup(1);
    expect(screen.getAllByText('Upgrade Arsenal').length).toBeGreaterThan(0);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.getByText('Mission Deck')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('describes the selected stage with its rule, once, under the stage strip', () => {
    setup();
    fireEvent.click(screen.getByText('Local Arena'));
    fireEvent.click(screen.getByLabelText('Hidden Mist Village'));

    expect(screen.getByLabelText('Hidden Mist Village'))
      .toHaveAccessibleDescription(/Water cannons fire long telegraphed lines\./);
    expect(screen.getByLabelText('Hidden Leaf Village')).not.toHaveAttribute('aria-describedby');
  });

  it('says which village unlocks a locked campaign shinobi', () => {
    setup();
    const naruto = screen.getByLabelText('Naruto player 1, locked');

    expect(naruto).toBeDisabled();
    expect(naruto).toHaveTextContent('Clear Hidden Leaf');
  });

  it('should save configuration and navigate to game screen on play', async () => {
    setup(2);
    fireEvent.click(screen.getByRole('button', { name: /deploy mission/i }));
    await waitFor(() => {
      expect(localStorage.getItem('playerKeyBindings')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).not.toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf');
    });
  });
});
