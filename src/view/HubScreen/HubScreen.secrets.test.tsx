import React from 'react';
import {
  fireEvent, render, screen, waitFor, within,
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

const SAND = ['hiddenSand-scroll-cache', 'hiddenSand-archive-fragment', 'hiddenSand-zetsu-burrow'];
const SEEN_LEAF = { seenScenes: ['hiddenLeaf:before'] };

describe('HubScreen secrets, scarves, rebuild and story', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tracks each village\'s secrets and pays the set reward once, unlocking its scarf', () => {
    storeProgress({ ...SEEN_LEAF, currency: 5, discoveredSecrets: [...SAND, 'hiddenLeaf-scroll-cache'] });
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Secrets' }));
    expect(screen.getByText('Secrets · 4 of 21 found')).toBeInTheDocument();
    const leaf = screen.getByRole('list', { name: 'Hidden Leaf secrets' });
    const [scroll, fragment] = within(leaf).getAllByRole('listitem');
    expect(scroll).toHaveTextContent('✓ Found');
    expect(scroll).toHaveTextContent('Story page: The Gatewarden\'s Ledger');
    expect(fragment).toHaveTextContent('○ Not found');
    expect(screen.getByText(/30 Embers \+ the Leaf scarf\. 1 of 3 found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Claim/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hidden Sand: 3 of 3 found, reward ready' }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim 30 Embers + scarf' }));
    expect(screen.getByRole('status')).toHaveTextContent('Claimed 30 Embers and the Sand scarf. 35 Embers to spend.');
    expect(screen.getByLabelText('35 Embers to spend')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Claim/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hidden Sand: 3 of 3 found, set claimed' })).toBeInTheDocument();
    expect(loadStoryProgress()).toMatchObject({ currency: 35, claimedSecretSets: ['hiddenSand'] });

    // The new scarf can be worn from the Village tab.
    fireEvent.click(screen.getByRole('button', { name: 'Village' }));
    const scarves = screen.getByRole('group', { name: 'scarf' });
    fireEvent.click(within(scarves).getByRole('button', { name: 'Sand scarf' }));
    expect(within(scarves).getByRole('button', { name: 'Sand scarf' })).toHaveAttribute('aria-pressed', 'true');
    expect(loadStoryProgress().scarf).toBe('hiddenSand');
  });

  it('says what a locked scarf takes, and wears nothing it has not earned', () => {
    storeProgress(SEEN_LEAF);
    renderHub();
    const scarves = screen.getByRole('group', { name: 'scarf' });
    expect(within(scarves).getByRole('button', { name: 'No scarf' })).toHaveAttribute('aria-pressed', 'true');
    const ember = within(scarves).getByRole('button', { name: 'Ember-thread scarf, locked: Reach Honored standing' });
    expect(ember).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(ember);
    expect(screen.getByRole('status')).toHaveTextContent('Ember-thread scarf: Reach Honored standing.');
    expect(loadStoryProgress().scarf).toBeNull();
  });

  it('shows how far each reached village has rebuilt', () => {
    storeProgress({
      ...SEEN_LEAF,
      reputation: { hiddenLeaf: 23, hiddenSand: 4 },
      unlockedStages: ['hiddenLeaf', 'hiddenSand'],
    });
    renderHub();
    const card = screen.getByRole('region', { name: /Rebuilding · Thriving/ });
    expect(card).toHaveTextContent('23 reputation here. Reach 30 reputation here for the Festival.');
    expect(within(card).getByRole('img', { name: 'stage 2 of 3' })).toBeInTheDocument();
    expect(within(card).getByRole('list', { name: 'every village\'s rebuild' }))
      .toHaveTextContent('Hidden Leaf: ThrivingHidden Sand: Damaged');
  });

  it('shows each villager\'s portrait on their card', () => {
    storeProgress(SEEN_LEAF);
    renderHub();
    const kakashi = screen.getByRole('button', { name: 'Talk to Kakashi Hatake, Copy Ninja' });
    expect(kakashi.querySelector('svg[data-cast="kakashi"]')).not.toBeNull();
    const sakura = screen.getByRole('button', { name: 'Talk to Sakura Haruno, Medical Ninja' });
    expect(sakura.querySelector('svg[data-cast="sakura"]')).not.toBeNull();
  });

  it('plays the village\'s scene before its first deploy only, and replays it without deploying', async () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Deploy Mission' }));
    const scene = screen.getByRole('dialog', { name: 'The Seal Under the Leaf' });
    fireEvent.keyDown(scene, { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/game/1/1/hiddenLeaf'));
    expect(loadStoryProgress().seenScenes).toEqual(['hiddenLeaf:before']);
  });

  it('deploys at once once the scene is seen, and the hub can replay it', async () => {
    storeProgress(SEEN_LEAF);
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Replay: before the mission' }));
    const replay = screen.getByRole('dialog', { name: 'The Seal Under the Leaf' });
    fireEvent.click(within(replay).getByRole('button', { name: 'Skip scene' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/hub/hiddenLeaf');
    // Not cleared yet: no after-victory scene to replay.
    expect(screen.queryByRole('button', { name: 'Replay: after the victory' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deploy Mission' }));
    expect(screen.queryByRole('dialog', { name: 'The Seal Under the Leaf' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/game/1/1/hiddenLeaf'));
  });
});
