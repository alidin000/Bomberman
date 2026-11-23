import { vi } from 'vitest';
import React from 'react';
import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameScreen, routedPlayerCount } from './GameScreen';
import { createInitialState } from '../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../engine/mapLoader';
import { GameConfig, GameEngineState } from '../../engine/types';
import { CITY_SOURCE_URL, arenaMapRows } from '../../content/arenaMaps';
import { CITY_LOOKS, getStageLook } from '../../content/stageLooks';
import { sceneLookFor } from './scene/arenaScene';

// The match screen on a routed Arena match: which map the route plays, and
// the city's round-start overview plate. The engine and the 3D scene are
// stand-ins; the engine stub records the config the screen starts it with.

const engine = vi.hoisted(() => ({
  config: null as GameConfig | null,
  state: null as GameEngineState | null,
  // Start the stub on the screen's own config, as the real engine would.
  start: false,
}));
const scene = vi.hoisted(() => ({ overviewSkipped: undefined as boolean | undefined }));

vi.mock('./GameScene3D', () => ({
  GameScene3D: ({ overviewSkipped }: { overviewSkipped: boolean }) => {
    scene.overviewSkipped = overviewSkipped;
    return <div data-testid="game-scene-3d" />;
  },
}));

vi.mock('../../hooks/useGameEngine', async () => {
  const { testEngineStore } = await import('../../hooks/engineStore.testutil');
  const { createInitialState: startMatch } = await import('../../engine/initialState');
  const stub = testEngineStore(() => engine.state);
  return {
    useGameEngineStore: (config: GameConfig | null) => {
      engine.config = config;
      if (engine.start && config && !engine.state) engine.state = startMatch(config);
      stub.usePublish();
      return {
        store: stub.store,
        dispatch: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        restart: vi.fn(),
        dismissDialog: vi.fn(),
      };
    },
  };
});

const leafRows = arenaMapRows('hiddenLeaf');

function openMatch(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/game/:numOfPlayers/:numOfRounds/:selectedMap" element={<GameScreen />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function store(setup: object, rows: string[][] = leafRows) {
  localStorage.setItem('gameSetup', JSON.stringify(setup));
  localStorage.setItem('selectedMap', JSON.stringify(rows));
}

describe('GameScreen on an arena route', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    engine.config = null;
    engine.state = null;
    engine.start = false;
    scene.overviewSkipped = undefined;
  });

  it('plays a city route on its catalog grid, look and monster rule, whatever is stored', () => {
    // A stale setup from a village match: its grid and its stage.
    store({ mode: 'local', stageId: 'hiddenSand', selectedCharacters: ['naruto', 'sasuke'] });
    openMatch('/game/2/1/rome');
    const config = engine.config!;
    expect(config.selectedMap).toBe('rome');
    expect(config.map).toEqual(parseMapRows(arenaMapRows('rome')));
    // A city is no stage.
    expect(config.stageId).toBeUndefined();
    expect(sceneLookFor(config)).toBe(CITY_LOOKS.rome);
    expect(createInitialState(config).monsters).toEqual([]);
  });

  it('plays a city route as Local Arena after a campaign mission was the last launch', () => {
    // A bookmark, a shared link or Back after a mission: the mission's
    // setup, loadout and campaign map are still in storage.
    store({
      mode: 'solo',
      stageId: 'hiddenSand',
      selectedCharacters: ['gaara'],
      loadout: { consumables: [] },
      village: { stageId: 'hiddenSand' },
    }, loadCampaignMapRows('hiddenSand'));
    openMatch('/game/2/1/rome');
    const config = engine.config!;
    expect(config.mode).toBe('local');
    expect(config.map).toEqual(parseMapRows(arenaMapRows('rome')));
    expect(config.stageId).toBeUndefined();
    expect(config.loadout).toBeUndefined();
    expect(config.village).toBeUndefined();
    expect(sceneLookFor(config)).toBe(CITY_LOOKS.rome);
    const state = createInitialState(config);
    expect(state.campaign).toBeFalsy();
    expect(state.monsters).toEqual([]);
  });

  it('plays a village route as its own village, even when the stored setup names another', () => {
    store({ mode: 'local', stageId: 'hiddenLeaf', selectedCharacters: ['naruto', 'sasuke'] });
    openMatch('/game/2/1/hiddenMist');
    const config = engine.config!;
    expect(config.map).toEqual(parseMapRows(arenaMapRows('hiddenMist')));
    expect(config.stageId).toBe('hiddenMist');
    expect(sceneLookFor(config)).toBe(getStageLook('hiddenMist'));
    expect(createInitialState(config).monsters.map((monster) => monster.name))
      .toEqual(['Hunter Ninja', 'Mist Ninja', 'Water Clone', 'Hidden Mist Shade']);
  });

  it('keeps the stored map for the campaign and for ids outside the catalog', () => {
    const stored = [['W', 'W', 'W'], ['W', ' ', 'W'], ['W', 'W', 'W']];
    store({ mode: 'solo', stageId: 'hiddenSand', selectedCharacters: ['gaara'] }, stored);
    const mission = openMatch('/game/1/1/hiddenSand');
    expect(engine.config!.map).toEqual(parseMapRows(stored));
    expect(engine.config!.stageId).toBe('hiddenSand');
    mission.unmount();

    store({ mode: 'local', stageId: 'hiddenCloud' }, stored);
    openMatch('/game/2/1/map1');
    expect(engine.config!.map).toEqual(parseMapRows(stored));
    expect(engine.config!.stageId).toBe('hiddenCloud');
  });

  it('seats three on a hand-typed four-player local address instead of crashing', () => {
    store({ mode: 'local', stageId: 'hiddenLeaf' });
    engine.start = true;
    expect(() => openMatch('/game/4/1/rome')).not.toThrow();
    expect(engine.config!.numPlayers).toBe(3);
    expect(screen.getByTestId('game-scene-3d')).toBeInTheDocument();
    // Three seats in the HUD, each with keys (a fourth has none to show).
    expect(screen.getAllByRole('group', { name: /^P\d / })).toHaveLength(3);
    expect([routedPlayerCount('4'), routedPlayerCount('0'), routedPlayerCount('x')]).toEqual([3, 1, 1]);
  });

  it('shows the city\'s name, map and linked OSM credit while the match loads', () => {
    store({ mode: 'local' });
    openMatch('/game/2/1/budapest');
    const loading = screen.getByRole('status');
    expect(within(loading).getByText('Budapest')).toBeInTheDocument();
    expect(within(loading).getByRole('link', { name: '© OpenStreetMap contributors' }))
      .toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    expect(within(loading).getByRole('link', { name: 'Map data and method' }))
      .toHaveAttribute('href', CITY_SOURCE_URL);
    expect(within(loading).getByText('Chain Bridge: William Tierney Clark')).toBeInTheDocument();
    expect(within(loading).getByText('Parliament: Imre Steindl')).toBeInTheDocument();
    expect(loading.querySelector('[data-city-preview="budapest"]')).not.toBeNull();
  });

  it('loads a village match without a city card', () => {
    store({ mode: 'local' });
    openMatch('/game/2/1/hiddenLeaf');
    expect(screen.getByRole('status')).not.toHaveTextContent('OpenStreetMap');
  });
});

