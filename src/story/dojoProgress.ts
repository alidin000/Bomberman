import { DOJO_ROOMS, DojoRoomId } from '../content/dojo';

// Training Dojo progress, saved apart from the campaign save: which rooms
// were cleared or skipped, and whether the title screen already suggested
// the dojo. Every read and write tolerates missing or blocked storage.

const DOJO_PROGRESS_KEY = 'shinobiDojoProgress';
const DOJO_SUGGESTION_KEY = 'shinobiDojoSuggested';
const DOJO_PROGRESS_VERSION = 1;

export interface DojoProgress {
  cleared: DojoRoomId[];
  skipped: DojoRoomId[];
}

const EMPTY_PROGRESS: DojoProgress = { cleared: [], skipped: [] };

function roomIds(value: unknown): DojoRoomId[] {
  if (!Array.isArray(value)) return [];
  // Room order, no repeats, unknown ids dropped.
  return DOJO_ROOMS.map((room) => room.id).filter((id) => value.some((item) => item === id));
}

export function loadDojoProgress(): DojoProgress {
  try {
    const stored = JSON.parse(localStorage.getItem(DOJO_PROGRESS_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return EMPTY_PROGRESS;
    const cleared = roomIds(stored.cleared);
    return {
      cleared,
      skipped: roomIds(stored.skipped).filter((id) => !cleared.includes(id)),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveDojoProgress(progress: DojoProgress): DojoProgress {
  try {
    localStorage.setItem(DOJO_PROGRESS_KEY, JSON.stringify({
      version: DOJO_PROGRESS_VERSION,
      cleared: progress.cleared,
      skipped: progress.skipped,
    }));
  } catch {
    // Progress still holds for this visit when storage is unavailable.
  }
  return progress;
}

export function recordDojoRoomCleared(id: DojoRoomId): DojoProgress {
  const current = loadDojoProgress();
  return saveDojoProgress({
    cleared: roomIds([...current.cleared, id]),
    skipped: current.skipped.filter((room) => room !== id),
  });
}

/** A skipped room stays open to play later; clearing it drops the skip. */
export function recordDojoRoomSkipped(id: DojoRoomId): DojoProgress {
  const current = loadDojoProgress();
  if (current.cleared.includes(id)) return current;
  return saveDojoProgress({
    cleared: current.cleared,
    skipped: roomIds([...current.skipped, id]),
  });
}

/** Where "Continue" goes: the first room neither cleared nor skipped. */
export function nextDojoRoomId(progress: DojoProgress): DojoRoomId | null {
  const room = DOJO_ROOMS.find(({ id }) => (
    !progress.cleared.includes(id) && !progress.skipped.includes(id)
  ));
  return room?.id ?? null;
}

export function dojoStarted(progress: DojoProgress): boolean {
  return progress.cleared.length > 0 || progress.skipped.length > 0;
}

export function dojoRoomStatus(
  progress: DojoProgress,
  id: DojoRoomId
): 'cleared' | 'skipped' | 'new' {
  if (progress.cleared.includes(id)) return 'cleared';
  if (progress.skipped.includes(id)) return 'skipped';
  return 'new';
}

// Written by every match launch (ConfigScreen/launchGame): a player who has
// one has played before.
const LAST_SETUP_KEY = 'gameSetup';

/**
 * The title screen suggests the dojo once, on a first visit: no match ever
 * started, no dojo room played, and not suggested before.
 */
export function shouldSuggestDojo(): boolean {
  try {
    if (localStorage.getItem(DOJO_SUGGESTION_KEY) === 'true') return false;
    if (localStorage.getItem(LAST_SETUP_KEY) !== null) return false;
  } catch {
    return false;
  }
  return !dojoStarted(loadDojoProgress());
}

export function markDojoSuggested(): void {
  try {
    localStorage.setItem(DOJO_SUGGESTION_KEY, 'true');
  } catch {
    // Without storage the suggestion may show again next visit; harmless.
  }
}
