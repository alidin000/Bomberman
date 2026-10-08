import { BombState, GameEngineState, TICK_MS } from '../../../engine';
import { parseMapRows } from '../../../engine/mapLoader';
import {
  FUSE_RING_MIN_RADIUS,
  FUSE_URGENT_MS,
  blastPreviewCells,
  bombDetonationTimes,
  countdownNow,
  createCountdown,
  fuseRingRadius,
} from './bombFuse';

// 9 x 5 open room with one pillar at (4, 1).
const MAP = parseMapRows([
  'WWWWWWWWW',
  'W   W   W',
  'W       W',
  'W       W',
  'WWWWWWWWW',
].map((row) => row.split('')));

function bomb(
  id: string,
  x: number,
  y: number,
  ticksRemaining: number,
  extra: Partial<BombState> = {}
): BombState {
  return {
    id,
    ownerId: 'player1',
    x,
    y,
    range: 2,
    ticksRemaining,
    manualDetonation: false,
    kind: 'standard',
    ...extra,
  };
}

const PLAYERS = [{ id: 'player1', alive: true }, { id: 'player2', alive: true }] as GameEngineState['players'];
const everywhere = () => true;

function preview(bombs: BombState[], visible: (x: number, y: number) => boolean = everywhere) {
  return blastPreviewCells(bombs, MAP, bombDetonationTimes(bombs, MAP, PLAYERS), visible);
}

describe('bombDetonationTimes', () => {
  it('sets off a bomb inside an earlier blast at that blast time, down the chain', () => {
    const bombs = [
      bomb('early', 1, 2, 400),
      bomb('chained', 3, 2, 2900), // in early's row, two cells away
      bomb('second-link', 5, 2, 2950), // only in chained's reach
      bomb('apart', 7, 3, 2000), // three cells from second-link: out of range 2
    ];
    const times = bombDetonationTimes(bombs, MAP, PLAYERS);
    expect(times.get('chained')).toBe(400);
    expect(times.get('second-link')).toBe(400);
    expect(times.get('apart')).toBe(2000);
  });

  it('gives a held remote bomb no countdown until another blast reaches it', () => {
    const remote = bomb('remote', 2, 3, 3000, { manualDetonation: true });
    expect(bombDetonationTimes([remote], MAP, PLAYERS).get('remote')).toBe(Infinity);
    const withFuse = bombDetonationTimes([remote, bomb('fuse', 2, 1, 700)], MAP, PLAYERS);
    expect(withFuse.get('remote')).toBe(700);
    // Its owner fell: the engine burns its normal fuse.
    const ownerDown = PLAYERS.map((p) => (p.id === 'player1' ? { ...p, alive: false } : p));
    expect(bombDetonationTimes([remote], MAP, ownerDown).get('remote')).toBe(3000);
  });
});

describe('blastPreviewCells', () => {
  it('shows a fresh bomb\'s reach for the whole fuse and marks it imminent near the end', () => {
    const fresh = [bomb('b', 2, 2, 3000)];
    const early = preview(fresh);
    expect(early.map((c) => `${c.x},${c.y}`).sort()).toEqual(
      ['1,2', '2,1', '2,2', '2,3', '3,2', '4,2']
    );
    expect(early.every((c) => !c.imminent)).toBe(true);

    const late = [bomb('b', 2, 2, FUSE_URGENT_MS)];
    const imminent = preview(late);
    expect(imminent.every((c) => c.imminent)).toBe(true);
  });

  it('marks a long-fuse bomb\'s cells imminent when a chain will set it off now', () => {
    const bombs = [bomb('long', 6, 2, 3000), bomb('short', 4, 2, 300)];
    const cells = preview(bombs);
    // (7, 2) is in the long-fuse bomb's reach only; the short one sets it off.
    const farCell = cells.find((c) => c.x === 7 && c.y === 2);
    expect(farCell?.imminent).toBe(true);
  });

  it('leaves out cells the players cannot see', () => {
    const bombs = [bomb('b', 2, 2, 3000)];
    const cells = preview(bombs, (x) => x <= 2);
    expect(cells.some((c) => c.x > 2)).toBe(false);
  });
});

describe('countdownNow', () => {
  it('keeps running between ticks, at most one tick ahead, and stops with the sim clock', () => {
    const countdown = createCountdown();
    expect(countdownNow(countdown, 1000, 5000)).toBe(1000);
    expect(countdownNow(countdown, 1000, 5020)).toBe(980);
    // The next tick is late (or the game is paused): never run past one tick.
    expect(countdownNow(countdown, 1000, 5200)).toBe(1000 - TICK_MS);
    expect(countdownNow(countdown, 950, 5200)).toBe(950);
  });
});

describe('fuseRingRadius', () => {
  it('shows time left, not fuse fraction: equal time, equal ring', () => {
    expect(fuseRingRadius(1500)).toBeGreaterThan(fuseRingRadius(1000));
    expect(fuseRingRadius(1000)).toBeGreaterThan(fuseRingRadius(200));
    expect(fuseRingRadius(0)).toBe(FUSE_RING_MIN_RADIUS);
    expect(fuseRingRadius(30000)).toBeLessThan(1);
  });
});
