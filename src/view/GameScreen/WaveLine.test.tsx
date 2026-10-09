import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameHUD } from './GameHUD';
import { createInitialState } from '../../engine/initialState';
import { gameReducer } from '../../engine/reducer';
import { parseMapRows } from '../../engine/mapLoader';
import { GameEngineState } from '../../engine/types';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { useGameFeedback } from './useGameFeedback';

const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34 ? 'W'.repeat(35) : `W${' '.repeat(33)}W`
).split('')));

// Hidden Leaf on Normal, the rescue just done: the defense and its waves run.
function defenseStarted(): GameEngineState {
  const initial = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto'],
    map: openStage,
    seed: 7,
    difficulty: 'normal',
  });
  let state: GameEngineState = {
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [],
    campaign: { ...initial.campaign!, spawnPoints: [] },
  };
  const rescue = state.campaign!.objectives.find((objective) => objective.kind === 'rescue')!;
  rescue.targets!.forEach((target) => {
    state = gameReducer({
      ...state,
      players: state.players.map((player) => ({ ...player, x: target.x - 0.8, y: target.y })),
    }, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
  });
  return { ...state, players: state.players.map((player) => ({ ...player, x: 2, y: 32 })) };
}

function ticks(state: GameEngineState, count: number): GameEngineState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function renderHud(state: GameEngineState) {
  return render(
    <ThemeProvider theme={theme}>
      <GameHUD state={state} scale={100} />
    </ThemeProvider>
  );
}

describe('defense wave HUD and captions', () => {
  beforeEach(() => {
    localStorage.clear();
    setViewport(1366, 768);
  });

  it('counts down to the next wave, names its spawn points, then shows a hold', () => {
    const start = defenseStarted();
    const waves = start.campaign!.waves!;
    const firstDue = waves.dueAtMs;
    const view = renderHud(start);
    const line = () => screen.getByRole('timer', { name: 'defense waves' });
    expect(line()).toHaveTextContent(`Wave 1/${waves.waves.length}`);
    expect(line()).toHaveTextContent(`in 0:${String(firstDue / 1000).padStart(2, '0')}`);
    // Until the marks go up, the line says what the village event changes.
    expect(line()).toHaveTextContent(waves.eventNote!);

    // Marks up: the line names where the wave comes from.
    const marked = ticks(start, (firstDue - waves.telegraphMs) / 50);
    view.rerender(
      <ThemeProvider theme={theme}>
        <GameHUD state={marked} scale={100} />
      </ThemeProvider>
    );
    const entry = waves.entries.find((item) => item.id === waves.waves[0].entryIds[0])!;
    expect(line()).toHaveTextContent(entry.label);
    expect(line()).toHaveTextContent(`in 0:0${waves.telegraphMs / 1000}`);

    // A wave due with no room under the cap says so.
    const held = {
      ...marked,
      campaign: { ...marked.campaign!, waves: { ...marked.campaign!.waves!, held: true } },
    };
    view.rerender(
      <ThemeProvider theme={theme}>
        <GameHUD state={held} scale={100} />
      </ThemeProvider>
    );
    expect(line()).toHaveTextContent('held');
    expect(line()).toHaveTextContent(/clear some/);
  });

  it('puts the wave clock on the one-line objective on a phone', () => {
    setViewport(390, 844);
    const start = defenseStarted();
    renderHud(start);
    const total = start.campaign!.waves!.waves.length;
    expect(screen.getByLabelText('mission objective'))
      .toHaveTextContent(`W1/${total} in 0:${String(start.campaign!.waves!.dueAtMs / 1000).padStart(2, '0')}`);
  });

  it('captions the marks going up, naming the first spawn point', () => {
    const start = defenseStarted();
    const waves = start.campaign!.waves!;
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, { ...DEFAULT_GAME_PREFERENCES, soundEnabled: false }),
      { initialProps: { state: ticks(start, 1) } }
    );
    const before = ticks(start, (waves.dueAtMs - waves.telegraphMs) / 50 - 1);
    rerender({ state: before });
    expect(result.current.caption).toBe('');
    rerender({ state: ticks(before, 1) });
    const entry = waves.entries.find((item) => item.id === waves.waves[0].entryIds[0])!;
    expect(result.current.caption).toBe(`Wave 1/${waves.waves.length} from ${entry.label}`);
    expect(result.current.caption.length).toBeLessThanOrEqual(40);
  });
});
