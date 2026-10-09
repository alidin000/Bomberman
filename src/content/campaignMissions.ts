import { StageId } from './types';
import { EnemyArchetype } from './enemies';
import { Power } from '../model/gameItem';
import type { DifficultyId } from '../engine/difficulty';

export type CampaignMissionId = `${StageId}Opening`;

export type CampaignMissionStep =
  | 'exploration'
  | 'rescue'
  | 'defense'
  | 'puzzle'
  | 'miniBoss'
  | 'bossGate'
  | 'boss'
  | 'complete'
  | 'failed';

export type CampaignObjectiveId = string;

export type CampaignObjectiveKind = 'rescue' | 'defense' | 'puzzle' | 'miniBoss';

// Route puzzles: one per village, solved with the ordinary verbs (walk onto
// a piece, blast it, carry it). The rules live in engine/campaignPuzzles.ts.
export type CampaignPuzzleKind =
  // Blast every piece once; lit pieces stay lit.
  | 'kindle'
  // Blast every piece; each one rises again after `windowMs`. All down at once.
  | 'topple'
  // Step on levers; each flips its spans. Raise every span.
  | 'toggle'
  // Step on the pieces in their numbered order.
  | 'sequence'
  // Pick pieces up by walking over them and bring them to the cairn.
  | 'carry'
  // Blast both pieces of a pair within `windowMs` of each other.
  | 'pairs'
  // Step on every piece; each burns for `windowMs`. All lit at once.
  | 'relay';

export type CampaignPuzzleRole =
  | 'lantern'
  | 'pylon'
  | 'lever'
  | 'span'
  | 'shrine'
  | 'keystone'
  | 'cairn'
  | 'ward'
  | 'beacon';

export interface CampaignPuzzleElementDefinition {
  id: string;
  label: string;
  role: CampaignPuzzleRole;
  x: number;
  y: number;
  // Sequence pieces: 1-based order. Pair pieces: which pair (0-based).
  order?: number;
  pair?: number;
  // Levers: the span ids they flip.
  flips?: string[];
}

// Per-difficulty rules. Story gets hints and forgiveness; Hard is stricter.
export interface CampaignPuzzleTuning {
  // topple: time until a toppled piece rises; pairs: time to strike the
  // partner; relay: how long a lit piece burns.
  windowMs?: number;
  // sequence: the whole order must be done this soon after the first step.
  limitMs?: number;
  // sequence: a wrong step is ignored instead of resetting the order.
  forgiveWrong?: boolean;
  // carry: pieces carried at once, and whether a fall keeps them.
  carryLimit?: number;
  keepCarriedOnFall?: boolean;
  // toggle: lever pulls before the spans all drop again.
  pullLimit?: number;
  // Pieces show through unexplored fog, and the next step is highlighted.
  revealAll?: boolean;
  showNext?: boolean;
}

export interface CampaignPuzzleDefinition {
  kind: CampaignPuzzleKind;
  name: string;
  // HUD progress noun ("Shrines 2/4") and the rule after it, long and short.
  unit: string;
  rule: string;
  ruleShort: string;
  description: string;
  // Regroup point once the puzzle is cleared.
  anchor: { x: number; y: number };
  elements: CampaignPuzzleElementDefinition[];
  tuning: Record<DifficultyId, CampaignPuzzleTuning>;
}

export interface CampaignRescueTargetDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface CampaignObjectiveDefinition {
  id: CampaignObjectiveId;
  kind: CampaignObjectiveKind;
  label: string;
  description: string;
  districtId?: string;
  targetCount?: number;
  targets?: CampaignRescueTargetDefinition[];
  durationMs?: number;
  structureLabel?: string;
  structureHp?: number;
  miniBossLabel?: string;
  gateLabel?: string;
  puzzle?: CampaignPuzzleDefinition;
  x?: number;
  y?: number;
  requires?: CampaignObjectiveId[];
}

export interface CampaignDistrictDefinition {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
}

export interface CampaignSpawnPointDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
  archetypes: EnemyArchetype[];
  respawnMs: number;
  maxActive: number;
  initialCount: number;
}

export type CampaignHiddenAreaKind =
  | 'secretRoom'
  | 'scroll'
  | 'fragment'
  | 'zetsuBurrow'
  | 'rareReward';

