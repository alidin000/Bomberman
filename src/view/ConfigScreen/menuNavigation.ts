import type React from 'react';

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * The candidate nearest to `current` in `direction` (a unit [x, y] step), or
 * null: the arrow-key scoring below, shared with gamepad menu navigation.
 */
export function nearestInDirection(
  current: Element,
  candidates: Iterable<HTMLElement>,
  direction: readonly [number, number]
): HTMLElement | null {
  const from = current.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  Array.from(candidates).forEach((candidate) => {
    if (candidate === current) return;
    const rect = candidate.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const dx = rect.left + rect.width / 2 - fromX;
    const dy = rect.top + rect.height / 2 - fromY;
    const along = dx * direction[0] + dy * direction[1];
    if (along <= 1) return;
    const across = Math.abs(dx * direction[1]) + Math.abs(dy * direction[0]);
    const score = along + across * 2;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Lets the arrow keys move focus to the nearest enabled button in that
 * direction, like a console menu. Tab order is unchanged. Text inputs (the key
 * rebinding tiles) keep the arrow keys for themselves.
 */
export function moveFocusWithArrows(event: React.KeyboardEvent<HTMLElement>): void {
  const direction = DIRECTIONS[event.key];
  if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const current = document.activeElement as HTMLElement | null;
  const container = event.currentTarget;
  if (!current || current.tagName === 'INPUT' || !container.contains(current)) return;

  const best = nearestInDirection(
    current,
    container.querySelectorAll<HTMLElement>('button:not(:disabled)'),
    direction
  );
  if (best) {
    event.preventDefault();
    best.focus();
  }
}
