import { describe, expect, it } from 'vitest';
import { gameReducer } from './reducer';
import { createBossForConfig } from './initialState';
import { loadCampaignMapRows, parseMapRows } from './mapLoader';
import { createShinobiEnemy } from './campaignEnemies';
import type { GameAction } from './actions';
import type { GameConfig, GameEngineState } from './types';
import { STAGE_DEFINITIONS } from '../content/stages';
import { CAMPAIGN_STAGE_LAYOUTS } from '../content/campaignLayouts';
import { VILLAGE_REQUESTS } from '../content/villageRequests';
import { insideSquare, stallPrice } from '../content/villageSquare';
import type { VillageVisitConfig } from '../content/villageSquare';
import type { CharacterId, StageId } from '../content/types';

// Engine rules of the village square (content/villageSquare.ts). Positions are
// on the shared entrance district: the square is x 1-10, y 1-8, and row 4 is
// open floor from x 8 to 35 on the Leaf campaign map.

function mission(
  stageId: StageId,
  extra: Partial<GameConfig> = {},
  character: CharacterId = 'sasuke'
): GameEngineState {
  const stage = STAGE_DEFINITIONS.find((item) => item.id === stageId)!;
  const state = gameReducer(null, {
    type: 'INIT',
    config: {
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: stage.mapId,
      stageId,
      selectedCharacters: [character, character],
      map: parseMapRows(loadCampaignMapRows(stage.mapId)),
      seed: 7,
      ...extra,
    },
  })!;
  // Start live, with no patrols in the way.
  return { ...state, roundStartTicksRemaining: 0, monsters: [] };
}

function visit(village: Partial<VillageVisitConfig> = {}): { village: VillageVisitConfig } {
  return {
    village: {
      reputationTier: 'stranger', embers: 0, offeredRequestIds: [], ...village,
    },
  };
}

const act = (state: GameEngineState, action: GameAction) => gameReducer(state, action)!;
const tick = (state: GameEngineState, deltaMs = 50) => act(state, { type: 'TICK', deltaMs });

function ticks(state: GameEngineState, count: number): GameEngineState {
  let next = state;
  for (let index = 0; index < count; index += 1) next = tick(next);
  return next;
}

function placePlayer(state: GameEngineState, x: number, y: number, index = 0): GameEngineState {
  return {
    ...state,
    players: state.players.map((player, at) => (at === index ? { ...player, x, y } : player)),
  };
}

function untilBlast(state: GameEngineState): GameEngineState {
  let next = state;
  for (let index = 0; index < 120 && next.explosions.length === 0; index += 1) next = tick(next);
  return next;
}

function moveMany(state: GameEngineState, direction: 'up' | 'down', count: number) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = act(next, { type: 'MOVE', playerId: 'player1', direction });
  }
  return next;
}

const { square } = CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf;
const inSquare = ({ x, y }: { x: number; y: number }) => insideSquare(square, x, y);

