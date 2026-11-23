import { vi } from 'vitest';
import type { NavigateFunction } from 'react-router-dom';
import {
  getCpuBattlePlan, getQuickPlayPlan, launchGame, readLastLocalSetup,
} from './launchGame';
import { DEFAULT_KEY_BINDINGS } from '../../constants/props';
import { DEFAULT_STORY_PROGRESS } from '../../story/progress';
import { arenaMapRows } from '../../content/arenaMaps';
import { loadStageMapRows } from '../../engine/mapLoader';

// Local Arena launches by arena id: a city keeps its id through the saved
// setup, the Mission Deck's reopen, Quick Play and Battle a CPU.

const base = {
  mode: 'local' as const,
  stageId: 'hiddenLeaf' as const,
  characters: ['naruto' as const, 'sasuke' as const],
  upgrade: DEFAULT_STORY_PROGRESS.selectedUpgrade,
  players: '2',
  keyBindings: DEFAULT_KEY_BINDINGS,
  storyProgress: DEFAULT_STORY_PROGRESS,
};

describe('launching city arenas', () => {
  afterEach(() => localStorage.clear());

  it('starts a city on its catalog grid and saves its arena id, never as a stage', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    await launchGame({ ...base, arenaMapId: 'barcelona', rounds: '3' }, navigate);
    expect(navigate).toHaveBeenCalledWith('/game/2/3/barcelona');
    expect(JSON.parse(localStorage.getItem('selectedMap') as string)).toEqual(arenaMapRows('barcelona'));
    const setup = JSON.parse(localStorage.getItem('gameSetup') as string);
    expect(setup).toMatchObject({ mode: 'local', arenaMapId: 'barcelona', rounds: '3' });
    expect(setup).not.toHaveProperty('stageId');
  });

  it('saves a village arena under its stage as before, plus its arena id', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    await launchGame({ ...base, arenaMapId: 'hiddenSand' }, navigate);
    expect(navigate).toHaveBeenCalledWith('/game/2/1/hiddenSand');
    expect(JSON.parse(localStorage.getItem('selectedMap') as string)).toEqual(loadStageMapRows('hiddenSand'));
    expect(JSON.parse(localStorage.getItem('gameSetup') as string))
      .toMatchObject({ stageId: 'hiddenSand', arenaMapId: 'hiddenSand' });
  });

  it('keeps a saved city through Quick Play\'s rematch and the CPU battle', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    await launchGame({ ...base, arenaMapId: 'rome', rounds: '3' }, navigate);
    expect(readLastLocalSetup()?.arenaMapId).toBe('rome');

    const rematch = getQuickPlayPlan(DEFAULT_STORY_PROGRESS);
    expect(rematch).toMatchObject({ mode: 'local', arenaMapId: 'rome', rounds: '3' });
    expect(rematch.summary).toMatch(/^Local rematch · Rome · Naruto vs Sasuke/);
    const cpu = getCpuBattlePlan(DEFAULT_STORY_PROGRESS);
    expect(cpu.arenaMapId).toBe('rome');
    expect(cpu.summary).toMatch(/^Rome · /);

    // Quick Play launches exactly as the title screen does: the plan as given.
    const again = vi.fn() as unknown as NavigateFunction;
    await launchGame({
      ...rematch, keyBindings: DEFAULT_KEY_BINDINGS, storyProgress: DEFAULT_STORY_PROGRESS,
    }, again);
    expect(again).toHaveBeenCalledWith('/game/2/3/rome');
    const cpuMatch = vi.fn() as unknown as NavigateFunction;
    await launchGame({
      ...cpu, keyBindings: DEFAULT_KEY_BINDINGS, storyProgress: DEFAULT_STORY_PROGRESS,
    }, cpuMatch);
    expect(cpuMatch).toHaveBeenCalledWith('/game/2/3/rome');
    expect(JSON.parse(localStorage.getItem('gameSetup') as string).controllers).toEqual(['human', 'cpu-normal']);
  });

  it('replays the playtest control by its id, which any route plays', async () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', arenaMapId: 'romeControl', selectedCharacters: ['naruto', 'itachi'],
    }));
    const navigate = vi.fn() as unknown as NavigateFunction;
    await launchGame({
      ...getQuickPlayPlan(DEFAULT_STORY_PROGRESS),
      keyBindings: DEFAULT_KEY_BINDINGS,
      storyProgress: DEFAULT_STORY_PROGRESS,
    }, navigate);
    expect(navigate).toHaveBeenCalledWith('/game/2/1/romeControl');
  });

  it('reads older village setups by their stage, and drops an arena it no longer knows', () => {
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', stageId: 'hiddenMist', selectedCharacters: ['gaara', 'itachi'],
    }));
    expect(readLastLocalSetup()?.arenaMapId).toBe('hiddenMist');
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local', arenaMapId: 'atlantis', selectedCharacters: ['gaara', 'itachi'],
    }));
    expect(readLastLocalSetup()).toBeNull();
    expect(getQuickPlayPlan(DEFAULT_STORY_PROGRESS).mode).toBe('solo');
  });
});
