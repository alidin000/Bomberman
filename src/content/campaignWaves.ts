import { StageId } from './types';
import { EnemyArchetype } from './enemies';
import { CampaignEventId } from './campaignEvents';

// Scripted enemy waves for each village's defense objective. The engine
// (src/engine/campaignWaves.ts) reads these tables; nothing here is code.
//
// Every number that differs by difficulty is a [Story, Normal, Hard] tuple,
// so one row shows the whole curve. A unit count of 0 drops that group on
// that difficulty, and a wave left with no units is skipped there.
//
// Entry points are cells on the 35x35 maps, 7 to 12 open steps from the
// structure (campaignWaves.test.ts walks every map to keep it so). For the
// 50x50 maps, remap `entries` and the structure; the waves name entries by
// id only.

export type DifficultyTuple<T> = readonly [story: T, normal: T, hard: T];

export interface CampaignWaveEntryDefinition {
  id: string;
  // A short place name for the HUD and captions (original words).
  label: string;
  x: number;
  y: number;
}

export interface CampaignWaveGroupDefinition {
  archetype: EnemyArchetype;
  count: DifficultyTuple<number>;
  // One of these entries is drawn per match from the match seed.
  entries: readonly string[];
}

export interface CampaignWaveEliteDefinition {
  archetype: EnemyArchetype;
  // An original title for the wave's captain.
  label: string;
  entries: readonly string[];
  // Story leaves the captain out by default.
  on?: DifficultyTuple<boolean>;
}

export interface CampaignWaveDefinition {
  id: string;
  label: string;
  // Quiet time before this wave arrives: from the start of the defense for
  // the first wave, from the previous wave's arrival after that.
  breatherMs: DifficultyTuple<number>;
  groups: readonly CampaignWaveGroupDefinition[];
  elite?: CampaignWaveEliteDefinition;
}

/**
 * A village event that changes the waves while it is active:
 * `telegraphBonusMs` gives longer warning when the event cuts sight, and
 * `extra` adds groups to one wave (by index).
 */
export interface CampaignWaveEventEffect {
  event: CampaignEventId;
  // Shown on the HUD wave line between marks: 38 characters at most.
  note: string;
  telegraphBonusMs?: number;
  extra?: readonly { wave: number; group: CampaignWaveGroupDefinition }[];
}

export interface CampaignWaveScriptDefinition {
  id: string;
  stageId: StageId;
  entries: readonly CampaignWaveEntryDefinition[];
  waves: readonly CampaignWaveDefinition[];
  // Spawn points are marked this long before a wave arrives.
  telegraphMs: DifficultyTuple<number>;
  // After the last wave arrives, the seal needs this long to finish.
  finalHoldMs: DifficultyTuple<number>;
  // At most this many wave enemies are alive at once: a wave that would go
  // over the cap waits until enough of the last ones are down.
  maxActive: DifficultyTuple<number>;
  // Wave enemies with no player in sight walk back within this many cells
  // of the structure (the mini boss leash), so a wave assaults the seal.
  leashRadius: number;
  // The seal holds this much damage while the waves come.
  structureHp: DifficultyTuple<number>;
  eventEffects?: readonly CampaignWaveEventEffect[];
}

const OPENING: DifficultyTuple<number> = [11000, 9000, 9000];
const BREATHER: DifficultyTuple<number> = [13000, 11000, 11000];
const TELEGRAPH: DifficultyTuple<number> = [4000, 3000, 3000];
const FINAL_HOLD: DifficultyTuple<number> = [10000, 10000, 9000];
const CAP: DifficultyTuple<number> = [3, 3, 3];
const ELITE_ON: DifficultyTuple<boolean> = [false, true, true];
const LEASH_RADIUS = 2;
const STRUCTURE_HP: DifficultyTuple<number> = [300, 300, 300];

// Sight-cutting events (sandstorm, fog) show the marks a second earlier.
const VISION_EVENT_BONUS_MS = 1000;