export interface CampaignHiddenAreaDefinition {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  kind: CampaignHiddenAreaKind;
  rewardPowerUp?: Power;
  enemyArchetype?: EnemyArchetype;
}

export interface CampaignBossArenaDefinition {
  label: string;
  x: number;
  y: number;
  requires: CampaignObjectiveId[];
}

export interface CampaignMissionDefinition {
  id: CampaignMissionId;
  stageId: StageId;
  title: string;
  villageName: string;
  districts: CampaignDistrictDefinition[];
  spawnPoints: CampaignSpawnPointDefinition[];
  hiddenAreas: CampaignHiddenAreaDefinition[];
  discoveredSecrets: string[];
  miniBossGateLabel: string;
  bossGateLabel: string;
  bossArena: CampaignBossArenaDefinition;
  objectives: CampaignObjectiveDefinition[];
}

interface VillageMissionConfig {
  stageId: StageId;
  title: string;
  villageName: string;
  rescueLabel: string;
  rescueDescription: string;
  rescueTargets: [string, string];
  structureLabel: string;
  defenseDescription: string;
  miniBossLabel: string;
  miniBossDescription: string;
  miniBossGateLabel: string;
  bossGateLabel: string;
  bossArenaLabel: string;
  hiddenRewardPowerUp: Power;
  hiddenScrollLabel: string;
  hiddenFragmentLabel: string;
  hiddenBurrowLabel: string;
  spawnArchetypes: [EnemyArchetype[], EnemyArchetype[], EnemyArchetype[]];
  // Difficulty curve: respawn timer and active caps of the main gate, outer
  // burrow and boss gate burrow. Early villages refill slower and hold fewer.
  pressure: { respawnMs: number; maxActive: [number, number, number] };
  objectiveIds?: {
    rescue: CampaignObjectiveId;
    defense: CampaignObjectiveId;
    puzzle?: CampaignObjectiveId;
    miniBoss: CampaignObjectiveId;
  };
}

