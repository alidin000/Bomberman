import React from 'react';
import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import {
  MemoryRouter, Route, Routes, useLocation,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { HubScreen } from './HubScreen';
import {
  StoryProgress, loadStoryProgress, saveStoryProgress,
} from '../../story/progress';

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

function renderHub(route = '/hub/hiddenLeaf') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/hub/:stageId" element={<HubScreen />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>
  );
}

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

describe('HubScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens on Deploy Mission, so a returning player deploys with one press', () => {
    renderHub();
    expect(screen.getByRole('dialog', { name: 'Hidden Leaf Hub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deploy Mission' })).toHaveFocus();
    expect(screen.getByText('Village 1 of 7 · Mission ready')).toBeInTheDocument();
  });

  it('talks with a villager through a short branch and back', () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Wren, Gatewarden' }));

    const talk = screen.getByLabelText('Talking to Wren');
    expect(within(talk).getByRole('heading', { name: /Wren/ })).toHaveFocus();
    expect(talk).toHaveTextContent('The woods past the gate are crawling tonight.');
    fireEvent.click(within(talk).getByRole('button', { name: 'Anything hidden nearby?' }));
    expect(talk).toHaveTextContent('You: Anything hidden nearby?');
    expect(talk).toHaveTextContent('bricked up by the north wall');
    // The asked question gives way to the other branch.
    expect(within(talk).queryByRole('button', { name: 'Anything hidden nearby?' })).not.toBeInTheDocument();
    fireEvent.click(within(talk).getByRole('button', { name: 'Who is out there?' }));
    expect(talk).toHaveTextContent('They hunt in pairs.');

    fireEvent.click(within(talk).getByRole('button', { name: 'Goodbye' }));
    expect(screen.queryByLabelText('Talking to Wren')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk to Wren, Gatewarden' })).toHaveFocus();
  });

  it('greets differently once the village is cleared', () => {
    storeProgress({ completedStages: ['hiddenLeaf'] });
    renderHub();
    expect(screen.getByText('Village 1 of 7 · Cleared')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk to Old Hobb, Tea Seller' }))
      .toHaveTextContent('The kettle is on');
  });

  it('buys from the shop, and says why a purchase it cannot afford is blocked', () => {
    storeProgress({ currency: 30 });
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
    expect(screen.getByLabelText('30 Embers to spend')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Buy · 15: Paper Ward, 15 Embers' }));
    expect(screen.getByLabelText('15 Embers to spend')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Packed Paper Ward. 15 Embers left.');
    expect(screen.getByText('Pack 1/1 · full: unpack an item to swap it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pack full: Lodestone Charm, 15 Embers' }))
      .toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Unpack: Paper Ward, 15 Embers' })).toBeInTheDocument();
    expect(loadStoryProgress().pack).toEqual(['paperWard']);

    const train = screen.getByRole('button', { name: 'Train · 70: Satchel Strap rank 1, 70 Embers' });
    expect(train).toHaveAttribute('aria-disabled', 'true');
    expect(train).toHaveAccessibleDescription(/Need 55 Embers more\./);
    fireEvent.click(train);
    expect(screen.getByRole('status')).toHaveTextContent('Satchel Strap: Need 55 Embers more.');
    expect(loadStoryProgress().currency).toBe(15);
    expect(loadStoryProgress().upgradeRanks).toEqual({});
  });

  it('shows found lore and keeps the rest unknown', () => {
    storeProgress({ discoveredSecrets: ['hiddenSand-archive-fragment'] });
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    expect(screen.getByText('Codex · 1 of 21 found')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Hidden Leaf codex' }))
      .getAllByText('Unknown entry')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Hidden Sand' }));
    const sand = screen.getByRole('list', { name: 'Hidden Sand codex' });
    expect(within(sand).getByRole('heading', { name: 'Glass Memory' })).toBeInTheDocument();
    expect(sand).toHaveTextContent('caught mid-stride');
    expect(within(sand).getAllByText('Unknown entry')).toHaveLength(2);
  });

  it('goes back to the Mission Deck with Escape, after closing a talk first', () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Wren, Gatewarden' }));
    fireEvent.keyDown(screen.getByLabelText('Talking to Wren'), { key: 'Escape' });
    expect(screen.queryByLabelText('Talking to Wren')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/hub/hiddenLeaf');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Deploy Mission' }), { key: 'Escape' });
    expect(screen.getByTestId('location')).toHaveTextContent('/config');
  });

  it('opens the current village instead of one that is still locked', () => {
    renderHub('/hub/greatShinobiWar');
    expect(screen.getByTestId('location')).toHaveTextContent('/hub/hiddenLeaf');
    expect(screen.getByRole('dialog', { name: 'Hidden Leaf Hub' })).toBeInTheDocument();
  });
});
