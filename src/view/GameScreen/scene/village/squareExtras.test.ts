import { CAMPAIGN_STAGE_LAYOUTS } from '../../../../content/campaignLayouts';
import { getHubVillage } from '../../../../content/hubVillages';
import { STAGE_DEFINITIONS } from '../../../../content/stages';
import { presentInteractables } from '../../../../content/villageSquare';
import {
  EXTRA_SLIP_RANGE, EXTRA_YIELD_RANGE, ExtraPlayer, ExtraState, createExtraState, extraRoute,
  squareExtras, stepExtra,
} from './squareExtras';

// The square's walking extras are render only: these pin how they share the
// square with players (step aside within a cell, slip away if walked into,
// come back after), that their routes keep off every blocked cell, and how
// many walk at each repair stage.

const { square } = CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf;
const blocked = new Set([
  '4,4', '7,4',
  ...presentInteractables(square, 'honored').map((item) => `${item.x},${item.y}`),
]);
const FRAME = 1 / 60;

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => (
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
);

function run(
  state: ExtraState,
  route: ReturnType<typeof extraRoute>,
  players: ExtraPlayer[],
  seconds: number,
  still = false,
  check: ((extra: ExtraState) => void) | null = null
) {
  for (let t = 0; t < seconds; t += FRAME) {
    stepExtra(state, route, square, blocked, players, FRAME, still);
    if (check) check(state);
  }
}

function insideOpenSquare(extra: ExtraState): boolean {
  const {
    x0, y0, x1, y1,
  } = square.bounds;
  return extra.x >= x0 - 0.2 && extra.x <= x1 + 0.2 && extra.y >= y0 - 0.2 && extra.y <= y1 + 0.2
    && !blocked.has(`${Math.round(extra.x)},${Math.round(extra.y)}`);
}

describe('square extras', () => {
  it('walks more people as the village rebuilds, its own people first', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const own = getHubVillage(stage.id).extras.map((extra) => extra.id);
      // The canon people who stand and talk never walk as extras.
      getHubVillage(stage.id).npcs.forEach((npc) => expect(own).not.toContain(npc.id));
      expect([0, 1, 2, 3].map((repair) => squareExtras(stage.id, repair as 0).length))
        .toEqual([1, 1, 2, 3]);
      expect(squareExtras(stage.id, 3).slice(0, own.length)).toEqual(own);
      // Anyone already standing in the square as an interactable is not doubled.
      const walking = squareExtras(stage.id, 3, [own[0]]);
      expect(walking).not.toContain(own[0]);
      expect(walking).toHaveLength(3);
      expect(new Set(walking).size).toBe(3);
    });
  });

  it('walks its routes inside the square and off every blocked cell', () => {
    [0, 1, 2].forEach((index) => {
      const route = extraRoute(square, index);
      const extra = createExtraState(route, index);
      const visited = new Set<string>();
      run(extra, route, [], 60, false, (state) => {
        expect(insideOpenSquare(state)).toBe(true);
        visited.add(`${Math.round(state.x)},${Math.round(state.y)}`);
      });
      // It really walks: a loop covers many cells.
      expect(visited.size).toBeGreaterThan(6);
    });
  });

  it('steps aside from a player who comes within a cell, and looks at them', () => {
    const route = extraRoute(square, 0);
    const extra = createExtraState(route, 0);
    extra.wait = 10;
    // The player walks up to within a cell (diagonals count) and stops there.
    const player = { x: extra.x + 0.9, y: extra.y + 0.5, alive: true };
    const start = { x: extra.x, y: extra.y };
    run(extra, route, [player], 0.6, false, (state) => expect(insideOpenSquare(state)).toBe(true));
    expect(chebyshev(extra, player)).toBeGreaterThan(EXTRA_YIELD_RANGE - 0.05);
    expect(chebyshev(extra, start)).toBeGreaterThan(0.1);
    expect(extra.hidden).toBe(false);
    // Turned toward the player (who stands south-east of where it started).
    expect(Math.sin(extra.heading)).toBeGreaterThan(0.5);
  });

  it('slips away when a player walks right into it, and comes back once they leave', () => {
    const route = extraRoute(square, 1);
    const extra = createExtraState(route, 1);
    const player = { x: extra.x + 0.3, y: extra.y, alive: true };
    run(extra, route, [player], 0.3);
    expect(extra.hidden).toBe(true);
    expect(extra.shown).toBe(0);
    expect(chebyshev(extra, player)).toBeLessThan(EXTRA_SLIP_RANGE);

    // Still hidden while the player stands by its way back in...
    const back = route[extra.next];
    player.x = back.x;
    player.y = back.y;
    run(extra, route, [player], 1);
    expect(extra.hidden).toBe(true);
    // ...and back at a waypoint once the player is gone.
    player.alive = false;
    run(extra, route, [player], 0.5);
    expect(extra.hidden).toBe(false);
    expect(extra.shown).toBe(1);
    expect(route.some((cell) => cell.x === extra.x && cell.y === extra.y)).toBe(true);
  });

  it('never walks or eases under reduced motion, but still gets out of the way', () => {
    const route = extraRoute(square, 2);
    const extra = createExtraState(route, 2);
    const start = { x: extra.x, y: extra.y };
    run(extra, route, [], 10, true);
    expect({ x: extra.x, y: extra.y }).toEqual(start);
    const player = { x: start.x + 0.2, y: start.y, alive: true };
    run(extra, route, [player], FRAME * 2, true);
    expect(extra.shown).toBe(0);
  });

  it('waits for the extra ahead instead of walking into them', () => {
    const route = extraRoute(square, 0);
    const lead = createExtraState(route, 0);
    lead.wait = 100;
    const follower = createExtraState(route, 0);
    follower.x = lead.x - 0.7;
    follower.y = lead.y;
    follower.next = 1;
    follower.wait = 0;
    const crowd = [lead, follower];
    for (let t = 0; t < 3; t += FRAME) {
      stepExtra(follower, route, square, blocked, [], FRAME, false, crowd, 1);
    }
    expect(Math.hypot(follower.x - lead.x, follower.y - lead.y)).toBeGreaterThan(0.6);
  });
});
