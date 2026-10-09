import { vi } from 'vitest';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

// The menu screens with nothing but a pad: title, Mission Deck and manual.

type TestPad = {
  index: number;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
};

const A = 0;
const B = 1;
const DPAD_DOWN = 13;
const DPAD_RIGHT = 15;

let pads: TestPad[] = [];

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function tap(button: number) {
  pads[0].buttons[button].pressed = true;
  wait(20);
  pads[0].buttons[button].pressed = false;
  wait(20);
}

// jsdom has no layout: the title screen's three buttons as a full-width
// Quick Play over the two secondary actions.
const LAYOUT: Record<string, [number, number, number, number]> = {
  'Quick Play': [96, 420, 422, 48],
  'Enter the Arena': [96, 498, 210, 44],
  'Shinobi Manual': [318, 498, 200, 44],
};

describe('menu screens on a pad', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function box(
      this: HTMLElement
    ) {
      const [x, y, width, height] = LAYOUT[this.textContent?.trim() ?? ''] ?? [0, 0, 0, 0];
      return {
        x,
        y,
        width,
        height,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      } as DOMRect;
    });
    pads = [{
      index: 0,
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    }];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => pads,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('walks from the title to the Mission Deck and the manual and back, pad only', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Quick Play' })).toHaveFocus();
    wait(20);

    tap(DPAD_DOWN);
    expect(screen.getByRole('button', { name: 'Enter the Arena' })).toHaveFocus();
    tap(A);
    expect(screen.getByRole('heading', { name: 'Mission Deck' })).toBeInTheDocument();

    // B is Escape: the first step goes back to the title.
    tap(B);
    expect(screen.getByRole('heading', { name: 'Explosive Shinobi Arena' })).toBeInTheDocument();

    tap(DPAD_DOWN);
    tap(DPAD_RIGHT);
    expect(screen.getByRole('button', { name: 'Shinobi Manual' })).toHaveFocus();
    tap(A);
    expect(screen.getByRole('heading', { name: 'Shinobi Field Manual' })).toBeInTheDocument();

    tap(B);
    expect(screen.getByRole('heading', { name: 'Explosive Shinobi Arena' })).toBeInTheDocument();
  });
});
