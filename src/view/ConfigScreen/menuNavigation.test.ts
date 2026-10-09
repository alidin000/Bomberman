import type React from 'react';
import { moveFocusWithArrows, syncRovingTabStops } from './menuNavigation';

type Box = { left: number; top: number; width: number; height: number };

function button(label: string, box: Box): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = label;
  element.getBoundingClientRect = () => ({
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => box,
  });
  return element;
}

function pressArrow(container: HTMLElement, key: string): void {
  const event = {
    key,
    currentTarget: container,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: () => {},
  } as unknown as React.KeyboardEvent<HTMLElement>;
  moveFocusWithArrows(event);
}

describe('moveFocusWithArrows', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves Down from a wide tile to the row lined up under it, not a farther row', () => {
    // The mission step at 1366x768: the Solo tile, the first route card under
    // its left edge, and the difficulty row further down but nearer the centre.
    const container = document.createElement('div');
    const solo = button('Solo Campaign', {
      left: 220, top: 131, width: 464, height: 54,
    });
    const route = button('Hidden Leaf route', {
      left: 220, top: 385, width: 127, height: 75,
    });
    const story = button('Story', {
      left: 220, top: 500, width: 308, height: 38,
    });
    const normal = button('Normal', {
      left: 528, top: 500, width: 309, height: 38,
    });
    container.append(solo, route, story, normal);
    document.body.append(container);

    solo.focus();
    pressArrow(container, 'ArrowDown');
    expect(document.activeElement).toBe(route);

    pressArrow(container, 'ArrowDown');
    expect(document.activeElement).toBe(story);
    pressArrow(container, 'ArrowRight');
    expect(document.activeElement).toBe(normal);
  });

  it('moves Left from the add seat to the seat beside it, not the wide tile above', () => {
    // The Local setup at 1366x768: the Local Arena tile overhangs the add seat.
    const container = document.createElement('div');
    const tile = button('Local Arena', {
      left: 684, top: 131, width: 462, height: 54,
    });
    const nextP2 = button('Next shinobi for P2', {
      left: 730, top: 334, width: 32, height: 32,
    });
    const add = button('Add shinobi', {
      left: 847, top: 198, width: 299, height: 226,
    });
    container.append(tile, nextP2, add);
    document.body.append(container);

    add.focus();
    pressArrow(container, 'ArrowLeft');
    expect(document.activeElement).toBe(nextP2);
  });
});

describe('syncRovingTabStops', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps one Tab stop per group: the focused button, else the selected one, else the last used', () => {
    const root = document.createElement('div');
    const toggles = document.createElement('div');
    toggles.setAttribute('data-roving-group', '');
    const [one, three, five] = ['1', 'Best of 3', 'Best of 5'].map((label) => {
      const element = document.createElement('button');
      element.textContent = label;
      return element;
    });
    three.setAttribute('aria-pressed', 'true');
    toggles.append(one, three, five);
    const cards = document.createElement('div');
    cards.setAttribute('data-roving-group', '');
    const [p1, p2] = ['P1 chip', 'P2 chip'].map((label) => {
      const element = document.createElement('button');
      element.textContent = label;
      return element;
    });
    cards.append(p1, p2);
    const footer = document.createElement('button');
    root.append(toggles, cards, footer);
    document.body.append(root);

    syncRovingTabStops(root, null);
    expect([one, three, five].map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    expect([p1, p2].map((item) => item.tabIndex)).toEqual([0, -1]);
    expect(footer.tabIndex).toBe(0);

    // Focus moves the stop; leaving the group keeps it on the last card used,
    // while a toggle group returns to its selected option.
    syncRovingTabStops(root, p2);
    syncRovingTabStops(root, five);
    expect([one, three, five].map((item) => item.tabIndex)).toEqual([-1, -1, 0]);
    syncRovingTabStops(root, footer);
    expect([p1, p2].map((item) => item.tabIndex)).toEqual([-1, 0]);
    expect([one, three, five].map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
  });
});
