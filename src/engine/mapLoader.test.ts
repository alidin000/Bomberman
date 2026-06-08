import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchMapFromFile, parseMapRows } from './mapLoader';
import { STAGE_DEFINITIONS } from '../content/stages';

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

  it('loads campaign-width rows without trimming them to arena width', async () => {
    const wideRow = `W${' '.repeat(33)}W`;
    global.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve(`${wideRow}\n${wideRow}`),
    }) as typeof fetch;

    const rows = await fetchMapFromFile('wideCampaign');
    const map = parseMapRows(rows);

    expect(rows[0]).toHaveLength(35);
    expect(map[0]).toHaveLength(35);
  });

  it('keeps every authored campaign map at 35x35', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const rows = readCampaignMapRows(stage.mapId);
      const map = parseMapRows(rows);

      expect(rows).toHaveLength(35);
      expect(rows.every((row) => row.length === 35)).toBe(true);
      expect(map).toHaveLength(35);
      expect(map[0]).toHaveLength(35);
    });
  });

  it('keeps campaign maps dense and individually authored', () => {
    const signatures = new Set<string>();

    STAGE_DEFINITIONS.forEach((stage) => {
      const rows = readCampaignMapRows(stage.mapId);
      signatures.add(rows.map((row) => row.join('')).join('\n'));
      const interiorWallCount = rows.flatMap((row, y) => row.map((cell, x) => ({
        cell,
        x,
        y,
      }))).filter(({ cell, x, y }) => (
        cell === 'W'
        && x > 0
        && y > 0
        && x < 34
        && y < 34
      )).length;
      const boxCount = rows.flat().filter((cell) => cell === 'B').length;

      expect(interiorWallCount).toBeGreaterThanOrEqual(120);
      expect(boxCount).toBeGreaterThanOrEqual(200);
    });

    expect(signatures.size).toBe(STAGE_DEFINITIONS.length);
  });
});
