import { vi } from 'vitest';
import React, { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';

type RouteChunks = typeof import('./routeChunks');

const Screen = () => <div>Screen</div>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function preloadError(): Event {
  const event = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('route chunks', () => {
  let chunks: RouteChunks;

  beforeEach(async () => {
    vi.resetModules();
    sessionStorage.clear();
    chunks = await import('./routeChunks');
  });

  it('downloads once however many times a screen is prefetched and opened', async () => {
    const importer = vi.fn(() => Promise.resolve({ Screen }));
    const chunk = chunks.createRouteChunk(importer);

    chunk.prefetch();
    chunk.prefetch();
    const Lazy = chunks.lazyScreen(chunk, 'Screen');
    render(<Suspense fallback="loading"><Lazy /></Suspense>);

    expect(await screen.findByText('Screen')).toBeInTheDocument();
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('retries a failed prefetch when the screen is opened', async () => {
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ Screen });
    const chunk = chunks.createRouteChunk(importer);

    chunk.prefetch();
    await act(async () => { await Promise.resolve(); });
    await expect(chunk.load()).resolves.toEqual({ Screen });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('reloads the app once when a screen waits on a chunk from an old deploy', async () => {
    const navigate = vi.fn();
    const uninstall = chunks.installStaleChunkReload(navigate);
    const download = deferred<{ Screen: typeof Screen }>();
    const Lazy = chunks.lazyScreen(chunks.createRouteChunk(() => download.promise), 'Screen');
    render(<Suspense fallback="loading"><Lazy /></Suspense>);
    await act(async () => { await Promise.resolve(); });

    const first = preloadError();
    expect(first.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/');

    // Still failing right after that reload: no loop, let the error surface.
    const second = preloadError();
    expect(second.defaultPrevented).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);

    // Vite resolves the import to undefined once the error is cancelled; the
    // screen keeps its fallback while the page navigates away.
    await act(async () => { download.resolve(undefined as never); });
    expect(screen.getByText('loading')).toBeInTheDocument();
    uninstall();
  });

  it('does not reload when only a background prefetch fails', () => {
    const navigate = vi.fn();
    const uninstall = chunks.installStaleChunkReload(navigate);
    chunks.createRouteChunk(() => deferred<unknown>().promise).prefetch();

    expect(preloadError().defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    uninstall();
  });
});