const VILLAGE_MISSIONS: VillageMissionConfig[] = [
  {
    stageId: 'hiddenLeaf',
    title: 'Hidden Leaf Emergency',
    villageName: 'Hidden Leaf',
    rescueLabel: 'Rescue Villagers',
    rescueDescription: 'Reach the marked villagers before challenging the tailed beast.',
    rescueTargets: ['Training Grounds Villager', 'Village Center Villager'],
    structureLabel: 'Hokage Building',
    defenseDescription: 'Hold the village center until the evacuation seal finishes.',
    miniBossLabel: 'Iruka',
    miniBossDescription: 'Defeat Iruka at the forest gate, then open Kurama\'s arena seal.',
    miniBossGateLabel: 'Iruka evacuation seal',
    bossGateLabel: 'Kurama arena seal',
    bossArenaLabel: 'Kurama Arena',
    hiddenRewardPowerUp: 'Rasengan',
    hiddenScrollLabel: 'Training Grounds Secret Scroll',
    hiddenFragmentLabel: 'Hokage Archive Fragment',
    hiddenBurrowLabel: 'Forest Zetsu Burrow',
    // The first village teaches the basics: no smart chasers, and the ANBU
    // only waits at the boss gate.
    spawnArchetypes: [
      ['rogueGenin', 'mistNinja'],
      ['mistNinja', 'rogueGenin', 'whiteZetsu'],
      ['rogueGenin', 'whiteZetsu', 'anbu'],
    ],
    pressure: { respawnMs: 26000, maxActive: [2, 2, 3] },
    objectiveIds: {
      rescue: 'rescueLeafVillagers',
      defense: 'protectHokageBuilding',
      miniBoss: 'confrontIruka',
    },
  },
  {
    stageId: 'hiddenSand',
    title: 'Hidden Sand Siege',
    villageName: 'Hidden Sand',
    rescueLabel: 'Disable Puppet Towers',
    rescueDescription: 'Reach both puppet towers and cut their chakra strings.',
    rescueTargets: ['West Puppet Tower', 'Market Puppet Tower'],
    structureLabel: 'Kazekage Tower',
    defenseDescription: 'Protect the Kazekage Tower while the sand barrier reforms.',
    miniBossLabel: 'Kankuro',
    miniBossDescription: 'Defeat Kankuro at the puppet gate, then open Shukaku\'s arena.',
    miniBossGateLabel: 'Puppet gate seal',
    bossGateLabel: 'Shukaku arena seal',
    bossArenaLabel: 'Shukaku Arena',
    hiddenRewardPowerUp: 'SandArmor',
    hiddenScrollLabel: 'Desert Armor Scroll',
    hiddenFragmentLabel: 'Kazekage Archive Fragment',
    hiddenBurrowLabel: 'Dune Zetsu Burrow',
    spawnArchetypes: [
      ['rogueGenin', 'sandNinja'],
      ['whiteZetsu', 'rogueGenin', 'sandNinja'],
      ['rogueGenin', 'sandNinja', 'whiteZetsu'],
    ],
    pressure: { respawnMs: 25000, maxActive: [2, 2, 2] },
  },
  {
    stageId: 'hiddenMist',
    title: 'Hidden Mist Extraction',
    villageName: 'Hidden Mist',
    rescueLabel: 'Find Hidden Bridge',
    rescueDescription: 'Locate both bridge anchors before the fog closes the canals.',
    rescueTargets: ['West Bridge Anchor', 'Canal Bridge Anchor'],
    structureLabel: 'Mist Relay Shrine',
    defenseDescription: 'Hold the relay shrine while the water seals stabilize.',
    miniBossLabel: 'Haku',
    miniBossDescription: 'Defeat Haku at the mirror gate, then open Isobu\'s arena.',
    miniBossGateLabel: 'Mirror gate seal',
    bossGateLabel: 'Isobu arena seal',
    bossArenaLabel: 'Isobu Arena',
    hiddenRewardPowerUp: 'CrowFeather',
    hiddenScrollLabel: 'Silent Mist Scroll',
    hiddenFragmentLabel: 'Hunter-Nin Archive Fragment',
    hiddenBurrowLabel: 'Canal Zetsu Burrow',
    spawnArchetypes: [
      ['mistNinja', 'rogueGenin'],
      ['mistNinja', 'whiteZetsu', 'anbu'],
      ['mistNinja', 'sandNinja', 'blackZetsu'],
    ],
    pressure: { respawnMs: 20000, maxActive: [3, 3, 4] },
  },
  {
    stageId: 'hiddenCloud',
    title: 'Hidden Cloud Stormline',
    villageName: 'Hidden Cloud',
    rescueLabel: 'Activate Lightning Shrines',
    rescueDescription: 'Reach both shrines to ground the storm platforms.',
    rescueTargets: ['Lower Lightning Shrine', 'Storm Tower Shrine'],
    structureLabel: 'Raikage Relay',
    defenseDescription: 'Protect the relay while lightning seals ground the storm.',
    miniBossLabel: 'Darui',
    miniBossDescription: 'Defeat Darui at the storm gate, then open Gyuki\'s arena.',
    miniBossGateLabel: 'Storm gate seal',
    bossGateLabel: 'Gyuki arena seal',
    bossArenaLabel: 'Gyuki Arena',
    hiddenRewardPowerUp: 'FTGKunai',
    hiddenScrollLabel: 'Yellow Flash Kunai Cache',
    hiddenFragmentLabel: 'Raikage Archive Fragment',
    hiddenBurrowLabel: 'Storm Zetsu Burrow',
    spawnArchetypes: [
      ['rogueGenin', 'cloudNinja'],
      ['cloudNinja', 'whiteZetsu', 'rogueGenin'],
      ['cloudNinja', 'anbu', 'blackZetsu'],
    ],
    pressure: { respawnMs: 22000, maxActive: [2, 3, 3] },
  },
  {
    stageId: 'hiddenStone',
    title: 'Hidden Stone Lockdown',
    villageName: 'Hidden Stone',
    rescueLabel: 'Collect Earth Seals',
    rescueDescription: 'Recover both earth seals from the boulder lanes.',
    rescueTargets: ['West Earth Seal', 'Archive Earth Seal'],
    structureLabel: 'Tsuchikage Fortress',
    defenseDescription: 'Protect the fortress while the earth seals reset.',
    miniBossLabel: 'Akatsuchi',
    miniBossDescription: 'Defeat Akatsuchi at the canyon gate, then open Kokuo\'s arena.',
    miniBossGateLabel: 'Canyon gate seal',
    bossGateLabel: 'Kokuo arena seal',
    bossArenaLabel: 'Kokuo Arena',
    hiddenRewardPowerUp: 'Sharingan',
    hiddenScrollLabel: 'Stone Archive Scroll',
    hiddenFragmentLabel: 'Tsuchikage Archive Fragment',
    hiddenBurrowLabel: 'Canyon Zetsu Burrow',
    spawnArchetypes: [
      ['rogueGenin', 'sandNinja'],
      ['whiteZetsu', 'sandNinja', 'cloudNinja'],
      ['anbu', 'sandNinja', 'whiteZetsu'],
    ],
    pressure: { respawnMs: 21000, maxActive: [2, 3, 3] },
  },
  {
    stageId: 'akatsukiHideout',
    title: 'Akatsuki Hideout Raid',
    villageName: 'Akatsuki Hideout',
    rescueLabel: 'Recover Captive Scouts',
    rescueDescription: 'Reach the captured scouts before the ritual seals awaken.',
    rescueTargets: ['Outer Cave Scout', 'Ritual Chamber Scout'],
    structureLabel: 'Ritual Seal Core',
    defenseDescription: 'Hold the seal core while the ambush markings fade.',
    miniBossLabel: 'Konan',
    miniBossDescription: 'Defeat Konan at the paper gate, then open Matatabi\'s arena.',
    miniBossGateLabel: 'Paper gate seal',
    bossGateLabel: 'Matatabi arena seal',
    bossArenaLabel: 'Matatabi Arena',
    hiddenRewardPowerUp: 'ClaySpider',
    hiddenScrollLabel: 'Explosive Clay Cache',
    hiddenFragmentLabel: 'Akatsuki Archive Fragment',
    hiddenBurrowLabel: 'Hideout Zetsu Burrow',
    spawnArchetypes: [
      ['whiteZetsu', 'anbu'],
      ['whiteZetsu', 'blackZetsu', 'mistNinja'],
      ['blackZetsu', 'anbu', 'cloudNinja'],
    ],
    pressure: { respawnMs: 19000, maxActive: [3, 4, 4] },
  },
  {
    stageId: 'greatShinobiWar',
    title: 'Great Shinobi War Front',
    villageName: 'Great Shinobi War',
    rescueLabel: 'Rescue Allied Shinobi',
    rescueDescription: 'Reach allied shinobi pinned down across the battlefield.',
    rescueTargets: ['Forward Scout', 'Medical Corps Shinobi'],
    structureLabel: 'Alliance Command Post',
    defenseDescription: 'Protect the command post until the war-front seal completes.',
    miniBossLabel: 'Obito',
    miniBossDescription: 'Defeat Obito at the masked gate, then open the final arena.',
    miniBossGateLabel: 'Masked gate seal',
    bossGateLabel: 'Final Kurama arena seal',
    bossArenaLabel: 'Final Kurama Arena',
    hiddenRewardPowerUp: 'CharacterFragment',
    hiddenScrollLabel: 'Alliance Strategy Scroll',
    hiddenFragmentLabel: 'War Archive Fragment',
    hiddenBurrowLabel: 'War Zetsu Burrow',
    spawnArchetypes: [
      ['rogueGenin', 'cloudNinja', 'sandNinja'],
      ['whiteZetsu', 'sandNinja', 'anbu'],
      ['blackZetsu', 'cloudNinja', 'sandNinja'],
    ],
    pressure: { respawnMs: 18000, maxActive: [3, 4, 4] },
  },
];

