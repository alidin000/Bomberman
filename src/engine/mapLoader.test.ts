import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchMapFromFile, parseMapRows } from './mapLoader';

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

  it('keeps the authored Hidden Leaf campaign map at 35x35', () => {
    const rows = readFileSync('public/maps/hiddenLeaf.txt', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((row) => row.split(''));
    const map = parseMapRows(rows);

    expect(rows).toHaveLength(35);
    expect(rows.every((row) => row.length === 35)).toBe(true);
    expect(map).toHaveLength(35);
    expect(map[0]).toHaveLength(35);
  });
});
