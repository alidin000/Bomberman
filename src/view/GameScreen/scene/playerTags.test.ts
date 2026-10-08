import { CHARACTER_DEFINITIONS } from '../../../content';
import { tagTextColor } from './playerTags';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('player tag chips', () => {
  it.each(CHARACTER_DEFINITIONS.map((c) => [c.name, c.primaryColor]))(
    'labels %s\'s chip with text that reads on its HUD colour',
    (_, color) => {
      // WCAG large-text minimum: the chip text is bold and ~40px in its texture.
      expect(contrast(tagTextColor(color as string), color as string)).toBeGreaterThanOrEqual(3);
    }
  );
});
