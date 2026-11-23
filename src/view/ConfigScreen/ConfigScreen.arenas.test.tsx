import { vi, type Mock } from 'vitest';
import React from 'react';
import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter, NavigateFunction, useNavigate } from 'react-router-dom';
import { ConfigScreen } from './ConfigScreen';
import { CITY_SOURCE_URL, arenaMapRows } from '../../content/arenaMaps';
import { STAGE_DEFINITIONS } from '../../content/stages';
import { STORY_PROGRESS_KEY, loadStoryProgress } from '../../story/progress';

// Local Arena's arena choice in the Mission Deck: the village arenas and the
// city arenas, apart from the campaign's village.

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

const OSM = '© OpenStreetMap contributors';

describe('Mission Deck arena choice', () => {
  let navigate: Mock<NavigateFunction>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(navigate);
  });

  const openDeck = (path = '/config') => render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigScreen />
    </MemoryRouter>
  );
  const arenaChoice = () => screen.getByRole('group', { name: 'Arena' });
  const pickLocalArena = () => fireEvent.click(screen.getByText('Local Arena'));

  it('lists every village arena, then the three cities, each city with its map and credit', () => {
    openDeck();
    pickLocalArena();
    const cards = within(arenaChoice()).getAllByRole('button');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      ...STAGE_DEFINITIONS.map((stage) => stage.name),
      'Rome',
      'Barcelona',
      'Budapest',
    ]);
    cards.slice(STAGE_DEFINITIONS.length).forEach((card) => {
      // A top-down render of its grid and mask, and the OSM credit.
      expect(card.querySelector('svg[data-city-preview] path')).not.toBeNull();
      expect(card).toHaveTextContent(OSM);
    });
    cards.slice(0, STAGE_DEFINITIONS.length).forEach((card) => {
      expect(card).not.toHaveTextContent(OSM);
    });
    // The cities start a row of their own.
    expect(cards[STAGE_DEFINITIONS.length]).toHaveAttribute('data-new-row');
  });

  it('starts a city match from its card, with the linked credit under the choice', async () => {
    openDeck();
    pickLocalArena();
    const budapest = within(arenaChoice()).getByRole('button', { name: 'Budapest' });
    fireEvent.click(budapest);
    expect(budapest).toHaveAttribute('aria-pressed', 'true');
    expect(budapest).toHaveAccessibleDescription(/Danube/);
    expect(screen.getByRole('link', { name: OSM }))
      .toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    // Players of the deployed game reach the extracts and method (ODbL 4.6) from here.
    expect(screen.getByRole('link', { name: 'Map data and method' }))
      .toHaveAttribute('href', CITY_SOURCE_URL);
    expect(screen.getByText('Chain Bridge: William Tierney Clark')).toBeInTheDocument();
    expect(screen.getByText('Parliament: Imre Steindl')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/game/2/1/budapest'));
    const setup = JSON.parse(localStorage.getItem('gameSetup') as string);
    expect(setup).toMatchObject({ mode: 'local', arenaMapId: 'budapest' });
    // A city is no stage.
    expect(setup.stageId).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('selectedMap') as string)).toEqual(arenaMapRows('budapest'));
  });

  it('keeps the campaign\'s village apart from the arena choice', async () => {
    // The village's story scene already seen: the mission deploys at once.
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...loadStoryProgress(), seenScenes: ['hiddenLeaf:before'],
    }));
    openDeck();
    pickLocalArena();
    fireEvent.click(within(arenaChoice()).getByRole('button', { name: 'Rome' }));
    fireEvent.click(screen.getByText('Solo Campaign'));
    // The mission is still the campaign's village.
    expect(screen.getByLabelText('Hidden Leaf campaign route')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByText('Deploy Mission'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf'));
    expect(JSON.parse(localStorage.getItem('gameSetup') as string).arenaMapId).toBeUndefined();
  });

  it('lists the control map only on the playtest address', () => {
    openDeck();
    pickLocalArena();
    expect(within(arenaChoice()).queryByRole('button', { name: /playtest control/ })).not.toBeInTheDocument();
  });

  it('plays the control map from the playtest address, dressed as Rome', async () => {
    openDeck('/config?playtest=1');
    pickLocalArena();
    const control = within(arenaChoice()).getByRole('button', { name: 'Rome (playtest control)' });
    expect(control).toHaveTextContent('Playtest');
    fireEvent.click(control);
    expect(control).toHaveAccessibleDescription(/^Rome · /);
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/game/2/1/romeControl'));
  });

  it('reopens on a saved city setup', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      arenaMapId: 'barcelona',
      selectedCharacters: ['gaara', 'itachi'],
      rounds: '3',
    }));
    openDeck();
    expect(within(arenaChoice()).getByRole('button', { name: 'Barcelona' }))
      .toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /start battle/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/game/2/3/barcelona'));
  });
});
