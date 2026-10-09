import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { NavigateFunction } from 'react-router-dom';
import { launchGame } from './launchGame';
import { DEFAULT_KEY_BINDINGS } from '../../constants/props';
import { DEFAULT_STORY_PROGRESS } from '../../story/progress';

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
});
