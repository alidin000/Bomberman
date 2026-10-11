import { TICK_MS } from '../engine/constants';

export const MAX_ONLINE_GLIDE_MS = 150;

/**
 * Stretch a glide across delayed or React-batched snapshots. This keeps the
 * latest authoritative position while avoiding a burst through skipped ticks.
 */
export function onlineGlideDuration(
  previousTick: number,
  nextTick: number,
  observedIntervalMs: number
): number {
  const tickSpan = Math.max(1, nextTick - previousTick) * TICK_MS;
  const observed = Number.isFinite(observedIntervalMs)
    ? Math.max(TICK_MS, observedIntervalMs)
    : TICK_MS;
  return Math.min(MAX_ONLINE_GLIDE_MS, Math.max(tickSpan, observed));
}
