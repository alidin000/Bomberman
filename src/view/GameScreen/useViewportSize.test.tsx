import { act, renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, it,
} from 'vitest';
import { useViewportSize } from './useViewportSize';

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

describe('useViewportSize', () => {
  it('falls back to the layout viewport', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const { result } = renderHook(() => useViewportSize());
    expect(result.current).toEqual({ width: 390, height: 844 });
  });

  it('tracks the actually visible viewport on mobile', () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      width: { configurable: true, value: 844 },
      height: { configurable: true, value: 360 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    const { result } = renderHook(() => useViewportSize());
    expect(result.current).toEqual({ width: 844, height: 360 });

    Object.defineProperty(viewport, 'height', { configurable: true, value: 390 });
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(result.current).toEqual({ width: 844, height: 390 });
  });
});