type PuzzleCell = { x: number; y: number };
type PuzzleLayout = { anchor: PuzzleCell; cells: PuzzleCell[] };

/**
 * Where each village's puzzle pieces stand on its 35x35 map, in piece order
 * (see PUZZLE_RULES). Remapping a stage to a bigger map only means new cells
 * here: names and rules stay. campaignPuzzles.test.ts checks every cell
 * against the authored map (open floor, reachable, clear of other objectives).
 */
export const CAMPAIGN_PUZZLE_LAYOUTS: Record<StageId, PuzzleLayout> = {
  // South-west grove: three lanterns a short walk apart.
  hiddenLeaf: {
    anchor: { x: 8, y: 24 },
    cells: [{ x: 7, y: 18 }, { x: 3, y: 25 }, { x: 13, y: 26 }],
  },
  // One market row, five cells apart: blasting one clears the way to the next.
  hiddenSand: {
    anchor: { x: 26, y: 6 },
    cells: [{ x: 21, y: 6 }, { x: 26, y: 6 }, { x: 31, y: 6 }],
  },
  // Levers around the canal crossing east of the centre, spans in between,
  // so every span is in sight from every lever.
  hiddenMist: {
    anchor: { x: 22, y: 17 },
    cells: [
      { x: 20, y: 16 }, { x: 22, y: 18 }, { x: 24, y: 16 },
      { x: 21, y: 17 }, { x: 22, y: 17 }, { x: 23, y: 17 },
    ],
  },
  // North-east storm terraces; the order zig-zags across them.
  hiddenCloud: {
    anchor: { x: 23, y: 10 },
    cells: [{ x: 18, y: 6 }, { x: 30, y: 1 }, { x: 23, y: 10 }, { x: 33, y: 11 }],
  },
  // South-west boulder lanes around the cairn.
  hiddenStone: {
    anchor: { x: 10, y: 23 },
    cells: [{ x: 3, y: 17 }, { x: 2, y: 30 }, { x: 16, y: 27 }, { x: 10, y: 23 }],
  },
  // Each pair four cells apart on one open line: a bomb in the middle reaches both.
  akatsukiHideout: {
    anchor: { x: 32, y: 12 },
    cells: [{ x: 23, y: 2 }, { x: 27, y: 2 }, { x: 32, y: 10 }, { x: 32, y: 14 }],
  },
  // A loop around the southern front, about 50 steps once the crates are gone.
  greatShinobiWar: {
    anchor: { x: 22, y: 17 },
    cells: [{ x: 22, y: 17 }, { x: 31, y: 21 }, { x: 19, y: 27 }, { x: 11, y: 21 }],
  },
};

