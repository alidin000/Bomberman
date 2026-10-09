import React from 'react';
import { vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameHUD } from './GameHUD';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import * as content from '../../content';
import {
  campaignState, piece, reachPuzzle, stepOnto,
} from '../../engine/campaignPuzzles.testutil';

// Counts player-card renders: each card looks its character up once per render.
const characterLookups = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof content>();
  return {
    ...actual,
    getCharacterDefinition: (...args: Parameters<typeof actual.getCharacterDefinition>) => {
      characterLookups.count += 1;
      return actual.getCharacterDefinition(...args);
    },
  };
});

function versusState(overrides: Partial<Parameters<typeof createInitialState>[0]> = {}) {
  return createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['sasuke', 'naruto'],
    map: parseMapRows(defaultMap),
    ...overrides,
  });
}

function renderHud(state: ReturnType<typeof createInitialState>, scale = 100) {
  return render(
    <ThemeProvider theme={theme}>
      <GameHUD state={state} scale={scale} />
    </ThemeProvider>
  );
}

// The HUD picks its phone layout from the window size, like the camera.
function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

// Font size in px that an element's text renders at, from the nearest
// declared size (jsdom resolves the cascade but not inheritance).
function declaredFontPx(element: Element | null): number | null {
  for (let node = element; node; node = node.parentElement) {
    const size = getComputedStyle(node).fontSize;
    if (size) {
      const value = parseFloat(size);
      if (size.endsWith('rem') || size.endsWith('em')) return value * 16;
      if (size.endsWith('px')) return value;
    }
  }
  return null;
}

