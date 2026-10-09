export type GamePreferences = {
  soundEnabled: boolean;
  effectsVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  screenShake: number;
  hudScale: number;
  captions: boolean;
  /**
   * Stage scenery: the off-grid landmarks around the arena. Off draws less
   * on slower devices; the sky and fog stay, so each stage still reads.
   * Scene code reads it through `useScenery()` (scene/scenery.ts).
   */
  scenery: boolean;
};

export const GAME_PREFERENCES_KEY = 'shinobiGamePreferences';

export const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  soundEnabled: true,
  effectsVolume: 65,
  reducedMotion: false,
  highContrast: false,
  screenShake: 55,
  hudScale: 100,
  captions: true,
  scenery: true,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** What the browser tells about the device without asking (both may be missing). */
export type DeviceHints = {
  hardwareConcurrency?: number;
  /** GB, rounded down to a power of two; Chromium only. */
  deviceMemory?: number;
};

const isKnown = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

/**
 * A device that likely struggles with the full scene: 2 or fewer logical
 * cores, or under 4 GB of memory (budget phones, which often report 8 slow
 * cores; Chromium only). Not 4 cores: Safari 15.4+ clamps the count to 4 or 8
 * against fingerprinting, so every iPhone would look weak. Unknown counts as
 * capable, so browsers that hide these keep the full scene.
 */
export function isLikelyLowEndDevice(
  hints: DeviceHints | undefined = typeof navigator === 'undefined' ? undefined : navigator as DeviceHints
): boolean {
  if (!hints) return false;
  const cores = hints.hardwareConcurrency;
  const memory = hints.deviceMemory;
  return (isKnown(cores) && cores <= 2) || (isKnown(memory) && memory < 4);
}

export function normalizeGamePreferences(
  value?: Partial<GamePreferences> | null,
  // Scenery's default depends on the device (see loadGamePreferences).
  defaultScenery: boolean = DEFAULT_GAME_PREFERENCES.scenery
): GamePreferences {
  return {
    soundEnabled: typeof value?.soundEnabled === 'boolean'
      ? value.soundEnabled
      : DEFAULT_GAME_PREFERENCES.soundEnabled,
    effectsVolume: clamp(value?.effectsVolume, DEFAULT_GAME_PREFERENCES.effectsVolume, 0, 100),
    reducedMotion: typeof value?.reducedMotion === 'boolean'
      ? value.reducedMotion
      : DEFAULT_GAME_PREFERENCES.reducedMotion,
    highContrast: typeof value?.highContrast === 'boolean'
      ? value.highContrast
      : DEFAULT_GAME_PREFERENCES.highContrast,
    screenShake: clamp(value?.screenShake, DEFAULT_GAME_PREFERENCES.screenShake, 0, 100),
    hudScale: clamp(value?.hudScale, DEFAULT_GAME_PREFERENCES.hudScale, 80, 125),
    captions: typeof value?.captions === 'boolean'
      ? value.captions
      : DEFAULT_GAME_PREFERENCES.captions,
    scenery: typeof value?.scenery === 'boolean' ? value.scenery : defaultScenery,
  };
}

export function loadGamePreferences(): GamePreferences {
  // Scenery follows the device until saved settings say otherwise (settings
  // saved before the switch existed included). Saving any setting keeps it.
  const defaultScenery = !isLikelyLowEndDevice();
  try {
    const stored = localStorage.getItem(GAME_PREFERENCES_KEY);
    if (stored) return normalizeGamePreferences(JSON.parse(stored), defaultScenery);
  } catch {
    // Storage is optional; system preferences still provide a useful default.
  }

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const highContrast = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-contrast: more)').matches;
  return normalizeGamePreferences({ reducedMotion, highContrast }, defaultScenery);
}

export function saveGamePreferences(preferences: GamePreferences): void {
  try {
    localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Keep the in-memory settings usable when browser storage is unavailable.
  }
}

/**
 * Mirrors high contrast and reduced motion onto <html> as `data-contrast`
 * ("more" | "normal") and `data-motion` ("reduce" | "full"), so the page's
 * CSS (index.css) follows the in-game switches and not only the system
 * settings. The attributes stay after a match, so menus follow them too.
 */
export function applyDocumentPreferences(
  preferences: Pick<GamePreferences, 'highContrast' | 'reducedMotion'>,
  root: HTMLElement | undefined = typeof document === 'undefined' ? undefined : document.documentElement
): void {
  if (!root) return;
  root.setAttribute('data-contrast', preferences.highContrast ? 'more' : 'normal');
  root.setAttribute('data-motion', preferences.reducedMotion ? 'reduce' : 'full');
}