describe('the round-start overview plate', () => {
  function cityMatch(extra: Partial<GameEngineState> = {}, id: 'rome' | 'budapest' = 'rome') {
    store({ mode: 'local', selectedCharacters: ['naruto', 'sasuke'] });
    engine.state = {
      ...createInitialState({
        mode: 'local',
        numPlayers: 2,
        totalRounds: 1,
        selectedMap: id,
        map: parseMapRows(arenaMapRows(id)),
      }),
      ...extra,
    };
    return openMatch(`/game/2/1/${id}`);
  }
  const overviewPlate = () => screen.queryByRole('group', { name: 'map overview' });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('shinobiControlsGuideSeen', 'true');
    engine.start = false;
    scene.overviewSkipped = undefined;
  });

  it('names the city over the first countdown, with the countdown, its credits and a Skip button', () => {
    cityMatch({}, 'budapest');
    const plate = overviewPlate()!;
    expect(within(plate).getByText('Budapest')).toBeInTheDocument();
    expect(within(plate).getByText(
      '© OpenStreetMap contributors · Chain Bridge: William Tierney Clark · Parliament: Imre Steindl'
    )).toBeInTheDocument();
    // The countdown moves into the plate, off the top centre over the board.
    expect(screen.getAllByLabelText('round countdown')).toHaveLength(1);
    expect(within(plate).getByLabelText('round countdown')).toHaveTextContent('3');
    expect(scene.overviewSkipped).toBe(false);

    fireEvent.click(within(plate).getByRole('button', { name: 'Skip overview' }));
    expect(overviewPlate()).not.toBeInTheDocument();
    // Skipping only tells the camera: the countdown is the engine's, and back in its place.
    expect(scene.overviewSkipped).toBe(true);
    expect(screen.getByLabelText('round countdown')).toHaveTextContent('3');
  });

  it('stays up when the HUD is hidden, showing only the countdown and the OSM credit', () => {
    cityMatch({}, 'budapest');
    const hide = screen.getByRole('button', { name: 'hide HUD' });
    // The click's own pointerdown and a keyboard press on the button skip nothing.
    act(() => {
      fireEvent.pointerDown(hide);
      fireEvent.keyDown(hide, { key: 'Enter' });
      fireEvent.click(hide);
    });
    const plate = overviewPlate()!;
    expect(plate).toBeInTheDocument();
    expect(scene.overviewSkipped).toBe(false);
    // A name-free view of the map for the playtest: no name, no designer, no button.
    expect(plate).toHaveTextContent(/^3© OpenStreetMap contributors$/);
    expect(within(plate).queryByRole('button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'show HUD' }));
    expect(within(overviewPlate()!).getByText('Budapest')).toBeInTheDocument();
  });

  it('is skipped by any key or touch', () => {
    cityMatch();
    act(() => { fireEvent.keyDown(window, { key: 'w' }); });
    expect(overviewPlate()).not.toBeInTheDocument();
    expect(scene.overviewSkipped).toBe(true);
  });

  it('is not shown in the countdown\'s last second', () => {
    cityMatch({ roundStartTicksRemaining: 900 });
    expect(screen.queryByRole('group', { name: 'map overview' })).not.toBeInTheDocument();
  });

  it.each([
    ['a later round', { round: 2 }],
    ['a pause', { paused: true }],
  ])('is not shown in %s', (_, extra) => {
    cityMatch(extra);
    expect(screen.queryByRole('group', { name: 'map overview' })).not.toBeInTheDocument();
  });

  it('is not shown on a village arena', () => {
    store({ mode: 'local' });
    engine.state = createInitialState({
      mode: 'local',
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      map: parseMapRows(leafRows),
    });
    openMatch('/game/2/1/hiddenLeaf');
    expect(screen.queryByRole('group', { name: 'map overview' })).not.toBeInTheDocument();
  });
});
