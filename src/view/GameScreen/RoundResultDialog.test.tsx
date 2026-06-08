import { vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoundResultDialog } from './RoundResultDialog';

describe('RoundResultDialog', () => {
  it('restarts the current match with the same setup from game over', () => {
    const handleRestart = vi.fn();

    render(
      <MemoryRouter>
        <RoundResultDialog
          open
          onClose={vi.fn()}
          onRestart={handleRestart}
          resultMessage="Kurama has been sealed!"
          isGameOver
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Retry Same Setup'));

    expect(handleRestart).toHaveBeenCalledTimes(1);
  });
});
