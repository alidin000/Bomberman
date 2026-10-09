import {
  DEFAULT_GAME_PREFERENCES,
  GAME_PREFERENCES_KEY,
  isLikelyLowEndDevice,
  loadGamePreferences,
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

describe('the Stage scenery default', () => {
  // jsdom reports the test machine's cores; set what a device would report.
  function deviceReports(hints: { hardwareConcurrency?: number; deviceMemory?: number }) {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true, value: hints.hardwareConcurrency,
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true, value: hints.deviceMemory,
    });
  }
  afterEach(() => {
    delete (navigator as { hardwareConcurrency?: number }).hardwareConcurrency;
    delete (navigator as { deviceMemory?: number }).deviceMemory;
    localStorage.clear();
  });

  it('counts 2 or fewer cores, or under 4 GB of memory, as a device to spare', () => {
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 2 })).toBe(true);
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 2, deviceMemory: 8 })).toBe(true);
    // Safari clamps the core count to 4 or 8 and hides memory: an iPhone.
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 4 })).toBe(false);
    // A budget phone: many slow cores, little memory.
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 8, deviceMemory: 4 })).toBe(false);
    // Browsers that hide memory (or both) keep the full scene.
    expect(isLikelyLowEndDevice({ hardwareConcurrency: 12 })).toBe(false);
    expect(isLikelyLowEndDevice({})).toBe(false);
  });

  it('starts with scenery off on such a device until the player picks', () => {
    deviceReports({ hardwareConcurrency: 2 });
    expect(loadGamePreferences().scenery).toBe(false);
    // Settings saved before the switch existed get the device's default too.
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify({ captions: false }));
    expect(loadGamePreferences()).toMatchObject({ captions: false, scenery: false });
    // A choice the player made wins either way.
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify({ scenery: true }));
    expect(loadGamePreferences().scenery).toBe(true);
  });

  it('starts with scenery on elsewhere', () => {
    deviceReports({ hardwareConcurrency: 16, deviceMemory: 8 });
    expect(loadGamePreferences().scenery).toBe(true);
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify({ scenery: false }));
    expect(loadGamePreferences().scenery).toBe(false);
  });
});
