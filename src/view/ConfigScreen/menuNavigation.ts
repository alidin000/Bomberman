import type React from 'react';
import { useEffect } from 'react';

// Neighbouring toggle buttons share a border, so they overlap by a pixel or two.
const EDGE_OVERLAP_PX = 4;

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
  let bestOffset = Number.POSITIVE_INFINITY;
  Array.from(candidates).forEach((candidate) => {
    if (candidate === current) return;
    const rect = candidate.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const dx = rect.left + rect.width / 2 - fromX;
    const dy = rect.top + rect.height / 2 - fromY;
    const along = dx * direction[0] + dy * direction[1];
    if (along <= 1) return;
    // Only buttons past the current one's edge count: Left from a seat card
    // does not jump up to the wide tile that hangs over it.
    const [x, y] = direction;
    let ahead: number;
    if (x > 0) ahead = rect.left - from.right;
    else if (x < 0) ahead = from.left - rect.right;
    else if (y > 0) ahead = rect.top - from.bottom;
    else ahead = from.top - rect.bottom;
    if (ahead < -EDGE_OVERLAP_PX) return;
    // Sideways distance is the gap between the two edges, so a button that
    // lines up with the current one (even partly) beats a nearer one off to
    // the side: Down from a wide tile reaches the row right under it.
    const across = x === 0
      ? Math.max(0, rect.left - from.right, from.left - rect.right)
      : Math.max(0, rect.top - from.bottom, from.top - rect.bottom);
    const score = along + across * 2;
    // Two buttons that both line up score the same; the one whose centre is
    // nearer wins (Up from a wide slider rail reaches the switch over its middle).
    const offset = x === 0 ? Math.abs(dx) : Math.abs(dy);
    if (score < bestScore || (score === bestScore && offset < bestOffset)) {
      best = candidate;
      bestScore = score;
      bestOffset = offset;
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

const ROVING_STOP_ATTR = 'data-roving-stop';

/**
 * Put this attribute on the element that wraps a toggle group or a card grid
 * to make the whole group one Tab stop (`<div data-roving-group>`). The arrow
 * keys still reach every button in it.
 */
export const ROVING_GROUP_ATTRIBUTE = 'data-roving-group';

/**
 * Gives each data-roving-group under `root` a single Tab stop (roving tabindex):
 * the focused button, else the selected one (aria-pressed), else the last one
 * used, else one marked data-roving-default, else the first. Every other
 * button in the group gets tabIndex -1, so it stays reachable with the arrow
 * keys and the mouse.
 */
export function syncRovingTabStops(
  root: ParentNode,
  focused: Element | null = document.activeElement
): void {
  root.querySelectorAll<HTMLElement>(`[${ROVING_GROUP_ATTRIBUTE}]`).forEach((group) => {
    const items = Array.from(group.querySelectorAll<HTMLButtonElement>('button'))
      .filter((item) => !item.disabled);
    if (items.length === 0) return;
    const stop = items.find((item) => item === focused)
      ?? items.find((item) => item.getAttribute('aria-pressed') === 'true')
      ?? items.find((item) => item.hasAttribute(ROVING_STOP_ATTR))
      ?? items.find((item) => item.hasAttribute('data-roving-default'))
      ?? items[0];
    items.forEach((item) => {
      // eslint-disable-next-line no-param-reassign
      item.tabIndex = item === stop ? 0 : -1;
      item.toggleAttribute(ROVING_STOP_ATTR, item === stop);
    });
  });
}

/** onFocus handler for a menu container: the focused button becomes its group's stop. */
export function keepRovingStopOnFocus(event: React.FocusEvent<HTMLElement>): void {
  syncRovingTabStops(event.currentTarget, event.target);
}

/**
 * Re-applies the single Tab stops after every render of the menu that renders
 * it. Render it inside the dialog (after the content) so the root is mounted.
 */
export function RovingTabStops({ root }: { root: React.RefObject<HTMLElement> }): null {
  useEffect(() => {
    if (root.current) syncRovingTabStops(root.current);
  });
  return null;
}