describe('GameHUD', () => {
  beforeEach(() => {
    localStorage.clear();
    setViewport(1366, 768);
  });

  it('shows campaign event and progression intel in the objective panel', () => {
    const state = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={state} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByText('Nine Tails Alert')).toBeInTheDocument();
    expect(screen.getByText('Reputation')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Fragments')).toBeInTheDocument();
  });

  it('counts down the versus round clock and then announces sudden death', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 60500 }} scale={100} />
      </ThemeProvider>
    );
    expect(screen.getByLabelText('round clock')).toHaveTextContent('Time0:30');
    expect(screen.queryByText(/Sudden death/)).not.toBeInTheDocument();

    // The last 5 s are a lead-in, then a banner for as long as it runs.
    rerender(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 85500 }} scale={100} />
      </ThemeProvider>
    );
    const strip = screen.getByLabelText('match status');
    expect(within(strip).getByText('Sudden death in 5')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 90000 }} scale={100} />
      </ThemeProvider>
    );
    expect(within(strip).getByText('Sudden death')).toBeInTheDocument();
    expect(within(strip).getByText('Walls closing')).toBeInTheDocument();
    expect(screen.getByLabelText('round clock')).toHaveTextContent('0:00');
  });

  it('keeps the sudden-death banner on a phone, where the match bar is only the clock', () => {
    setViewport(360, 780);
    const state = versusState({ totalRounds: 3 });
    renderHud({ ...state, round: 2, roundElapsedMs: 90000 });

    const strip = screen.getByLabelText('match status');
    // Nothing in the bar but the clock, captioned with the round.
    expect(within(strip).queryByText('Threats')).not.toBeInTheDocument();
    expect(within(strip).getByRole('timer')).toHaveTextContent('R20:00');
    expect(screen.getByLabelText('sudden death')).toHaveTextContent('Sudden deathWalls closing');
  });

  it('shows each player\'s round wins as pips and the match target in the bar', () => {
    const state = versusState({ totalRounds: 3 });
    renderHud({ ...state, round: 2, roundWinners: ['player2'] });

    expect(within(screen.getByRole('group', { name: 'P1 Sasuke' }))
      .getByRole('img', { name: '0 of 2 wins' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'P2 Naruto' }))
      .getByRole('img', { name: '1 of 2 wins' })).toBeInTheDocument();
    expect(screen.getByLabelText('match status')).toHaveTextContent('Round 2 · First to 2');
  });

  it('shows no pips for a single-round match', () => {
    renderHud(versusState({ totalRounds: 1 }));
    expect(screen.queryByRole('img', { name: /wins$/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('match status')).toHaveTextContent('One round');
  });

  it('keeps every HUD label at 12 px or more and the numbers at 1.1rem or more', () => {
    const state = versusState({ totalRounds: 3, controllers: ['human', 'cpu-normal'] });
    const { container } = renderHud({
      ...state,
      roundWinners: ['player1'],
      players: state.players.map((player, index) => (
        index === 1
          ? { ...player, alive: false, deathCause: { kind: 'blast' as const, byPlayerId: 'player1' } }
          : player
      )),
    });

    const textElements = [...container.querySelectorAll('*')].filter((element) => (
      [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim())
      && !element.closest('.visually-hidden')
    ));
    expect(textElements.length).toBeGreaterThan(8);
    const tooSmall = textElements
      .map((element) => ({ text: element.textContent, px: declaredFontPx(element) }))
      .filter(({ px }) => px === null || px < 12);
    expect(tooSmall).toEqual([]);
    const bombs = within(screen.getByRole('group', { name: 'P1 Sasuke' }))
      .getByRole('img', { name: /Bombs ready/ });
    expect(declaredFontPx(bombs.querySelector('strong'))).toBeGreaterThanOrEqual(17.6);
  });

  it('grows the default HUD with the screen, up to 1.5x', () => {
    const zoomAt = (width: number, height: number) => {
      setViewport(width, height);
      const { container, unmount } = renderHud(versusState());
      // jsdom has no CSS zoom; the HUD sets it from the same --hud-zoom value.
      const zoom = Number(getComputedStyle(container.firstElementChild as Element)
        .getPropertyValue('--hud-zoom'));
      unmount();
      return zoom;
    };
    expect(zoomAt(1366, 768)).toBeCloseTo(1, 3);
    expect(zoomAt(1920, 1080)).toBeCloseTo(1920 / 1366, 3);
    expect(zoomAt(3840, 2160)).toBeCloseTo(1.5, 3);
    expect(zoomAt(390, 844)).toBeCloseTo(1, 3);
  });

  it('puts P1 first and P2 last in Local Arena, with P3 between them', () => {
    renderHud(versusState({ numPlayers: 3, selectedCharacters: ['naruto', 'sasuke', 'gaara'] }));
    const order = (name: string) => Number(getComputedStyle(screen.getByRole('group', { name })).order);
    expect(order('P1 Naruto')).toBeLessThan(order('P3 Gaara'));
    expect(order('P3 Gaara')).toBeLessThan(order('P2 Sasuke'));
  });

  it('collapses the campaign objectives to one line on a phone', () => {
    setViewport(390, 844);
    const state = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });
    renderHud(state);

    const line = screen.getByLabelText('mission objective');
    const active = state.campaign!.objectives.find((objective) => objective.status === 'active')!;
    expect(line).toHaveTextContent(active.label);
    expect(line).toHaveTextContent(`${active.current}/${active.target}`);
    expect(line).toHaveTextContent(/Lives \d\/\d/);
    expect(screen.queryByLabelText('mission objectives')).not.toBeInTheDocument();
    // The gate collapses to its padlock, named for screen readers.
    expect(screen.getByRole('img', { name: 'Gate locked' })).toBeInTheDocument();
  });

  it('shows route puzzle progress and its rule on the objective line', () => {
    let state = reachPuzzle(campaignState('hiddenCloud', 'normal'));
    state = stepOnto(state, piece(state, 'hiddenCloud-bell-1'));
    state = stepOnto(state, piece(state, 'hiddenCloud-bell-2'));
    const view = renderHud(state);

    const panel = screen.getByLabelText('mission objectives');
    expect(within(panel).getByText('Shrines 2/4 · ring them in order, I to IV')).toBeInTheDocument();
    expect(within(panel).getByText('Thunderbell Shrines')).toBeInTheDocument();
    view.unmount();

    setViewport(390, 844);
    renderHud(state);
    const line = screen.getByLabelText('mission objective');
    expect(line).toHaveTextContent('Thunderbell Shrines');
    expect(line).toHaveTextContent('2/4 · ring in order');
  });

  it('never shows a negative bomb count while extra bombs are out', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    // Naruto's shadow clone puts one bomb more than his limit on the field.
    const cloneOut = {
      ...state,
      players: state.players.map((player, index) => (
        index === 1 ? { ...player, activeBombs: player.maxBombs + 1 } : player
      )),
    };

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={cloneOut} scale={100} />
      </ThemeProvider>
    );

    const bombsReady = (name: string) => within(screen.getByRole('group', { name }))
      .getByRole('img', { name: /Bombs ready/ }).textContent;
    expect(bombsReady('P1 Sasuke')).toBe(`${state.players[0].maxBombs}/${state.players[0].maxBombs}`);
    expect(bombsReady('P2 Naruto')).toBe(`0/${state.players[1].maxBombs}`);
  });

  it('shows the concrete death reason on sealed player cards', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const reason = 'Sasuke was caught in their own Chidori Mine blast.';
    const defeatedState = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0 ? { ...player, alive: false, deathReason: reason } : player
      )),
    };

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={defeatedState} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it('says whose blast took a player out by slot, so a mirror match stays clear', () => {
    const state = versusState({ selectedCharacters: ['naruto', 'naruto'] });
    renderHud({
      ...state,
      players: state.players.map((player, index) => (
        index === 0
          ? {
            ...player,
            alive: false,
            deathReason: "Naruto was caught in Naruto's Shadow Clone blast.",
            deathCause: { kind: 'blast' as const, byPlayerId: 'player2', bombKind: 'shadowClone' as const },
          }
          : player
      )),
    });

    const card = screen.getByRole('group', { name: 'P1 Naruto' });
    expect(card).toHaveTextContent('Out');
    expect(card).toHaveTextContent("P2 Naruto's blast");
    expect(card).not.toHaveTextContent('Sealed');
  });

  it('renders player status ribbons without React DOM attribute warnings', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    try {
      render(
        <ThemeProvider theme={theme}>
          <GameHUD state={state} scale={100} />
        </ThemeProvider>
      );
      expect(screen.getAllByRole('progressbar', { name: /ultimate$/ })
        .map((bar) => bar.getAttribute('aria-valuetext'))).toEqual(['Ready', 'Ready']);
      const warnings = errors.mock.calls.map((call) => call.map(String).join(' '));
      expect(warnings.filter((text) => /non-boolean attribute/.test(text))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('tells two players on the same shinobi apart by slot', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['naruto', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={state} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByRole('group', { name: 'P1 Naruto' })).toHaveTextContent(/^P1/);
    expect(screen.getByRole('group', { name: 'P2 Naruto' })).toHaveTextContent(/^P2/);
  });

  it('marks CPU players on their cards', () => {
    const state = createInitialState({
      mode: 'local',
      numPlayers: 3,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['naruto', 'sasuke', 'gaara'],
      map: parseMapRows(defaultMap),
      controllers: ['human', 'cpu-hard', 'cpu-easy'],
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={state} scale={100} />
      </ThemeProvider>
    );

    expect(screen.getByRole('group', { name: 'P1 Naruto' })).not.toHaveTextContent('CPU');
    expect(screen.getByRole('group', { name: 'P2 Sasuke · CPU Hard' })).toHaveTextContent('CPU · Hard');
    expect(screen.getByRole('group', { name: 'P3 Gaara · CPU Easy' })).toHaveTextContent('CPU · Easy');
  });

  it('re-renders a player card only when its own numbers change', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const tree = (current: typeof state) => (
      <ThemeProvider theme={theme}>
        <GameHUD state={current} scale={100} />
      </ThemeProvider>
    );
    const { rerender } = render(tree(state));
    const afterMount = characterLookups.count;

    // An engine tick inside the same clock second: nothing on the cards moved.
    rerender(tree({ ...state, tick: state.tick + 1, roundElapsedMs: state.roundElapsedMs + 50 }));
    expect(characterLookups.count).toBe(afterMount);

    // P2 drops a bomb: only P2's card renders again.
    rerender(tree({
      ...state,
      tick: state.tick + 2,
      players: state.players.map((player, index) => (
        index === 1 ? { ...player, activeBombs: player.activeBombs + 1 } : player
      )),
    }));
    expect(characterLookups.count).toBe(afterMount + 1);
  });

  it('exposes the round clock as a timer that is not read out every second', () => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['sasuke', 'naruto'],
      map: parseMapRows(defaultMap),
    });

    render(
      <ThemeProvider theme={theme}>
        <GameHUD state={{ ...state, roundElapsedMs: 80000 }} scale={100} />
      </ThemeProvider>
    );

    const clock = screen.getByRole('timer', { name: 'round clock' });
    expect(clock).toHaveTextContent('0:10');
    expect(clock).not.toHaveAttribute('aria-live');
  });
});
