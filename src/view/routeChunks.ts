import { lazy, useEffect } from 'react';
import type { ComponentType } from 'react';

/**
 * Screens that stay out of the first-load bundle. Each chunk keeps its import
 * promise, so a prefetch and the route render share one download.
 */
export interface RouteChunk<M> {
  load: () => Promise<M>;
  prefetch: () => void;
}

// Route renders (not prefetches) waiting on a chunk right now.
let routeRendersWaiting = 0;
let reloadingForStaleChunk = false;

function waitForNavigation() {
  // Never settles: the page is navigating away.
}

export function createRouteChunk<M>(importer: () => Promise<M>): RouteChunk<M> {
  let pending: Promise<M> | null = null;
  const load = () => {
    if (!pending) {
      const attempt = importer().then((module) => {
        // Vite resolves to undefined once the stale-chunk handler below has
        // cancelled the error. The page is leaving, so never settle.
        if (!module && reloadingForStaleChunk) return new Promise<M>(waitForNavigation);
        if (!module) throw new Error('Screen chunk failed to load');
        return module;
      });
      // A failed download is retried on the next load, not cached.
      attempt.catch(() => {
        if (pending === attempt) pending = null;
      });
      pending = attempt;
    }
    return pending;
  };
  return {
    load,
    prefetch: () => {
      load().catch(() => undefined);
    },
  };
}

/** `React.lazy` for one named export of a route chunk. */
export function lazyScreen<M, K extends keyof M>(chunk: RouteChunk<M>, exportName: K) {
  return lazy(async () => {
    routeRendersWaiting += 1;
    try {
      const module = await chunk.load();
      return { default: module[exportName] as unknown as ComponentType };
    } finally {
      routeRendersWaiting -= 1;
    }
  });
}

export const gameScreenChunk = createRouteChunk(() => import('./GameScreen/GameScreen'));
// A Training Dojo room runs the match screen, so it shares the match chunk.
export const dojoRoomChunk = createRouteChunk(() => import('./DojoScreen/DojoRoomScreen'));

/** The village hub: only campaign players open it, from the deck or a result. */
export const hubScreenChunk = createRouteChunk(() => import('./HubScreen/HubScreen'));

/** Starts the hub chunk download when the calling screen mounts. */
export function usePrefetchHubScreen(): void {
  useEffect(() => {
    hubScreenChunk.prefetch();
  }, []);
}

/** Starts the game chunk download when the calling screen mounts. */
export function usePrefetchGameScreen(): void {
  useEffect(() => {
    gameScreenChunk.prefetch();
  }, []);
}

/**
 * Starts the game chunk download after the page has loaded and the main
 * thread is idle, so it never competes with the first paint.
 */
export function usePrefetchGameScreenWhenIdle(): void {
  useEffect(() => {
    let idle: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(() => gameScreenChunk.prefetch(), { timeout: 2000 });
      } else {
        timer = window.setTimeout(() => gameScreenChunk.prefetch(), 200);
      }
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
}

const STALE_RELOAD_KEY = 'shinobiStaleChunkReloadAt';
const STALE_RELOAD_COOLDOWN_MS = 10_000;

/**
 * A tab opened before a deploy still asks for the old hashed chunks, which are
 * gone, and Vite fires `vite:preloadError`. Reload the app once instead of
 * leaving a blank screen. It goes to `/` because a reload of a deep link only
 * works where the host has the SPA rewrite from render.yaml.
 */
export function installStaleChunkReload(
  navigate: (url: string) => void = (url) => window.location.assign(url)
): () => void {
  const onPreloadError = (event: Event) => {
    // A failed background prefetch is retried when the screen opens.
    if (routeRendersWaiting === 0) return;
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(STALE_RELOAD_KEY));
      // Reloaded moments ago and still failing: let the error surface.
      if (last > 0 && now - last < STALE_RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(STALE_RELOAD_KEY, String(now));
    } catch {
      return; // Without storage a reload loop cannot be ruled out.
    }
    event.preventDefault();
    reloadingForStaleChunk = true;
    navigate('/');
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
