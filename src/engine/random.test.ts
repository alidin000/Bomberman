import {
  DEFAULT_MATCH_SEED, nextRandom, normalizeSeed, pickWeighted,
} from './random';

function sequence(seed: number, length: number): number[] {
  const values: number[] = [];
  let current = seed;
  for (let index = 0; index < length; index += 1) {
    const draw = nextRandom(current);
    values.push(draw.value);
    current = draw.seed;
  }
  return values;
}

describe('seeded random', () => {
  it('repeats a sequence for the same seed and diverges for another', () => {
    const values = sequence(42, 50);

    expect(sequence(42, 50)).toEqual(values);
    expect(sequence(43, 50)).not.toEqual(values);
    values.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it('falls back to the fixed default seed for missing or invalid seeds', () => {
    expect(normalizeSeed(undefined)).toBe(DEFAULT_MATCH_SEED);
    expect(normalizeSeed(Number.NaN)).toBe(DEFAULT_MATCH_SEED);
    expect(normalizeSeed(-1)).toBe(4294967295);
  });

  it('picks weighted entries in proportion to their weight', () => {
    const table = [
      { item: 'common', weight: 70 },
      { item: 'rare', weight: 25 },
      { item: 'epic', weight: 5 },
    ];
    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0 };

    sequence(7, 20000).forEach((roll) => {
      counts[pickWeighted(table, roll)] += 1;
    });

    expect(counts.common / 20000).toBeCloseTo(0.7, 1);
    expect(counts.rare / 20000).toBeCloseTo(0.25, 1);
    expect(counts.epic / 20000).toBeCloseTo(0.05, 1);
    expect(pickWeighted(table, 0)).toBe('common');
    expect(pickWeighted(table, 0.9999)).toBe('epic');
  });
});
