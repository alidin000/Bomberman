import { createRefCache } from './labelSprites';

function trackedCache(maxIdle: number) {
  const created: string[] = [];
  const disposed: string[] = [];
  const cache = createRefCache(
    (key) => { created.push(key); return { key }; },
    (value) => { disposed.push(value.key); },
    maxIdle
  );
  const use = (key: string) => {
    const value = cache.get(key);
    cache.retain(key, value);
    return value;
  };
  return {
    cache, created, disposed, use,
  };
}

describe('createRefCache', () => {
  it('reuses a released label instead of drawing it again', () => {
    const { cache, created, use } = trackedCache(4);
    const first = use('Rogue Chunin');
    cache.release('Rogue Chunin', first);
    const again = use('Rogue Chunin');
    expect(again).toBe(first);
    expect(created).toEqual(['Rogue Chunin']);
  });

  it('disposes the least recently released idle entries beyond the limit, never one in use', () => {
    const { cache, disposed, use } = trackedCache(2);
    const kept = use('kept');
    const labels = ['a', 'b', 'c', 'd'].map((key) => [key, use(key)] as const);
    labels.forEach(([key, value]) => cache.release(key, value));
    expect(disposed).toEqual(['a', 'b']);
    expect(cache.get('kept')).toBe(kept);
    cache.release('kept', kept);
    cache.disposeIdle();
    expect(disposed).toEqual(['a', 'b', 'c', 'd', 'kept']);
    expect(cache.size()).toBe(0);
  });

  it('counts every user before an entry becomes idle', () => {
    const { cache, disposed, use } = trackedCache(0);
    const value = use('Phase 2');
    use('Phase 2');
    cache.release('Phase 2', value);
    expect(disposed).toEqual([]);
    cache.release('Phase 2', value);
    expect(disposed).toEqual(['Phase 2']);
  });

  it('ignores a release for a value that was already replaced', () => {
    const { cache, disposed, use } = trackedCache(1);
    const stale = cache.get('Gate Open');
    // Evicted before its user committed; the next user gets a fresh value.
    cache.get('other');
    cache.get('another');
    expect(disposed).toEqual(['Gate Open', 'other']);
    const fresh = use('Gate Open');
    expect(fresh).not.toBe(stale);
    cache.release('Gate Open', stale);
    expect(cache.get('Gate Open')).toBe(fresh);
    expect(disposed.filter((key) => key === 'Gate Open')).toHaveLength(1);
  });
});