type PuzzlePiece = Omit<CampaignPuzzleElementDefinition, 'x' | 'y'>;
type PuzzleRules = Omit<CampaignPuzzleDefinition, 'anchor' | 'elements'> & {
  pieces: PuzzlePiece[];
};

const STORY_HINTS: CampaignPuzzleTuning = { revealAll: true, showNext: true };

const PUZZLE_RULES: Record<StageId, PuzzleRules> = {
  hiddenLeaf: {
    kind: 'kindle',
    name: 'Watchfire Lanterns',
    unit: 'Lanterns',
    rule: 'blast each one to kindle it',
    ruleShort: 'blast to kindle',
    description: 'Blast the three watchfire lanterns to light the way to the forest gate.',
    pieces: [
      { id: 'hiddenLeaf-lantern-cedar', label: 'Cedar Lantern', role: 'lantern' },
      { id: 'hiddenLeaf-lantern-well', label: 'Well Lantern', role: 'lantern' },
      { id: 'hiddenLeaf-lantern-mill', label: 'Mill Lantern', role: 'lantern' },
    ],
    tuning: { story: STORY_HINTS, normal: {}, hard: {} },
  },
  hiddenSand: {
    kind: 'topple',
    name: 'Marionette Pylons',
    unit: 'Pylons',
    rule: 'topple all three before their strings re-tie',
    ruleShort: 'topple all at once',
    description: 'Topple all three marionette pylons at once. A fallen pylon re-ties its strings soon after.',
    pieces: [
      { id: 'hiddenSand-pylon-west', label: 'West Pylon', role: 'pylon' },
      { id: 'hiddenSand-pylon-middle', label: 'Middle Pylon', role: 'pylon' },
      { id: 'hiddenSand-pylon-east', label: 'East Pylon', role: 'pylon' },
    ],
    tuning: {
      story: { ...STORY_HINTS, windowMs: 22000 },
      normal: { windowMs: 14000 },
      hard: { windowMs: 9000 },
    },
  },
  hiddenMist: {
    kind: 'toggle',
    name: 'Tide Lock Levers',
    unit: 'Spans',
    rule: 'each lever flips the spans on its sign',
    ruleShort: 'raise every span',
    description: 'Step on the tide-lock levers to raise every span of the hidden bridge.',
    // Flip sets form an invertible system: any span state can still be solved.
    pieces: [
      {
        id: 'hiddenMist-lever-ab', label: 'Lever A·B', role: 'lever', flips: ['hiddenMist-span-a', 'hiddenMist-span-b'],
      },
      {
        id: 'hiddenMist-lever-bc', label: 'Lever B·C', role: 'lever', flips: ['hiddenMist-span-b', 'hiddenMist-span-c'],
      },
      {
        id: 'hiddenMist-lever-a', label: 'Lever A', role: 'lever', flips: ['hiddenMist-span-a'],
      },
      { id: 'hiddenMist-span-a', label: 'Span A', role: 'span' },
      { id: 'hiddenMist-span-b', label: 'Span B', role: 'span' },
      { id: 'hiddenMist-span-c', label: 'Span C', role: 'span' },
    ],
    tuning: { story: STORY_HINTS, normal: {}, hard: { pullLimit: 6 } },
  },
  hiddenCloud: {
    kind: 'sequence',
    name: 'Thunderbell Shrines',
    unit: 'Shrines',
    rule: 'ring them in order, I to IV',
    ruleShort: 'ring in order',
    description: 'Step on the thunderbell shrines in order, I to IV, to ground the storm gate.',
    pieces: [
      {
        id: 'hiddenCloud-bell-1', label: 'Bell I', role: 'shrine', order: 1,
      },
      {
        id: 'hiddenCloud-bell-2', label: 'Bell II', role: 'shrine', order: 2,
      },
      {
        id: 'hiddenCloud-bell-3', label: 'Bell III', role: 'shrine', order: 3,
      },
      {
        id: 'hiddenCloud-bell-4', label: 'Bell IV', role: 'shrine', order: 4,
      },
    ],
    tuning: {
      story: { ...STORY_HINTS, forgiveWrong: true },
      normal: {},
      hard: { limitMs: 45000 },
    },
  },
  hiddenStone: {
    kind: 'carry',
    name: 'Cairn Keystones',
    unit: 'Keystones',
    rule: 'carry each one to the old cairn',
    ruleShort: 'carry to the cairn',
    description: 'Walk over the keystones to lift them and carry them to the old cairn.',
    pieces: [
      { id: 'hiddenStone-keystone-north', label: 'North Keystone', role: 'keystone' },
      { id: 'hiddenStone-keystone-south', label: 'South Keystone', role: 'keystone' },
      { id: 'hiddenStone-keystone-east', label: 'East Keystone', role: 'keystone' },
      { id: 'hiddenStone-cairn', label: 'Old Cairn', role: 'cairn' },
    ],
    tuning: {
      story: { ...STORY_HINTS, carryLimit: 3, keepCarriedOnFall: true },
      normal: { carryLimit: 2 },
      hard: { carryLimit: 1 },
    },
  },
  akatsukiHideout: {
    kind: 'pairs',
    name: 'Twin Paper Wards',
    unit: 'Ward pairs',
    rule: 'strike both wards of a pair together',
    ruleShort: 'both wards together',
    description: 'Strike both wards of each pair with one blast, or both within moments.',
    pieces: [
      {
        id: 'akatsukiHideout-ward-moon-west', label: 'Moon Ward', role: 'ward', pair: 0,
      },
      {
        id: 'akatsukiHideout-ward-moon-east', label: 'Moon Ward', role: 'ward', pair: 0,
      },
      {
        id: 'akatsukiHideout-ward-ember-north', label: 'Ember Ward', role: 'ward', pair: 1,
      },
      {
        id: 'akatsukiHideout-ward-ember-south', label: 'Ember Ward', role: 'ward', pair: 1,
      },
    ],
    tuning: {
      story: { ...STORY_HINTS, windowMs: 6000 },
      normal: { windowMs: 3500 },
      hard: { windowMs: 1500 },
    },
  },
  greatShinobiWar: {
    kind: 'relay',
    name: 'Rally Beacons',
    unit: 'Beacons',
    rule: 'keep all four burning at once',
    ruleShort: 'all four lit at once',
    description: 'Step on the rally beacons to light them, and have all four burning together.',
    pieces: [
      { id: 'greatShinobiWar-beacon-north', label: 'North Beacon', role: 'beacon' },
      { id: 'greatShinobiWar-beacon-east', label: 'East Beacon', role: 'beacon' },
      { id: 'greatShinobiWar-beacon-south', label: 'South Beacon', role: 'beacon' },
      { id: 'greatShinobiWar-beacon-west', label: 'West Beacon', role: 'beacon' },
    ],
    tuning: {
      story: { ...STORY_HINTS, windowMs: 50000 },
      normal: { windowMs: 34000 },
      hard: { windowMs: 24000 },
    },
  },
};