export const CAMPAIGN_WAVE_SCRIPTS: readonly CampaignWaveScriptDefinition[] = [
  {
    id: 'hiddenLeafWaves',
    stageId: 'hiddenLeaf',
    entries: [
      {
        id: 'north', label: 'Academy Road', x: 17, y: 8
      },
      {
        id: 'east', label: 'Market Lane', x: 25, y: 17
      },
      {
        id: 'south', label: 'Training Yard', x: 18, y: 20
      },
      {
        id: 'west', label: 'Old Well Alley', x: 13, y: 19
      },
    ],
    // The first village teaches the loop: three small waves, no chasers.
    waves: [
      {
        id: 'scouts',
        label: 'Scouts',
        breatherMs: OPENING,
        groups: [{ archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north', 'east'] }],
      },
      {
        id: 'pincer',
        label: 'Pincer',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'rogueGenin', count: [1, 1, 1], entries: ['east'] },
          { archetype: 'mistNinja', count: [1, 1, 1], entries: ['south', 'west'] },
        ],
      },
      {
        id: 'gateBreakers',
        label: 'Gate breakers',
        breatherMs: BREATHER,
        groups: [{ archetype: 'rogueGenin', count: [1, 1, 1], entries: ['west', 'north'] }],
        elite: {
          archetype: 'rogueGenin', label: 'Gate Breaker', entries: ['east'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'nineTailsAlert',
      note: 'Alert bells: a straggler joins wave 3',
      extra: [{ wave: 2, group: { archetype: 'whiteZetsu', count: [0, 1, 1], entries: ['south'] } }],
    }],
  },
  {
    id: 'hiddenSandWaves',
    stageId: 'hiddenSand',
    entries: [
      {
        id: 'north', label: 'Dune Road', x: 17, y: 7
      },
      {
        id: 'east', label: 'Bazaar Lane', x: 24, y: 17
      },
      {
        id: 'south', label: 'Cistern Yard', x: 19, y: 19
      },
      {
        id: 'west', label: 'Wind Gap', x: 14, y: 14
      },
    ],
    waves: [
      {
        id: 'duneScouts',
        label: 'Dune scouts',
        breatherMs: OPENING,
        groups: [{ archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north', 'east'] }],
      },
      {
        id: 'spikeLine',
        label: 'Spike line',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'sandNinja', count: [1, 1, 1], entries: ['east'] },
          { archetype: 'rogueGenin', count: [0, 1, 1], entries: ['south'] },
        ],
      },
      {
        id: 'stormRiders',
        label: 'Storm riders',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'whiteZetsu', count: [1, 1, 1], entries: ['west'] },
          { archetype: 'sandNinja', count: [1, 1, 1], entries: ['north', 'east'] },
        ],
        elite: {
          archetype: 'sandNinja', label: 'Dune Captain', entries: ['south'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'sandstorm',
      note: 'Sandstorm: marks show 1 s early',
      telegraphBonusMs: VISION_EVENT_BONUS_MS,
    }],
  },
  {
    id: 'hiddenMistWaves',
    stageId: 'hiddenMist',
    entries: [
      {
        id: 'north', label: 'Fog Bridge', x: 17, y: 8
      },
      {
        id: 'east', label: 'Canal Walk', x: 24, y: 17
      },
      {
        id: 'south', label: 'Dock Steps', x: 19, y: 19
      },
      {
        id: 'west', label: 'Reed Path', x: 13, y: 13
      },
    ],
    waves: [
      {
        id: 'mistScreen',
        label: 'Mist screen',
        breatherMs: OPENING,
        groups: [
          { archetype: 'mistNinja', count: [1, 1, 1], entries: ['west'] },
          { archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north'] },
        ],
      },
      {
        id: 'canalRush',
        label: 'Canal rush',
        breatherMs: BREATHER,
        groups: [{ archetype: 'rogueGenin', count: [1, 2, 2], entries: ['east'] }],
      },
      {
        id: 'drowned',
        label: 'Drowned patrol',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'whiteZetsu', count: [1, 2, 2], entries: ['south', 'west'] },
          { archetype: 'mistNinja', count: [0, 1, 1], entries: ['north'] },
        ],
      },
      {
        id: 'hunters',
        label: 'Hunters',
        breatherMs: BREATHER,
        groups: [{ archetype: 'anbu', count: [1, 1, 1], entries: ['east'] }],
        elite: {
          archetype: 'mistNinja', label: 'Fog Warden', entries: ['north'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'denseFog',
      note: 'Dense Fog: marks show 1 s early',
      telegraphBonusMs: VISION_EVENT_BONUS_MS,
    }],
  },
  {
    id: 'hiddenCloudWaves',
    stageId: 'hiddenCloud',
    entries: [
      {
        id: 'north', label: 'Cliff Stair', x: 17, y: 8
      },
      {
        id: 'east', label: 'Thunder Walk', x: 24, y: 16
      },
      {
        id: 'farEast', label: 'Storm Ledge', x: 28, y: 17
      },
    ],
    waves: [
      {
        id: 'ridgeScouts',
        label: 'Ridge scouts',
        breatherMs: OPENING,
        groups: [{ archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north'] }],
      },
      {
        id: 'boltLine',
        label: 'Bolt line',
        breatherMs: BREATHER,
        groups: [{ archetype: 'cloudNinja', count: [1, 1, 1], entries: ['east', 'farEast'] }],
      },
      {
        id: 'cloudburst',
        label: 'Cloudburst',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'whiteZetsu', count: [1, 1, 1], entries: ['farEast'] },
          { archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north'] },
        ],
      },
      {
        id: 'thunderhead',
        label: 'Thunderhead',
        breatherMs: BREATHER,
        groups: [{ archetype: 'cloudNinja', count: [1, 1, 1], entries: ['east', 'north'] }],
        elite: {
          archetype: 'cloudNinja', label: 'Storm Herald', entries: ['farEast'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'lightningStorm',
      note: 'Storm surge: +1 Cloud Ninja in wave 3',
      extra: [{ wave: 2, group: { archetype: 'cloudNinja', count: [0, 1, 1], entries: ['east'] } }],
    }],
  },
  {
    id: 'hiddenStoneWaves',
    stageId: 'hiddenStone',
    entries: [
      {
        id: 'north', label: 'Quarry Road', x: 17, y: 9
      },
      {
        id: 'east', label: 'Boulder Lane', x: 23, y: 16
      },
      {
        id: 'west', label: 'Slate Pass', x: 13, y: 16
      },
    ],
    waves: [
      {
        id: 'quarryScouts',
        label: 'Quarry scouts',
        breatherMs: OPENING,
        groups: [{ archetype: 'rogueGenin', count: [1, 2, 2], entries: ['north', 'west'] }],
      },
      {
        id: 'sandSappers',
        label: 'Sappers',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'sandNinja', count: [1, 1, 1], entries: ['east'] },
          { archetype: 'whiteZetsu', count: [0, 1, 1], entries: ['west'] },
        ],
      },
      {
        id: 'stormCrew',
        label: 'Storm crew',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'cloudNinja', count: [1, 1, 1], entries: ['north'] },
          { archetype: 'rogueGenin', count: [1, 1, 1], entries: ['east'] },
        ],
      },
      {
        id: 'breach',
        label: 'Breach',
        breatherMs: BREATHER,
        groups: [{ archetype: 'anbu', count: [1, 1, 1], entries: ['west'] }],
        elite: {
          archetype: 'sandNinja', label: 'Slate Sentinel', entries: ['north'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
  },
  {
    id: 'akatsukiHideoutWaves',
    stageId: 'akatsukiHideout',
    entries: [
      {
        id: 'north', label: 'Upper Tunnel', x: 17, y: 9
      },
      {
        id: 'east', label: 'Ritual Hall', x: 24, y: 16
      },
      {
        id: 'west', label: 'Cistern Passage', x: 13, y: 16
      },
    ],
    waves: [
      {
        id: 'burrowers',
        label: 'Burrowers',
        breatherMs: OPENING,
        groups: [{ archetype: 'whiteZetsu', count: [1, 2, 2], entries: ['north'] }],
      },
      {
        id: 'crossfire',
        label: 'Crossfire',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'anbu', count: [1, 1, 1], entries: ['east'] },
          { archetype: 'mistNinja', count: [1, 1, 1], entries: ['west'] },
        ],
      },
      {
        id: 'chanters',
        label: 'Chanters',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'whiteZetsu', count: [1, 2, 2], entries: ['west', 'east'] },
          { archetype: 'cloudNinja', count: [0, 1, 1], entries: ['north'] },
        ],
      },
      {
        id: 'hollow',
        label: 'Hollow guard',
        breatherMs: BREATHER,
        groups: [{ archetype: 'anbu', count: [1, 1, 1], entries: ['north'] }],
        elite: {
          archetype: 'blackZetsu', label: 'Hollow Warden', entries: ['east'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'akatsukiAmbush',
      note: 'Ambush: a burrower joins wave 2',
      extra: [{ wave: 1, group: { archetype: 'whiteZetsu', count: [0, 1, 1], entries: ['north'] } }],
    }],
  },
  {
    id: 'greatShinobiWarWaves',
    stageId: 'greatShinobiWar',
    entries: [
      {
        id: 'north', label: 'Ridge Line', x: 17, y: 9
      },
      {
        id: 'east', label: 'Supply Road', x: 24, y: 16
      },
      {
        id: 'south', label: 'Crater Field', x: 21, y: 20
      },
    ],
    waves: [
      {
        id: 'skirmishers',
        label: 'Skirmishers',
        breatherMs: OPENING,
        groups: [{ archetype: 'rogueGenin', count: [1, 1, 1], entries: ['north', 'east'] }],
      },
      {
        id: 'boltSquad',
        label: 'Bolt squad',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'cloudNinja', count: [1, 1, 1], entries: ['east'] },
          { archetype: 'whiteZetsu', count: [1, 1, 1], entries: ['south'] },
        ],
      },
      {
        id: 'shadowLine',
        label: 'Shadow line',
        breatherMs: BREATHER,
        groups: [
          { archetype: 'blackZetsu', count: [0, 1, 1], entries: ['east'] },
          { archetype: 'sandNinja', count: [1, 1, 1], entries: ['north', 'south'] },
        ],
      },
      {
        id: 'lastPush',
        label: 'Last push',
        breatherMs: BREATHER,
        groups: [{ archetype: 'whiteZetsu', count: [1, 1, 1], entries: ['south', 'east'] }],
        elite: {
          archetype: 'anbu', label: 'Vanguard Marshal', entries: ['north'], on: ELITE_ON,
        },
      },
    ],
    telegraphMs: TELEGRAPH,
    finalHoldMs: FINAL_HOLD,
    maxActive: CAP,
    leashRadius: LEASH_RADIUS,
    structureHp: STRUCTURE_HP,
    eventEffects: [{
      event: 'warfrontSurge',
      note: 'Warfront Surge: +1 squad in wave 4',
      extra: [{ wave: 3, group: { archetype: 'rogueGenin', count: [0, 1, 1], entries: ['east'] } }],
    }],
  },
];

export function getCampaignWaveScript(
  stageId?: StageId
): CampaignWaveScriptDefinition | null {
  return CAMPAIGN_WAVE_SCRIPTS.find((script) => script.stageId === stageId) ?? null;
}
