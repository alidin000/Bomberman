import { describe, expect, it } from 'vitest';
import { CAMPAIGN_STAGE_LAYOUTS } from './campaignLayouts';
import { VILLAGE_REQUESTS, getVillageRequest } from './villageRequests';
import { HUB_VILLAGES } from './hubVillages';
import {
  WANDERING_VILLAGER, presentInteractables, reachableInteractable, stallPrice,
} from './villageSquare';
import { repairStageFor, reputationTier, totalReputation } from '../story/reputation';
import { STAGE_DEFINITIONS } from './stages';
import { loadCampaignMapRows } from '../engine/mapLoader';
import type { StageId } from './types';

const stageIds = Object.keys(CAMPAIGN_STAGE_LAYOUTS) as StageId[];
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

describe('village square plan', () => {
  it.each(stageIds)('%s: props stand on open floor, clear of spawns and ways out', (stageId) => {
    const layout = CAMPAIGN_STAGE_LAYOUTS[stageId];
    const stage = STAGE_DEFINITIONS.find((item) => item.id === stageId)!;
    const rows = loadCampaignMapRows(stage.mapId);
    const props = presentInteractables(layout.square, 'honored');
    const blocked = new Set(props.map(({ x, y }) => `${x},${y}`));
    props.forEach(({ x, y }) => expect(rows[y][x], `${stageId} prop ${x},${y}`).toBe(' '));
    layout.playerSpawns.forEach(({ x, y }) => expect(blocked.has(`${x},${y}`)).toBe(false));

    // Walk from the first spawn with every prop standing (the fullest square).
    const seen = new Set(['1,1']);
    const queue = [{ x: 1, y: 1 }];
    for (let head = 0; head < queue.length; head += 1) {
      const { x, y } = queue[head];
      STEPS.forEach(([dx, dy]) => {
        const next = { x: x + dx, y: y + dy };
        const id = `${next.x},${next.y}`;
        if (rows[next.y]?.[next.x] === ' ' && !blocked.has(id) && !seen.has(id)) {
          seen.add(id);
          queue.push(next);
        }
      });
    }
    layout.playerSpawns.forEach(({ x, y }) => expect(seen.has(`${x},${y}`)).toBe(true));
    // The ways out of the entrance district: east at x 11, south at y 9.
    expect([3, 4, 5].some((y) => seen.has(`11,${y}`))).toBe(true);
    expect([5, 6, 7].some((x) => seen.has(`${x},9`))).toBe(true);
  });

  it('names real villagers of the village it stands in', () => {
    stageIds.forEach((stageId) => {
      const village = HUB_VILLAGES.find((entry) => entry.stageId === stageId);
      const people = new Set((village?.npcs ?? []).map((npc) => npc.id));
      people.add(WANDERING_VILLAGER.id);
      CAMPAIGN_STAGE_LAYOUTS[stageId].square.interactables
        .filter((item) => item.kind === 'villager')
        .forEach((item) => expect(people.has(item.villagerId ?? '')).toBe(true));
    });
  });

  it('keeps the wandering villager away until standing reaches Known', () => {
    const { square } = CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf;
    expect(reachableInteractable(square, 8, 2)).toBeNull();
    expect(reachableInteractable(square, 8, 2, 'known')?.id).toBe('villager-wanderer');
  });
});

describe('village requests', () => {
  it('are asked by the village\'s own people and point at real secrets', () => {
    stageIds.forEach((stageId) => {
      const village = HUB_VILLAGES.find((entry) => entry.stageId === stageId);
      const givers = new Set((village?.npcs ?? []).map((npc) => npc.id));
      VILLAGE_REQUESTS[stageId].forEach((request) => {
        expect(givers.has(request.giverId), request.id).toBe(true);
        expect(getVillageRequest(request.id)).toBe(request);
        if (request.kind === 'findSecret') {
          expect(request.secretId?.startsWith(`${stageId}-`)).toBe(true);
        } else if (request.kind !== 'noFall') {
          expect(request.target).toBeGreaterThan(0);
        }
      });
    });
  });
});

describe('standing', () => {
  it('adds every village and reaches each tier at its threshold', () => {
    expect(totalReputation({ hiddenLeaf: 10, hiddenSand: 4 })).toBe(14);
    expect(reputationTier(14).id).toBe('stranger');
    expect(reputationTier(15).id).toBe('known');
    expect(reputationTier(40).id).toBe('trusted');
    expect(reputationTier(80).id).toBe('honored');
  });

  it('knocks a fifth off stall prices from Trusted, in whole fives', () => {
    expect(stallPrice('paperWard', 'known')).toBe(15);
    expect(stallPrice('paperWard', 'trusted')).toBe(10);
    expect(stallPrice('secondWind', 'honored')).toBe(40);
  });
});

describe('village rebuilding', () => {
  it('stays damaged until the first clear, then thrives at 20 and holds a festival at 30', () => {
    expect([0, 9, 10, 19, 20, 29, 30, 99].map(repairStageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});
