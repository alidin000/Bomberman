import { useSyncExternalStore } from 'react';
import { TouchSize } from './touchLayout';

/** How solid the controls are at rest; pressed controls are always solid. */
export const TOUCH_OPACITY_LEVELS = [35, 60, 100] as const;
export type TouchOpacity = typeof TOUCH_OPACITY_LEVELS[number];
export const TOUCH_SIZES: readonly TouchSize[] = ['small', 'medium', 'large'];

export type TouchPreferences = {
  size: TouchSize;
  opacity: TouchOpacity;
  /** The pad on the right and the bomb cluster on the left. */
  leftHanded: boolean;
  /** A short buzz on each press, where the browser can (Android). Never the only cue. */
  vibration: boolean;
};

export const TOUCH_PREFERENCES_KEY = 'shinobiTouchControls';

export const DEFAULT_TOUCH_PREFERENCES: TouchPreferences = {
  size: 'medium',
  opacity: 60,
  leftHanded: false,
  vibration: false,
};

export function normalizeTouchPreferences(value: unknown): TouchPreferences {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof TouchPreferences, unknown>>;
  const size = TOUCH_SIZES.find((item) => item === raw.size) ?? DEFAULT_TOUCH_PREFERENCES.size;
  const opacity = TOUCH_OPACITY_LEVELS.find((item) => item === raw.opacity)
    ?? DEFAULT_TOUCH_PREFERENCES.opacity;
  return {
    size,
    opacity,
    leftHanded: typeof raw.leftHanded === 'boolean' ? raw.leftHanded : DEFAULT_TOUCH_PREFERENCES.leftHanded,
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : DEFAULT_TOUCH_PREFERENCES.vibration,
  };
}

export function loadTouchPreferences(): TouchPreferences {
  try {
    const stored = localStorage.getItem(TOUCH_PREFERENCES_KEY);
    return normalizeTouchPreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_TOUCH_PREFERENCES;
  }
}

// One copy for the overlay, the camera and Settings, so a change in
// Settings moves the controls and the framing at once.
let current: TouchPreferences | null = null;
const listeners = new Set<() => void>();

export function getTouchPreferences(): TouchPreferences {
  if (!current) current = loadTouchPreferences();
  return current;
}

export function setTouchPreferences(next: TouchPreferences): void {
  current = normalizeTouchPreferences(next);
  try {
    localStorage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(current));
  } catch {
    // The new layout still applies for this visit when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

/** Forgets the in-memory copy, so the next read comes from storage again. */
export function reloadTouchPreferences(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

export function subscribeTouchPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTouchPreferences(): TouchPreferences {
  return useSyncExternalStore(subscribeTouchPreferences, getTouchPreferences, getTouchPreferences);
}
