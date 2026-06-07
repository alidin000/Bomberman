/* eslint-disable no-plusplus */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { BrowserRouter, useNavigate, NavigateFunction } from 'react-router-dom';
import { ConfigScreen } from './ConfigScreen';

jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    useNavigate: jest.fn(),
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
  let mockNavigate: jest.Mock<NavigateFunction>;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    global.fetch = jest.fn().mockResolvedValue({
      text: () => Promise.resolve('###########\n#         #\n###########'),
    }) as jest.Mock;
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
    fireEvent.keyDown(playerInputs[6], { key: 'A' });
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
    const mistButton = screen.getByLabelText('Hidden Mist Village');
    fireEvent.click(mistButton);
    expect(screen.getByText('Water cannons fire long telegraphed lines.')).toBeInTheDocument();
  });

  it('should save configuration and navigate to game screen on play', async () => {
    setup(2);
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    await waitFor(() => {
      expect(localStorage.getItem('playerKeyBindings')).not.toBeNull();
      expect(localStorage.getItem('gameSetup')).not.toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/game\/\d+\/\d+\/hiddenSand/));
    });
  });
});
