import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  loadCampaignMapRows, loadMapFromStorage, loadStageMapRows, parseMapRows, parseMapText,
} from './mapLoader';
import { defaultMap } from '../constants/contants';
import { STAGE_DEFINITIONS } from '../content/stages';
import { CAMPAIGN_STAGE_LAYOUTS } from '../content/campaignLayouts';

function readCampaignMapRows(mapId: string): string[][] {
  return readFileSync(`public/maps/${mapId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(''));
}

describe('mapLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads campaign-width rows without trimming them to arena width', () => {
    const wideRow = `W${' '.repeat(33)}W`;

    const rows = parseMapText(`${wideRow}\r\n${wideRow}\n\n`);
    const map = parseMapRows(rows);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(35);
    expect(map[0]).toHaveLength(35);
  });

  it('serves every stage map from the bundle, with no network fetch', () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);

    STAGE_DEFINITIONS.forEach((stage) => {
      expect(loadStageMapRows(stage.mapId)).toEqual(readCampaignMapRows(stage.mapId));
      expect(loadCampaignMapRows(stage.mapId))
        .toEqual(readCampaignMapRows(`campaign/${stage.mapId}`));
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(() => loadStageMapRows('noSuchStage')).toThrow(/Unknown stage map/);
    vi.unstubAllGlobals();
  });

  it('assigns deterministic power-ups for authored power cells', () => {
    const rows = [
      'WWWWW',
      'W P W',
      'W P W',
      'WWWWW',
    ].map((row) => row.split(''));

    const first = parseMapRows(rows);
    const second = parseMapRows(rows);

    expect(first[1][2]).toBe(second[1][2]);
    expect(first[2][2]).toBe(second[2][2]);
  });

  it('keeps the 35x35 arena maps for Local Arena', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const rows = readCampaignMapRows(stage.mapId);
      expect(rows).toHaveLength(35);
      expect(rows.every((row) => row.length === 35)).toBe(true);
      // Arena maps carry no campaign marks (secret doors, arena gates).
      expect(rows.flat().filter((cell) => 'CHG'.includes(cell))).toEqual([]);
    });
  });

  it('keeps every campaign map square, at the size its layout is placed for', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const rows = readCampaignMapRows(`campaign/${stage.mapId}`);
      const map = parseMapRows(rows);
      const { size } = CAMPAIGN_STAGE_LAYOUTS[stage.id];

      expect([35, 50]).toContain(size);
      expect(rows).toHaveLength(size);
      expect(rows.every((row) => row.length === size)).toBe(true);
      expect(map).toHaveLength(size);
      expect(map[0]).toHaveLength(size);
    });
  });

  it('keeps campaign maps dense and individually authored', () => {
    const signatures = new Set<string>();

    STAGE_DEFINITIONS.flatMap((stage) => [stage.mapId, `campaign/${stage.mapId}`]).forEach((mapId) => {
      const rows = readCampaignMapRows(mapId);
      const edge = rows.length - 1;
      signatures.add(rows.map((row) => row.join('')).join('\n'));
      const interiorWallCount = rows.flatMap((row, y) => row.map((cell, x) => ({
        cell,
        x,
        y,
      }))).filter(({ cell, x, y }) => (
        cell === 'W'
        && x > 0
        && y > 0
        && x < edge
        && y < edge
      )).length;
      const boxCount = rows.flat().filter((cell) => cell === 'B').length;

      expect(interiorWallCount).toBeGreaterThanOrEqual(120);
      expect(boxCount).toBeGreaterThanOrEqual(200);
    });

    expect(signatures.size).toBe(STAGE_DEFINITIONS.length * 2);
  });
});

describe('loadMapFromStorage', () => {
  afterEach(() => localStorage.clear());

  it('falls back to the default arena when the stored map is corrupted', () => {
    const fallback = parseMapRows(defaultMap);
    ['{not json', '42', '[]', '[["W", 3]]', '{"rows": []}'].forEach((raw) => {
      localStorage.setItem('selectedMap', raw);
      expect(loadMapFromStorage()).toEqual(fallback);
    });
  });

  it('loads a stored map that is a grid of cells', () => {
    localStorage.setItem('selectedMap', JSON.stringify([['W', 'W', 'W'], ['W', ' ', 'W'], ['W', 'W', 'W']]));
    expect(loadMapFromStorage()[1][1]).toBe('Empty');
  });
});