/** The village's route puzzle: its rules with the pieces placed on the layout cells. */
export function getCampaignPuzzle(stageId: StageId): CampaignPuzzleDefinition {
  const { pieces, ...rules } = PUZZLE_RULES[stageId];
  const layout = CAMPAIGN_PUZZLE_LAYOUTS[stageId];
  return {
    ...rules,
    anchor: layout.anchor,
    elements: pieces.map((piece, index) => ({ ...piece, ...layout.cells[index] })),
  };
}

function missionId(stageId: StageId): CampaignMissionId {
  return `${stageId}Opening`;
}

function defaultObjectiveIds(stageId: StageId) {
  return {
    rescue: `${stageId}Rescue`,
    defense: `${stageId}Defense`,
    miniBoss: `${stageId}MiniBoss`,
  };
}

function puzzleObjectiveId(config: VillageMissionConfig): CampaignObjectiveId {
  return config.objectiveIds?.puzzle ?? `${config.stageId}Puzzle`;
}

function districtId(stageId: StageId, suffix: string): string {
  return `${stageId}-${suffix}`;
}

function createDistricts(config: VillageMissionConfig): CampaignDistrictDefinition[] {
  return [
    {
      id: districtId(config.stageId, 'entrance'),
      label: 'Village Entrance',
      description: `The first safe lane into ${config.villageName}.`,
      x: 1,
      y: 1,
    },
    {
      id: districtId(config.stageId, 'outer-district'),
      label: 'Outer District',
      description: `Scattered cover and evacuees near ${config.villageName}.`,
      x: 3,
      y: 1,
    },
    {
      id: districtId(config.stageId, 'center'),
      label: 'Village Center',
      description: `The central defense point around ${config.structureLabel}.`,
      x: 17,
      y: 16,
    },
    {
      id: districtId(config.stageId, 'puzzle'),
      label: getCampaignPuzzle(config.stageId).name,
      description: `The ${getCampaignPuzzle(config.stageId).name.toLowerCase()} that seal the road to the boss gate.`,
      x: CAMPAIGN_PUZZLE_LAYOUTS[config.stageId].anchor.x,
      y: CAMPAIGN_PUZZLE_LAYOUTS[config.stageId].anchor.y,
    },
    {
      id: districtId(config.stageId, 'boss-gate'),
      label: 'Boss Gate',
      description: `${config.miniBossLabel} guards the seal to ${config.bossArenaLabel}.`,
      x: 29,
      y: 29,
    },
  ];
}

