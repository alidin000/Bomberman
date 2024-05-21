/* eslint-disable react/button-has-type */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSettingsProvider, useGameSettings } from './GameSettingsContext';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const TestComponent = () => {
  const { playerKeyBindings, setPlayerKeyBindings } = useGameSettings();

  return (
    <div>
      <div data-testid="player1-keys">{playerKeyBindings[1].join(', ')}</div>
      <div data-testid="player2-keys">{playerKeyBindings[2].join(', ')}</div>
      <div data-testid="player3-keys">{playerKeyBindings[3].join(', ')}</div>
      <button
        onClick={() => setPlayerKeyBindings((prev) => ({
          ...prev,
          1: ['i', 'j', 'k', 'l', '5', '6'],
        }))}
      >
        Change Player 1 Keys
      </button>
    </div>
  );
};

describe('GameSettingsProvider', () => {
  test('provides default key bindings', () => {
    render(
      <GameSettingsProvider>
        <TestComponent />
      </GameSettingsProvider>
    );

    expect(screen.getByTestId('player1-keys').textContent).toBe('w, a, s, d, 2, 3');
    expect(screen.getByTestId('player2-keys').textContent).toBe('ArrowUp, ArrowLeft, ArrowDown, ArrowRight, o, p');
    expect(screen.getByTestId('player3-keys').textContent).toBe('u, h, j, k, 7, 8');
  });

  const user = userEvent;
  test('updates key bindings', async () => {
    render(
      <GameSettingsProvider>
        <TestComponent />
      </GameSettingsProvider>
    );

    await user.click(screen.getByText('Change Player 1 Keys'));

    expect(screen.getByTestId('player1-keys').textContent).toBe('i, j, k, l, 5, 6');
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