describe('village square rules', () => {
  it('never lets a bomb or an ultimate be set inside the square', () => {
    const start = mission('hiddenLeaf');
    expect(inSquare(start.players[0])).toBe(true);
    const bomb = act(start, { type: 'DROP_BOMB', playerId: 'player1' });
    const ultimate = act(start, { type: 'USE_ULTIMATE', playerId: 'player1' });
    expect(bomb.bombs).toHaveLength(0);
    expect(ultimate.bombs).toHaveLength(0);

    // One step past the east way out, the same key drops a bomb.
    const outside = act(placePlayer(start, 11, 4), { type: 'DROP_BOMB', playerId: 'player1' });
    expect(outside.bombs).toHaveLength(1);
  });

  it('stops blasts at the edge, so nobody inside is hurt', () => {
    let state = act(placePlayer(mission('hiddenLeaf'), 12, 4), {
      type: 'DROP_BOMB', playerId: 'player1',
    });
    // Sheltered just inside, close enough for a flame on x 11 to graze them.
    state = untilBlast(placePlayer(state, 10.4, 4));
    expect(state.explosions.some((cell) => cell.x === 11 && cell.y === 4)).toBe(true);
    expect(state.explosions.filter(inSquare)).toEqual([]);
    state = ticks(state, 12);
    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].deathReason).toBeUndefined();
  });

  it('keeps a full-row ultimate out of the square', () => {
    let state = act(placePlayer(mission('hiddenLeaf'), 12, 4), {
      type: 'USE_ULTIMATE', playerId: 'player1',
    });
    state = untilBlast(placePlayer(state, 9, 4));
    // Kirin spans the whole row and column, except the square.
    expect(state.explosions.some((cell) => cell.x === 20 && cell.y === 4)).toBe(true);
    expect(state.explosions.filter(inSquare)).toEqual([]);
    expect(ticks(state, 12).players[0].alive).toBe(true);
  });

  it('keeps enemies out, and they lose track of a player inside', () => {
    const genin = {
      ...createShinobiEnemy({
        archetype: 'rogueGenin', x: 11, y: 4, id: 'genin'
      }),
      detectionRange: 8,
      moveCooldown: 0,
      abilityCooldown: 0,
    };
    let state: GameEngineState = { ...placePlayer(mission('hiddenLeaf'), 9, 4), monsters: [genin] };
    for (let index = 0; index < 120; index += 1) {
      state = tick(state);
      state.monsters.forEach((monster) => expect(inSquare(monster)).toBe(false));
      expect(state.monsters[0]?.abilityTarget ?? null).toBeNull();
    }
    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].health).toBe(3);
  });

  it('stops the boss from aiming at a player inside', () => {
    let state = mission('hiddenLeaf');
    const { bossArena } = state.campaign!;
    const boss = createBossForConfig({ ...state.config, map: state.map }, bossArena)!;
    state = { ...placePlayer(state, 5, 5), boss: { ...boss, attackCooldown: 0 } };
    state = ticks(state, 80);
    expect(state.hazards).toEqual([]);
  });

  it('stands its props like pillars, the wanderer only from Known', () => {
    const stranger = mission('hiddenLeaf');
    // Villager A at 4,1; open floor at 5,1.
    expect(moveMany(placePlayer(stranger, 4, 2), 'up', 15).players[0].y).toBeGreaterThan(1.7);
    expect(moveMany(placePlayer(stranger, 5, 2), 'up', 15).players[0].y).toBeLessThan(1.1);
    // The wanderer's spot, 8,1, is open floor until standing reaches Known.
    expect(moveMany(placePlayer(stranger, 8, 2), 'up', 15).players[0].y).toBeLessThan(1.1);
    const known = mission('hiddenLeaf', visit({ reputationTier: 'known' }));
    expect(moveMany(placePlayer(known, 8, 2), 'up', 15).players[0].y).toBeGreaterThan(1.7);
  });

  it('holds in co-op too, where the stall and board stay closed', () => {
    const coop = mission('hiddenLeaf', {
      numPlayers: 2, ...visit({ embers: 100, offeredRequestIds: ['leaf-tea-tins'] }),
    });
    expect(act(coop, { type: 'DROP_BOMB', playerId: 'player2' }).bombs).toHaveLength(0);
    expect(coop.campaign!.village).toBeUndefined();
    expect(act(coop, { type: 'CAMPAIGN_PURCHASE', playerId: 'player1', itemId: 'fusePouch' }))
      .toBe(coop);
    expect(act(coop, { type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'leaf-tea-tins' }))
      .toBe(coop);
  });
});

describe('the visit (config.village)', () => {
  it('builds campaign.village at INIT from the offered requests', () => {
    const state = mission('hiddenLeaf', visit({
      reputationTier: 'known',
      embers: 40,
      offeredRequestIds: ['leaf-old-logs', 'not-a-request', 'leaf-tea-tins', 'leaf-old-logs', 'sand-raiders'],
    }));
    expect(state.campaign!.village).toEqual({
      requests: [
        {
          id: 'leaf-old-logs', status: 'offered', progress: 0, target: 4,
        },
        {
          id: 'leaf-tea-tins', status: 'offered', progress: 0, target: 3,
        },
      ],
      purchases: [],
      embersSpent: 0,
    });
    expect(mission('hiddenLeaf').campaign!.village).toBeUndefined();
  });
});

function bfsFromSquare(state: GameEngineState): Set<string> {
  const { map } = state.config;
  const seen = new Set(['1,1']);
  const queue = [{ x: 1, y: 1 }];
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const key = `${x + dx},${y + dy}`;
      const cell = map[y + dy]?.[x + dx];
      if (cell !== undefined && cell !== 'Wall' && !seen.has(key)) {
        seen.add(key);
        queue.push({ x: x + dx, y: y + dy });
      }
    });
  }
  return seen;
}