function createSpawnPoints(config: VillageMissionConfig): CampaignSpawnPointDefinition[] {
  return [
    {
      id: `${config.stageId}-main-gate`,
      label: 'Main Gate',
      x: 6,
      y: 5,
      archetypes: config.spawnArchetypes[0],
      respawnMs: config.pressure.respawnMs,
      maxActive: config.pressure.maxActive[0],
      initialCount: 1,
    },
    {
      id: `${config.stageId}-outer-burrow`,
      label: 'Outer District Burrow',
      x: 13,
      y: 8,
      archetypes: config.spawnArchetypes[1],
      respawnMs: config.pressure.respawnMs,
      maxActive: config.pressure.maxActive[1],
      initialCount: 1,
    },
    {
      id: `${config.stageId}-boss-gate-burrow`,
      label: 'Boss Gate Burrow',
      x: 28,
      y: 28,
      archetypes: config.spawnArchetypes[2],
      respawnMs: config.pressure.respawnMs,
      maxActive: config.pressure.maxActive[2],
      initialCount: 0,
    },
  ];
}

function createHiddenAreas(config: VillageMissionConfig): CampaignHiddenAreaDefinition[] {
  return [
    {
      id: `${config.stageId}-scroll-cache`,
      label: config.hiddenScrollLabel,
      description: `A hidden scroll cache buried in ${config.villageName}.`,
      x: 3,
      y: 2,
      kind: 'scroll',
      rewardPowerUp: config.hiddenRewardPowerUp,
    },
    {
      id: `${config.stageId}-archive-fragment`,
      label: config.hiddenFragmentLabel,
      description: `A rare character fragment sealed in ${config.villageName}.`,
      x: 18,
      y: 12,
      kind: 'fragment',
      rewardPowerUp: 'CharacterFragment',
    },
    {
      id: `${config.stageId}-zetsu-burrow`,
      label: config.hiddenBurrowLabel,
      description: `An unstable wall hiding an elite Zetsu ambush in ${config.villageName}.`,
      x: 28,
      y: 31,
      kind: 'zetsuBurrow',
      enemyArchetype: 'blackZetsu',
    },
  ];
}

