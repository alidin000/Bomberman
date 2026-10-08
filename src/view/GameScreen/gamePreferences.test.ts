import {
  DEFAULT_GAME_PREFERENCES,
  normalizeGamePreferences,
} from './gamePreferences';

describe('game preferences', () => {
  it('clamps unsafe stored values and keeps valid accessibility choices', () => {
    expect(normalizeGamePreferences({
      effectsVolume: 500,
      screenShake: -20,
      hudScale: 140,
      reducedMotion: true,
      highContrast: true,
    })).toEqual({
      ...DEFAULT_GAME_PREFERENCES,
      effectsVolume: 100,
      screenShake: 0,
      hudScale: 125,
      reducedMotion: true,
      highContrast: true,
    });
  });

  it('falls back when stored numeric values are invalid', () => {
    expect(normalizeGamePreferences({
      effectsVolume: Number.NaN,
      screenShake: Number.POSITIVE_INFINITY,
    })).toMatchObject({
      effectsVolume: DEFAULT_GAME_PREFERENCES.effectsVolume,
      screenShake: DEFAULT_GAME_PREFERENCES.screenShake,
    });
  });
});
