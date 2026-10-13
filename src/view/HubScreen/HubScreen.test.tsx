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
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Kakashi Hatake, Copy Ninja' }));

    const talk = screen.getByLabelText('Talking to Kakashi Hatake');
    expect(within(talk).getByRole('heading', { name: /Kakashi/ })).toHaveFocus();
    expect(talk).toHaveTextContent('The forest past the gate is crawling with rogues');
    expect(within(talk).getByRole('img', { name: 'Portrait of Kakashi Hatake' })).toBeInTheDocument();
    fireEvent.click(within(talk).getByRole('button', { name: 'Anything hidden nearby?' }));
    expect(talk).toHaveTextContent('You: Anything hidden nearby?');
    expect(talk).toHaveTextContent('north-west, near the outer district, behind a cracked wall');
    // The asked question gives way to the other branch.
    expect(within(talk).queryByRole('button', { name: 'Anything hidden nearby?' })).not.toBeInTheDocument();
    fireEvent.click(within(talk).getByRole('button', { name: 'Who is out there?' }));
    expect(talk).toHaveTextContent('They hunt in pairs.');

    fireEvent.click(within(talk).getByRole('button', { name: 'Goodbye' }));
    expect(screen.queryByLabelText('Talking to Kakashi Hatake')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk to Kakashi Hatake, Copy Ninja' })).toHaveFocus();
  });

  it('greets differently once the village is cleared', () => {
    storeProgress({ completedStages: ['hiddenLeaf'] });
    renderHub();
    expect(screen.getByText('Village 1 of 7 · Cleared')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk to Sakura Haruno, Medical Ninja' }))
      .toHaveTextContent('Everyone is home and patched up.');
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

  it('goes back to the Mission Deck with Escape, after closing a talk first', () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Kakashi Hatake, Copy Ninja' }));
    fireEvent.keyDown(screen.getByLabelText('Talking to Kakashi Hatake'), { key: 'Escape' });
    expect(screen.queryByLabelText('Talking to Kakashi Hatake')).not.toBeInTheDocument();
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
