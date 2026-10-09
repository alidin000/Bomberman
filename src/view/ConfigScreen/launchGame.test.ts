import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { NavigateFunction } from 'react-router-dom';
import { launchGame } from './launchGame';
import { DEFAULT_KEY_BINDINGS } from '../../constants/props';
import {
  DEFAULT_STORY_PROGRESS, STORY_PROGRESS_KEY, loadStoryProgress,
} from '../../story/progress';

function authoredRows(mapId: string): string[][] {
  return readFileSync(`public/maps/${mapId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(''));
}

describe('launchGame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('starts a match with the authored stage map and no network fetch', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    const navigate = vi.fn() as unknown as NavigateFunction;

    await launchGame({
      mode: 'local',
      stageId: 'hiddenMist',
      characters: ['naruto', 'sasuke'],
      upgrade: DEFAULT_STORY_PROGRESS.selectedUpgrade,
      players: '2',
      keyBindings: DEFAULT_KEY_BINDINGS,
      storyProgress: DEFAULT_STORY_PROGRESS,
      rounds: '3',
    }, navigate);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/game/2/3/hiddenMist');
    expect(JSON.parse(localStorage.getItem('selectedMap') as string)).toEqual(authoredRows('hiddenMist'));
  });

  it('deploys a campaign mission with the hub pack and upgrades, and spends the pack', async () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...DEFAULT_STORY_PROGRESS,
      version: 4,
      currency: 12,
      pack: ['secondWind'],
      upgradeRanks: { lanternOil: 1 },
    }));
    const navigate = vi.fn() as unknown as NavigateFunction;

    const progress = await launchGame({
      mode: 'solo',
      stageId: 'hiddenLeaf',
      characters: ['deidara'],
      upgrade: DEFAULT_STORY_PROGRESS.selectedUpgrade,
      players: '1',
      keyBindings: DEFAULT_KEY_BINDINGS,
      storyProgress: loadStoryProgress(),
    }, navigate);

    expect(navigate).toHaveBeenCalledWith('/game/1/1/hiddenLeaf');
    const setup = JSON.parse(localStorage.getItem('gameSetup') as string);
    expect(setup.loadout).toEqual({
      consumables: ['secondWind'],
      upgrades: { lanternOil: 1 },
    });
    // One mission: the pack is empty for the next one, and the upgrade stays.
    expect(progress?.pack).toEqual([]);
    expect(loadStoryProgress().pack).toEqual([]);
    expect(loadStoryProgress().upgradeRanks).toEqual({ lanternOil: 1 });
    expect(loadStoryProgress().currency).toBe(12);
  });
});