describe('village requests', () => {
  const stages = Object.keys(VILLAGE_REQUESTS) as StageId[];
  const marked = stages.flatMap((stageId) => VILLAGE_REQUESTS[stageId]
    .filter((request) => request.kind === 'collectMarked' || request.kind === 'breakMarked')
    .map((request) => [stageId, request.id, request.kind, request.target] as const));

  it.each(marked)('%s %s marks reachable cells outside the square, from its own seed', (stageId, id, kind, target) => {
    const accept = (seed: number) => {
      const paused = act(mission(stageId, { seed, ...visit({ offeredRequestIds: [id] }) }), { type: 'PAUSE' });
      const next = act(paused, { type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: id });
      // Taken while paused, and the match's own draws are untouched.
      expect(next.rngSeed).toBe(paused.rngSeed);
      return next;
    };
    const state = accept(7);
    const request = state.campaign!.village!.requests[0];
    expect(request.status).toBe('accepted');
    expect(request.cells).toHaveLength(target!);
    const reachable = bfsFromSquare(state);
    const layoutSquare = CAMPAIGN_STAGE_LAYOUTS[stageId].square;
    request.cells!.forEach(({ x, y }) => {
      expect(insideSquare(layoutSquare, x, y)).toBe(false);
      expect(reachable.has(`${x},${y}`)).toBe(true);
      expect(state.map[y][x]).toBe(kind === 'breakMarked' ? 'Box' : 'Empty');
    });
    expect(new Set(request.cells!.map(({ x, y }) => `${x},${y}`)).size).toBe(target);
    // Another match seed marks the same cells.
    expect(accept(99).campaign!.village!.requests[0].cells).toEqual(request.cells);
  });

  it('collects keepsakes by stepping on them', () => {
    let state = act(mission('hiddenLeaf', visit({ offeredRequestIds: ['leaf-tea-tins'] })), {
      type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'leaf-tea-tins',
    });
    const cells = state.campaign!.village!.requests[0].cells!;
    // A tick that changes nothing keeps the same village state (no churn).
    expect(tick(state).campaign!.village).toBe(state.campaign!.village);
    cells.forEach((cell, index) => {
      state = tick(placePlayer(state, cell.x, cell.y));
      const request = state.campaign!.village!.requests[0];
      expect(request.progress).toBe(index + 1);
      expect(request.cells).toHaveLength(cells.length - index - 1);
    });
    expect(state.campaign!.village!.requests[0].status).toBe('complete');
  });

  it('counts marked crates once they are destroyed', () => {
    let state = act(mission('hiddenLeaf', visit({ offeredRequestIds: ['leaf-old-logs'] })), {
      type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'leaf-old-logs',
    });
    const [first, second] = state.campaign!.village!.requests[0].cells!;
    // The first marked crate is blown apart.
    const map = state.map.map((row) => [...row]);
    map[first.y][first.x] = 'Empty';
    state = tick({ ...state, map });
    expect(state.campaign!.village!.requests[0].progress).toBe(1);
    expect(state.campaign!.village!.requests[0].cells).not.toContainEqual(first);
    expect(state.campaign!.village!.requests[0].cells).toContainEqual(second);
  });

  it('completes a secret request on finding the secret, even one found before', () => {
    const offered = visit({ offeredRequestIds: ['sand-cache'] });
    let state = act(mission('hiddenSand', offered), {
      type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'sand-cache',
    });
    expect(state.campaign!.village!.requests[0].status).toBe('accepted');
    const { scroll } = CAMPAIGN_STAGE_LAYOUTS.hiddenSand.secrets;
    state = tick(placePlayer(state, scroll.x, scroll.y));
    expect(state.campaign!.discoveredSecrets).toContain('hiddenSand-scroll-cache');
    expect(state.campaign!.village!.requests[0]).toMatchObject({ status: 'complete', progress: 1 });

    const found = tick(placePlayer(mission('hiddenSand', offered), scroll.x, scroll.y));
    expect(act(found, { type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'sand-cache' })
      .campaign!.village!.requests[0].status).toBe('complete');
  });

  it('counts enemies defeated by a blast', () => {
    let state = act(mission('hiddenSand', visit({ offeredRequestIds: ['sand-raiders'] })), {
      type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'sand-raiders',
    });
    state = act(placePlayer(state, 13, 3), { type: 'DROP_BOMB', playerId: 'player1' });
    const target = {
      ...createShinobiEnemy({
        archetype: 'rogueGenin', x: 14, y: 3, id: 'raider'
      }),
      moveCooldown: 60000,
      abilityCooldown: 60000,
    };
    state = untilBlast({ ...placePlayer(state, 9, 3), monsters: [target] });
    expect(state.monsters).toHaveLength(0);
    expect(state.campaign!.village!.requests[0]).toMatchObject({ status: 'accepted', progress: 1 });
  });

  it('fails a no-fall request on a lost life, and completes it on success', () => {
    const offered = visit({ reputationTier: 'trusted', offeredRequestIds: ['leaf-clean-run'] });
    const accepted = act(mission('hiddenLeaf', offered), {
      type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'leaf-clean-run',
    });
    const fallen = tick(placePlayer({
      ...accepted,
      players: accepted.players.map((player) => ({ ...player, alive: false, deathReason: 'x' })),
    }, 30, 30));
    expect(fallen.players[0].alive).toBe(true);
    expect(fallen.campaign!.village!.requests[0].status).toBe('failed');

    const { bossArena } = accepted.campaign!;
    const boss = createBossForConfig({ ...accepted.config, map: accepted.map }, bossArena)!;
    const won = tick({ ...accepted, boss: { ...boss, health: 0 } });
    expect(won.campaign!.missionResult).toBe('success');
    expect(won.campaign!.village!.requests[0].status).toBe('complete');
    // Playing again from the result: the finished request has left the board.
    const again = act(won, { type: 'DISMISS_DIALOG' });
    expect(again.config.village!.offeredRequestIds).toEqual([]);
    expect(again.campaign!.village!.requests).toEqual([]);
  });
});

