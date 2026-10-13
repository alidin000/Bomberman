import { CAMPAIGN_STAGE_LAYOUTS, CampaignCell } from './campaignLayouts';
import { getCampaignMission } from './campaignMissions';
import { STAGE_DEFINITIONS } from './stages';
import type { CharacterId } from './types';
import { loadCampaignMapRows, parseMapRows } from '../engine/mapLoader';
import { createInitialState } from '../engine/initialState';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = ({ x, y }: CampaignCell) => `${x},${y}`;

// Cells reachable from `from`, walking any cell `passable` allows.
function reach(rows: string[][], from: CampaignCell, passable: (cell: string) => boolean) {
  const seen = new Set([key(from)]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head];
    STEPS.forEach(([dx, dy]) => {
      const next = { x: x + dx, y: y + dy };
      const cell = rows[next.y]?.[next.x];
      if (cell !== undefined && passable(cell) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    });
  }
  return seen;
}

// The longest straight run of floor with walls (or shut gates) on both sides.
function longestCorridor(rows: string[][]): number {
  const solid = (cell?: string) => cell === 'W' || cell === 'G';
  let best = 0;
  const size = rows.length;
  for (let y = 1; y < size - 1; y += 1) {
    let run = 0;
    for (let x = 1; x < size - 1; x += 1) {
      run = !solid(rows[y][x]) && solid(rows[y - 1][x]) && solid(rows[y + 1][x]) ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  for (let x = 1; x < size - 1; x += 1) {
    let run = 0;
    for (let y = 1; y < size - 1; y += 1) {
      run = !solid(rows[y][x]) && solid(rows[y][x - 1]) && solid(rows[y][x + 1]) ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return best;
}

function cellsOf(rect: { x: number; y: number; width: number; height: number }): CampaignCell[] {
  return Array.from({ length: rect.width * rect.height }, (_, index) => ({
    x: rect.x + (index % rect.width),
    y: rect.y + Math.floor(index / rect.width),
  }));
}

const BIG_STAGES = STAGE_DEFINITIONS
  .filter((stage) => CAMPAIGN_STAGE_LAYOUTS[stage.id].size === 50);

describe('campaign stage layouts', () => {
  describe.each(BIG_STAGES.map((stage) => stage.id))('%s (50x50)', (stageId) => {
    const stage = STAGE_DEFINITIONS.find((item) => item.id === stageId)!;
    const rows = loadCampaignMapRows(stage.mapId);
    const layout = CAMPAIGN_STAGE_LAYOUTS[stageId];
    const mission = getCampaignMission(stageId)!;
    const start = layout.playerSpawns[0];
    const rooms = Object.values(layout.secrets).map((secret) => secret.room!);

    it('stands every authored place on open floor', () => {
      expect(rows).toHaveLength(layout.size);
      const floor = (label: string, cell: CampaignCell) => (
        expect({ label, cell: rows[cell.y]?.[cell.x] }).toEqual({ label, cell: ' ' })
      );
      layout.playerSpawns.forEach((cell, index) => floor(`spawn ${index + 1}`, cell));
      layout.rescueTargets.forEach((cell, index) => floor(`rescue ${index + 1}`, cell));
      floor('structure', layout.structure);
      floor('mini boss gate', layout.miniBossGate);
      Object.entries(layout.spawnPoints).forEach(([label, cell]) => floor(label, cell));
      floor('boss arena', layout.bossArena);
      Object.entries(layout.secrets).forEach(([label, cell]) => floor(label, cell));
    });

    it('reaches every floor, crate and secret door from the entrance once the arena opens', () => {
      // Crates and cracked walls can be blasted; hidden passages are floor.
      const reachable = reach(rows, start, (cell) => cell !== 'W');
      const unreachable = rows.flatMap((row, y) => row.flatMap((cell, x) => (
        cell !== 'W' && !reachable.has(`${x},${y}`) ? [`${x},${y}`] : []
      )));
      expect(unreachable).toEqual([]);
    });

    it('builds the boss arena as a walled region that only its gates open', () => {
      const { bounds, gates } = layout.bossArena;
      expect(bounds).toBeDefined();
      const arena = cellsOf(bounds!);
      expect(arena.map(key)).toContain(key(layout.bossArena));
      // The map marks exactly the listed gates.
      const marked = rows.flatMap((row, y) => row.flatMap((cell, x) => (
        cell === 'G' ? [`${x},${y}`] : []
      )));
      expect(marked.sort()).toEqual(gates!.map(key).sort());
      const shut = reach(rows, start, (cell) => !'WGCH'.includes(cell));
      expect(arena.filter((cell) => shut.has(key(cell)))).toEqual([]);
      // Every gate opens onto the arena floor from the outside.
      gates!.forEach((gate) => {
        const sides = STEPS.map(([dx, dy]) => ({ x: gate.x + dx, y: gate.y + dy }));
        expect(sides.some((cell) => arena.some((inside) => key(inside) === key(cell)))).toBe(true);
        expect(sides.some((cell) => shut.has(key(cell)))).toBe(true);
      });
      // The mini boss gate stands outside the arena, on the way in.
      expect(arena.map(key)).not.toContain(key(layout.miniBossGate));
      expect(shut.has(key(layout.miniBossGate))).toBe(true);
      expect(mission.bossArena).toMatchObject({ x: layout.bossArena.x, y: layout.bossArena.y });
    });

    it('walls each secret room in, with one marked way in that matches its entry', () => {
      const shut = reach(rows, start, (cell) => !'WGCH'.includes(cell));
      const doorMarks = rows.flatMap((row, y) => row.flatMap((cell, x) => (
        cell === 'C' || cell === 'H' ? [`${x},${y}`] : []
      )));
      expect(doorMarks.sort()).toEqual(rooms.map((room) => key(room.door)).sort());
      rooms.forEach((room) => {
        const floor = cellsOf(room);
        expect(floor.filter((cell) => shut.has(key(cell)))).toEqual([]);
        floor.forEach((cell) => expect(rows[cell.y][cell.x]).toBe(' '));
        expect(rows[room.door.y][room.door.x]).toBe(room.entry === 'crackedWall' ? 'C' : 'H');
        // The door touches the room floor on one side and the open map on another.
        const sides = STEPS.map(([dx, dy]) => ({ x: room.door.x + dx, y: room.door.y + dy }));
        expect(sides.some((cell) => floor.some((inside) => key(inside) === key(cell)))).toBe(true);
        expect(sides.some((cell) => shut.has(key(cell)))).toBe(true);
      });
      // The three secrets live in their rooms, and both ways in are used.
      mission.hiddenAreas.forEach((area) => {
        expect(area.room).toBeDefined();
        expect(cellsOf(area.room!).map(key)).toContain(key(area));
      });
      expect(new Set(rooms.map((room) => room.entry)))
        .toEqual(new Set(['crackedWall', 'hiddenPassage']));
    });

    it('has no long single-file corridor', () => {
      expect(longestCorridor(rows)).toBeLessThanOrEqual(5);
    });

    it('gives every spawn an escape and keeps enemy burrows away from the start', () => {
      layout.playerSpawns.forEach((spawn) => {
        // Open floor within four steps that a bomb on the spawn (range 3)
        // cannot reach in a straight line.
        const near = [...reach(rows, spawn, (cell) => cell === ' ')]
          .map((cellKey) => cellKey.split(',').map(Number))
          .filter(([x, y]) => Math.abs(x - spawn.x) + Math.abs(y - spawn.y) <= 4);
        expect(near.some(([x, y]) => x !== spawn.x && y !== spawn.y)).toBe(true);
        Object.values(layout.spawnPoints).forEach((burrow) => {
          const distance = Math.abs(burrow.x - spawn.x) + Math.abs(burrow.y - spawn.y);
          expect(distance).toBeGreaterThanOrEqual(10);
        });
      });
      // Co-op seats start apart, all inside the entrance district.
      expect(new Set(layout.playerSpawns.map(key)).size).toBe(4);
    });

    it.each([1, 2, 3, 4])('starts %i co-op players on the village spawns, clear of crates', (numPlayers) => {
      const state = createInitialState({
        mode: 'solo',
        numPlayers,
        totalRounds: 1,
        selectedMap: stage.mapId,
        stageId,
        map: parseMapRows(rows),
        selectedCharacters: (['naruto', 'sasuke', 'gaara', 'minato'] as CharacterId[])
          .slice(0, numPlayers),
        seed: 9,
      });
      expect(state.players.map(({ x, y }) => ({ x, y })))
        .toEqual(layout.playerSpawns.slice(0, numPlayers));
      state.players.forEach((player) => {
        expect(state.map[player.y][player.x]).toBe('Empty');
        // No enemy starts within sight of a seat.
        state.monsters.forEach((monster) => {
          expect(Math.abs(monster.x - player.x) + Math.abs(monster.y - player.y))
            .toBeGreaterThan(6);
        });
      });
    });
  });
});
