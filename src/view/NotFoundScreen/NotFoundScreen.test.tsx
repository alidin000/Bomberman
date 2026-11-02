import { vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';

// The title screen fetches the match code once it is idle; keep it light.
vi.mock('../GameScreen/GameScreen', () => ({
  GameScreen: () => <div>GameScreen</div>,
}));

function renderAppAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

describe('NotFoundScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('names the missing path and goes back to the title screen', () => {
    renderAppAt('/no-such-page');

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('/no-such-page')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: 'Main Menu' });
    // Focused on arrival, so Enter or a pad's A leaves straight away.
    expect(back).toHaveFocus();

    fireEvent.click(back);

    expect(screen.getByRole('heading', { level: 1, name: 'Explosive Shinobi Arena' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
  });

  it('goes back to the title screen on Escape, which is also a pad\'s B', () => {
    renderAppAt('/game/2');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Main Menu' }), { key: 'Escape' });

    expect(screen.getByRole('heading', { level: 1, name: 'Explosive Shinobi Arena' })).toBeInTheDocument();
  });

  it('leaves real routes to their own screens', () => {
    renderAppAt('/instructions');

    expect(screen.getByRole('heading', { name: 'Shinobi Field Manual' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
  });
});
