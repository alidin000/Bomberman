import { vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoundResultDialog } from './RoundResultDialog';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';

describe('RoundResultDialog', () => {
  it('restarts the current match with the same setup from game over', () => {
    const handleRestart = vi.fn();
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={handleRestart}
          resultMessage="Kurama has been sealed!"
          isGameOver
          state={state}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Retry Same Setup'));

    expect(handleRestart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('table')).toHaveAccessibleName('match breakdown');
    expect(screen.getAllByText('Deidara').length).toBeGreaterThan(0);
  });
});