function createObjectives(config: VillageMissionConfig): CampaignObjectiveDefinition[] {
  const objectives = config.objectiveIds ?? defaultObjectiveIds(config.stageId);
  const puzzle = {
    id: puzzleObjectiveId(config),
    definition: getCampaignPuzzle(config.stageId),
  };
  return [
    {
      id: objectives.rescue,
      kind: 'rescue',
      label: config.rescueLabel,
      description: config.rescueDescription,
      districtId: districtId(config.stageId, 'outer-district'),
      targetCount: 2,
      targets: [
        {
          id: `${config.stageId}-rescue-west`,
          label: config.rescueTargets[0],
          x: 3,
          y: 1,
        },
        {
          id: `${config.stageId}-rescue-east`,
          label: config.rescueTargets[1],
          x: 10,
          y: 6,
        },
      ],
    },
    {
      id: objectives.defense,
      kind: 'defense',
      label: `Protect ${config.structureLabel}`,
      description: config.defenseDescription,
      districtId: districtId(config.stageId, 'center'),
      durationMs: 20000,
      structureLabel: config.structureLabel,
      structureHp: 100,
      x: 17,
      y: 16,
      requires: [objectives.rescue],
    },
    // The route puzzle unseals the mini boss gate.
    {
      id: puzzle.id,
      kind: 'puzzle',
      label: puzzle.definition.name,
      description: puzzle.definition.description,
      districtId: districtId(config.stageId, 'puzzle'),
      puzzle: puzzle.definition,
      x: puzzle.definition.anchor.x,
      y: puzzle.definition.anchor.y,
      requires: [objectives.defense],
    },
    {
      id: objectives.miniBoss,
      kind: 'miniBoss',
      label: `Confront ${config.miniBossLabel}`,
      description: config.miniBossDescription,
      districtId: districtId(config.stageId, 'boss-gate'),
      miniBossLabel: config.miniBossLabel,
      gateLabel: config.miniBossGateLabel,
      x: 29,
      y: 29,
      requires: [puzzle.id],
    },
  ];
}

function createMission(config: VillageMissionConfig): CampaignMissionDefinition {
  const objectives = config.objectiveIds ?? defaultObjectiveIds(config.stageId);
  return {
    id: missionId(config.stageId),
    stageId: config.stageId,
    title: config.title,
    villageName: config.villageName,
    districts: createDistricts(config),
    spawnPoints: createSpawnPoints(config),
    hiddenAreas: createHiddenAreas(config),
    discoveredSecrets: [],
    miniBossGateLabel: config.miniBossGateLabel,
    bossGateLabel: config.bossGateLabel,
    bossArena: {
      label: config.bossArenaLabel,
      x: 17,
      y: 17,
      requires: [objectives.miniBoss],
    },
    objectives: createObjectives(config),
  };
}

export const CAMPAIGN_MISSIONS: CampaignMissionDefinition[] = VILLAGE_MISSIONS
  .map(createMission);

export function getCampaignMission(
  stageId?: StageId
): CampaignMissionDefinition | null {
  return CAMPAIGN_MISSIONS.find((mission) => mission.stageId === stageId) ?? null;
}
