import React from 'react';
import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { HubScreen } from './HubScreen';
import { StoryProgress, loadStoryProgress, saveStoryProgress } from '../../story/progress';

function renderHub(route = '/hub/hiddenLeaf') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/hub/:stageId" element={<HubScreen />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

describe('HubScreen and the village square', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows standing over every village, the way to the next tier, and what each brings', () => {
    storeProgress({ reputation: { hiddenLeaf: 10, hiddenSand: 6 } });
    renderHub();
    const card = screen.getByRole('region', { name: /Standing · Known/ });
    expect(card).toHaveTextContent('16 of 40 to Trusted');
    expect(within(card).getByRole('progressbar', { name: 'Standing toward Trusted' }))
      .toHaveAttribute('aria-valuenow', '4');
    const tiers = within(card).getByRole('list', { name: 'what standing brings' });
    const [stranger, known, trusted, honored] = within(tiers).getAllByRole('listitem');
    expect(known).toHaveAttribute('aria-current', 'true');
    expect(known).toHaveTextContent('Jiraiya, Toad Sage and Writer, joins every square');
    expect(stranger).toHaveTextContent('Stranger ✓');
    expect(trusted).toHaveTextContent('Trusted · 40');
    expect(trusted).toHaveTextContent('Pell takes a fifth off the stall');
    expect(honored).toHaveTextContent('ember-thread scarf');
  });

  it('previews the next mission\'s board, without what is finished or not reached yet', () => {
    storeProgress({ reputation: { hiddenLeaf: 15 }, completedRequests: ['leaf-tea-tins'] });
    renderHub();
    const board = screen.getByRole('region', { name: /On the square's board/ });
    const list = within(board).getByRole('list', { name: 'requests on the board' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('Rotten Training Posts');
    expect(list).toHaveTextContent('Kakashi Hatake · +15 Embers · +3 reputation');
    expect(board).not.toHaveTextContent('Lost Field Kits');
    expect(board).toHaveTextContent('1 more request from Trusted.');
  });

  it('says in one line what the Secrets are and what finding them pays, with the found count', () => {
    storeProgress({ discoveredSecrets: ['hiddenLeaf-scroll-cache', 'hiddenSand-zetsu-burrow'] });
    renderHub();
    expect(screen.getByText(
      'Secrets: 2 of 21 found. Each village hides three secret rooms. Find all three for 30 Embers and the village\'s scarf.'
    )).toBeInTheDocument();
  });

  it('keeps Jiraiya on the road while standing is Stranger', () => {
    renderHub();
    expect(screen.queryByRole('button', { name: /Talk to Jiraiya/ })).not.toBeInTheDocument();
  });

  it('lets Jiraiya tell the news once standing is Known, and villagers move on with the story', () => {
    storeProgress({
      reputation: { hiddenLeaf: 10, hiddenSand: 10 },
      completedStages: ['hiddenLeaf', 'hiddenSand'],
      unlockedStages: ['hiddenLeaf', 'hiddenSand', 'hiddenMist'],
    });
    renderHub();
    // The sand village is cleared too: Sakura has heard.
    expect(screen.getByRole('button', { name: 'Talk to Sakura Haruno, Medical Ninja' }))
      .toHaveTextContent('Temari sent a hawk to say thanks.');
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Jiraiya, Toad Sage and Writer' }));
    const talk = screen.getByLabelText('Talking to Jiraiya');
    fireEvent.click(within(talk).getByRole('button', { name: 'Any news from the road?' }));
    expect(talk).toHaveTextContent('Two villages cleared.');
    fireEvent.click(within(talk).getByRole('button', { name: 'What is the shrine for?' }));
    expect(talk).toHaveTextContent('Find all three, then claim the set in the hub: 30 Embers and a scarf');
  });
});