describe('the stall (CAMPAIGN_PURCHASE)', () => {
  it('sells each consumable once, counting the pack, within the embers, while paused', () => {
    const start = act(mission('hiddenLeaf', {
      loadout: { consumables: ['paperWard'] }, ...visit({ embers: 40 }),
    }), { type: 'PAUSE' });
    const buy = (state: GameEngineState, itemId: 'fusePouch' | 'paperWard' | 'blastPowder' | 'lodestone') => (
      act(state, { type: 'CAMPAIGN_PURCHASE', playerId: 'player1', itemId })
    );
    const pouch = buy(start, 'fusePouch');
    expect(pouch.players[0].maxBombs).toBe(start.players[0].maxBombs + 1);
    expect(pouch.campaign!.village).toMatchObject({ purchases: ['fusePouch'], embersSpent: 25 });
    expect(buy(pouch, 'fusePouch')).toBe(pouch);
    // Packed in the hub already, and 25 is more than the 15 left.
    expect(buy(pouch, 'paperWard')).toBe(pouch);
    expect(buy(pouch, 'blastPowder')).toBe(pouch);
    const charm = buy(pouch, 'lodestone');
    expect(charm.campaign!.village).toMatchObject({
      purchases: ['fusePouch', 'lodestone'], embersSpent: 40,
    });

    // The charm works at once: a pickup beside the path is pulled in.
    const map = charm.map.map((row) => [...row]);
    map[5][13] = 'AddBomb';
    let moved = placePlayer({ ...act(charm, { type: 'RESUME' }), map }, 12, 4);
    for (let index = 0; index < 10; index += 1) {
      moved = act(moved, { type: 'MOVE', playerId: 'player1', direction: 'right' });
    }
    expect(moved.map[5][13]).toBe('Empty');
    expect(moved.players[0].maxBombs).toBe(charm.players[0].maxBombs + 1);

    // A retry keeps the spend: the next attempt starts with what is left.
    const retry = act(charm, { type: 'RESTART' });
    expect(retry.config.village!.embers).toBe(0);
    expect(retry.campaign!.village).toMatchObject({ purchases: [], embersSpent: 0 });
  });

  it('applies wards and lives at once, at the Trusted price', () => {
    const start = act(mission('hiddenLeaf', visit({ reputationTier: 'trusted', embers: 50 })), {
      type: 'PAUSE',
    });
    const life = act(start, { type: 'CAMPAIGN_PURCHASE', playerId: 'player1', itemId: 'secondWind' });
    expect(life.campaign!.livesRemaining).toBe(start.campaign!.livesRemaining! + 1);
    expect(life.campaign!.livesTotal).toBe(start.campaign!.livesTotal! + 1);
    expect(life.campaign!.village!.embersSpent).toBe(stallPrice('secondWind', 'trusted'));
    const ward = act(life, { type: 'CAMPAIGN_PURCHASE', playerId: 'player1', itemId: 'paperWard' });
    expect(ward.players[0].powerUps).toContain('Invincibility');
    expect(ward.timedPowerUps.player1).toContainEqual(expect.objectContaining({
      power: 'Invincibility', ticksRemaining: 15000,
    }));
    expect(ward.campaign!.village!.embersSpent).toBe(50);
  });
});
