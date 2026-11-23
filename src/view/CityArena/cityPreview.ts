import {
  ArenaMapId, arenaMapMask, arenaMapRows, getArenaMap, maskFitsGrid,
} from '../../content/arenaMaps';
// The city colours alone, not content/stageLooks: the menus show these cards
// and load no scene data.
import { CITY_COLORS, CityMaskColors, isCityLookId } from '../../content/cityColors';

/** One colour of a top-down preview: an SVG path of unit cells. */
export type PreviewLayer = { key: string; color: string; d: string };

export type CityPreview = {
  width: number;
  height: number;
  /** Ground and walls first, crates last, one path per colour. */
  layers: PreviewLayer[];
};

const FLOOR_COLORS: Record<string, keyof CityMaskColors> = {
  r: 'road',
  p: 'plaza',
  g: 'park',
  d: 'deck',
  x: 'crossing',
  t: 'tram',
};

/**
 * A city map seen from above, drawn from its grid and render mask in its
 * look's colours: the picker card and the loading view (no image files).
 * Crates are small squares, so the streets under them still read. Null for
 * a village, or a city whose mask does not fit its grid.
 */
export function cityPreview(id: ArenaMapId): CityPreview | null {
  const entry = getArenaMap(id);
  const mask = arenaMapMask(id);
  if (!entry || entry.family !== 'city' || !mask || !isCityLookId(entry.lookId)) return null;
  const rows = arenaMapRows(id);
  if (!maskFitsGrid(mask, rows)) return null;
  const { palette, mask: colors } = CITY_COLORS[entry.lookId];

  const paths = new Map<string, string[]>();
  const add = (color: string, segment: string) => {
    const list = paths.get(color);
    if (list) list.push(segment);
    else paths.set(color, [segment]);
  };
  const crates: string[] = [];
  rows.forEach((row, y) => {
    // Runs of one colour along the row are one rectangle.
    let runColor = '';
    let runStart = 0;
    const flush = (end: number) => {
      if (runColor) add(runColor, `M${runStart} ${y}h${end - runStart}v1h-${end - runStart}z`);
    };
    row.forEach((cell, x) => {
      const cls = mask[y][x];
      let color: string;
      if (cell === 'W') {
        if (cls === 'w') color = colors.water;
        else if (cls === 'm') color = colors.landmark;
        else color = palette.wall;
      } else {
        const floor = FLOOR_COLORS[cls];
        color = floor ? colors[floor] : palette.groundA;
        if (cell === 'B') crates.push(`M${x + 0.22} ${y + 0.22}h0.56v0.56h-0.56z`);
      }
      if (color !== runColor) {
        flush(x);
        runColor = color;
        runStart = x;
      }
    });
    flush(row.length);
  });
  const layers = [...paths.entries()].map(([color, segments]) => ({
    key: color, color, d: segments.join(''),
  }));
  if (crates.length > 0) layers.push({ key: 'crates', color: palette.crate, d: crates.join('') });
  return {
    width: Math.max(...rows.map((row) => row.length)),
    height: rows.length,
    layers,
  };
}
