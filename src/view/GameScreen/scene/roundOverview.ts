import { ROUND_START_COUNTDOWN_MS } from '../../../engine/initialState';
import type { GameEngineState } from '../../../engine/types';
import type { GameMode } from '../../../content/types';
import { arenaMapForConfig } from '../../../content/arenaMaps';
import { OVERVIEW_PLATE } from '../../CityArena/overviewPlate';
import { ScreenInsets, framingScaleFor, groupShift } from './cameraFraming';
import { ARENA_FRAME_PX } from './canvasInsets';

// The round-start overview of a city arena. The play camera frames the
// players, so at spawn it shows the top-left fifth of the board. In the first
// round's 3-2-1 countdown, while the arena is frozen anyway, the camera
// frames the whole board instead, then returns to the players a second
// before GO. Render only: the countdown, the engine and the result never
// depend on it, and a player can skip it at any time.

/** The overview ends with this much countdown left: the last second is on the players. */
export const OVERVIEW_END_MS = 1000;
/** Zoom-out cap for the overview: a 35x35 board fits well inside it on any screen. */
export const OVERVIEW_MAX_FRAMING = 8;
/** The slow push-in over the overview (framing multiplier at its end). */
export const OVERVIEW_PUSH = 0.94;

type OverviewState = Pick<GameEngineState, 'round' | 'phase' | 'roundStartTicksRemaining' | 'config'>;

/** True for a match whose first countdown opens on the overview: a city arena map. */
export function hasRoundOverview(config: { mode?: GameMode; selectedMap: string }): boolean {
  return arenaMapForConfig(config)?.family === 'city';
}

/** True while the overview is due: a city map's first round, before its last countdown second. */
export function overviewDue(state: OverviewState | null): boolean {
  return !!state
    && state.round === 1
    && state.phase === 'playing'
    && state.roundStartTicksRemaining > OVERVIEW_END_MS
    && hasRoundOverview(state.config);
}

/**
 * Milliseconds into the overview for a countdown with `remainingMs` left, or
 * null once the camera belongs to the players again.
 */
export function overviewMs(remainingMs: number): number | null {
  if (!(remainingMs > OVERVIEW_END_MS)) return null;
  return Math.max(0, ROUND_START_COUNTDOWN_MS - remainingMs);
}

/**
 * The framing multiplier `ms` into the overview: a gentle push-in, eased at
 * both ends. Under reduced motion the view holds still (and the camera cuts
 * in and out instead of moving).
 */
export function overviewPush(ms: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const span = ROUND_START_COUNTDOWN_MS - OVERVIEW_END_MS;
  const t = Math.min(1, Math.max(0, ms / span));
  const eased = t * t * (3 - 2 * t);
  return 1 + (OVERVIEW_PUSH - 1) * eased;
}

export type BoardOverview = {
  /** The board's centre, in cells. */
  centerX: number;
  centerY: number;
  /** How far (cells) to aim off the centre so the board clears the HUD bands. */
  shift: number;
  /** Camera framing that fits the whole board outside the HUD bands. */
  scale: number;
};

/**
 * The canvas bands the overview frames the board inside: the HUD's, with the
 * bottom one at least as tall as the overview plate's (it stands
 * `safeBottomPx` above the screen's edge), so the plate, with the countdown
 * in it, covers no cell. `canvasHeight` is in CSS px.
 */
export function overviewInsets(
  insets: ScreenInsets,
  canvasHeight: number,
  safeBottomPx = 0
): ScreenInsets {
  // The plate's top above the canvas's bottom edge, air included: the canvas
  // sits ARENA_FRAME_PX inside the screen.
  const platePx = safeBottomPx + OVERVIEW_PLATE.gapPx + OVERVIEW_PLATE.heightPx
    + OVERVIEW_PLATE.airPx - ARENA_FRAME_PX;
  return { ...insets, bottom: Math.max(insets.bottom, platePx / Math.max(canvasHeight, 1)) };
}

/**
 * Where the camera frames a `width` x `height` board from: the players'
 * framing rule (cameraFraming.ts) applied to the whole board as one box.
 */
export function boardOverview(
  width: number,
  height: number,
  aspect: number,
  insets: ScreenInsets
): BoardOverview {
  const halfWidth = Math.max(0, (width - 1) / 2);
  const halfDepth = Math.max(0, (height - 1) / 2);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets, OVERVIEW_MAX_FRAMING);
  return {
    centerX: halfWidth,
    centerY: halfDepth,
    shift: groupShift(scale, halfWidth, halfDepth, insets),
    scale,
  };
}
