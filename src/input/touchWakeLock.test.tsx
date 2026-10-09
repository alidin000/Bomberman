import { vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenWakeLock } from './touchWakeLock';

function fakeWakeLock() {
  const sentinels: { release: ReturnType<typeof vi.fn>; fire: () => void }[] = [];
  const request = vi.fn(() => {
    let onRelease: (() => void) | null = null;
    const sentinel = {
      release: vi.fn(() => Promise.resolve()),
      addEventListener: (_type: string, listener: () => void) => { onRelease = listener; },
      fire: () => onRelease?.(),
    };
    sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, sentinels };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('screen wake lock during a match', () => {
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    setVisibility('visible');
  });

  it('holds the screen on while a round plays, and lets go when it stops', async () => {
    const { request, sentinels } = fakeWakeLock();
    const { rerender, unmount } = renderHook(({ active }) => useScreenWakeLock(active), {
      initialProps: { active: false },
    });
    expect(request).not.toHaveBeenCalled();

    rerender({ active: true });
    await act(async () => undefined);
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ active: false });
    expect(sentinels[0].release).toHaveBeenCalled();
    unmount();
  });

  it('takes the lock again when the page comes back, since the browser drops it', async () => {
    const { request, sentinels } = fakeWakeLock();
    renderHook(() => useScreenWakeLock(true));
    await act(async () => undefined);
    expect(request).toHaveBeenCalledTimes(1);

    // Hidden: the browser releases the lock itself.
    setVisibility('hidden');
    sentinels[0].fire();
    expect(request).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    await act(async () => undefined);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('plays on where there is no wake lock or it is refused', async () => {
    renderHook(() => useScreenWakeLock(true));
    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    const { unmount } = renderHook(() => useScreenWakeLock(true));
    await act(async () => undefined);
    expect(request).toHaveBeenCalled();
    unmount();
  });
});
