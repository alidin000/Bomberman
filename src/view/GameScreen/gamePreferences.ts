export type GamePreferences = {
  soundEnabled: boolean;
  effectsVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  screenShake: number;
  hudScale: number;
  captions: boolean;
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
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeGamePreferences(
  value?: Partial<GamePreferences> | null
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
  };
}

export function loadGamePreferences(): GamePreferences {
  try {
    const stored = localStorage.getItem(GAME_PREFERENCES_KEY);
    if (stored) return normalizeGamePreferences(JSON.parse(stored));
  } catch {
    // Storage is optional; system preferences still provide a useful default.
  }

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const highContrast = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-contrast: more)').matches;
  return normalizeGamePreferences({ reducedMotion, highContrast });
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
