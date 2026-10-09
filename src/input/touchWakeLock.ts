import { useEffect } from 'react';

// Screen Wake Lock (Chrome 84+, Firefox 126+, Safari 16.4+): a phone held
// still through a match would otherwise dim and lock. Not in TypeScript
// 4.9's DOM types, so the little that is used is typed here.
type WakeLockSentinelLike = {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
};
type WakeLockLike = { request(type: 'screen'): Promise<WakeLockSentinelLike> };

function screenWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const { wakeLock } = navigator as Navigator & { wakeLock?: WakeLockLike };
  return wakeLock && typeof wakeLock.request === 'function' ? wakeLock : null;
}

/**
 * Keeps the screen on while `active` (a round in play), where supported.
 * The browser drops the lock whenever the page is hidden, so it is taken
 * again when the page comes back. A refused request (battery saver, no
 * focus) is ignored: the match plays on either way.
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = active ? screenWakeLock() : null;
    if (!wakeLock) return undefined;
    let held: WakeLockSentinelLike | null = null;
    let pending = false;
    let disposed = false;
    const acquire = () => {
      if (disposed || held || pending || document.visibilityState !== 'visible') return;
      pending = true;
      wakeLock.request('screen').then((lock) => {
        pending = false;
        if (disposed) {
          lock.release().catch(() => undefined);
          return;
        }
        held = lock;
        lock.addEventListener?.('release', () => {
          if (held === lock) held = null;
        });
      }, () => {
        pending = false;
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      held?.release().catch(() => undefined);
      held = null;
    };
  }, [active]);
}
