import { vi } from 'vitest';
import {
  loadDojoProgress,
  markDojoSuggested,
  nextDojoRoomId,
  recordDojoRoomCleared,
  recordDojoRoomSkipped,
  shouldSuggestDojo,
} from './dojoProgress';

describe('Training Dojo progress', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps cleared and skipped rooms across reloads, in room order', () => {
    recordDojoRoomCleared('pillarShade');
    recordDojoRoomSkipped('fuseStep');
    recordDojoRoomCleared('lanternWalk');
    // A fresh read is what the next visit sees.
    const progress = loadDojoProgress();
    expect(progress).toEqual({ cleared: ['lanternWalk', 'pillarShade'], skipped: ['fuseStep'] });
    expect(nextDojoRoomId(progress)).toBe('scrollSentry');
  });

  it('clearing a skipped room drops the skip, and a cleared room is never marked skipped', () => {
    recordDojoRoomSkipped('fuseStep');
    recordDojoRoomCleared('fuseStep');
    recordDojoRoomSkipped('fuseStep');
    expect(loadDojoProgress()).toEqual({ cleared: ['fuseStep'], skipped: [] });
  });

  it('reads damaged or foreign saves as no progress instead of failing', () => {
    localStorage.setItem('shinobiDojoProgress', '{not json');
    expect(loadDojoProgress()).toEqual({ cleared: [], skipped: [] });
    localStorage.setItem('shinobiDojoProgress', JSON.stringify({ cleared: ['bossRush', 'fuseStep', 'fuseStep'], skipped: 'x' }));
    expect(loadDojoProgress()).toEqual({ cleared: ['fuseStep'], skipped: [] });
  });

  it('survives storage that refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(recordDojoRoomCleared('lanternWalk').cleared).toEqual(['lanternWalk']);
    expect(() => markDojoSuggested()).not.toThrow();
  });

  it('suggests the dojo until it has been suggested or played', () => {
    expect(shouldSuggestDojo()).toBe(true);
    markDojoSuggested();
    expect(shouldSuggestDojo()).toBe(false);

    localStorage.clear();
    recordDojoRoomSkipped('lanternWalk');
    expect(shouldSuggestDojo()).toBe(false);
  });

  it('does not suggest the dojo to a player who has started a match before', () => {
    localStorage.setItem('gameSetup', JSON.stringify({ mode: 'solo', stageId: 'hiddenLeaf' }));
    expect(shouldSuggestDojo()).toBe(false);
  });
});
