import { STAGE_DEFINITIONS } from '../../../content';
import { contrastRatio, highContrastPalette } from './highContrast';

describe('highContrastPalette', () => {
  it.each(STAGE_DEFINITIONS.map((stage) => [stage.id, stage.palette] as const))(
    'separates floor, walls and crates by brightness on %s',
    (_, palette) => {
      const hc = highContrastPalette(palette);
      // WCAG non-text contrast (3:1) between the floor and solid walls, which
      // the normal palettes miss (about 2:1).
      expect(contrastRatio(palette.groundA, palette.wall)).toBeLessThan(3);
      expect(contrastRatio(hc.groundA, hc.wall)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hc.groundB, hc.wall)).toBeGreaterThanOrEqual(3);
      // Crates read apart from both the floor and the walls.
      expect(contrastRatio(hc.groundB, hc.crate)).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(hc.crate, hc.wall)).toBeGreaterThanOrEqual(2);
      // The checkerboard survives.
      expect(hc.groundA).not.toBe(hc.groundB);
    }
  );
});
