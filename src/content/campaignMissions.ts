import { StageId } from './types';
import { EnemyArchetype } from './enemies';
import { Power } from '../model/gameItem';

export type CampaignMissionId = `${StageId}Opening`;

export type CampaignMissionStep =
  | 'exploration'
  | 'rescue'
  | 'defense'
  | 'miniBoss'
  | 'bossGate'
  | 'boss'
  | 'complete'
  | 'failed';

export type CampaignObjectiveId = string;

export type CampaignObjectiveKind = 'rescue' | 'defense' | 'miniBoss';

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
  objectiveIds?: {
    rescue: CampaignObjectiveId;
    defense: CampaignObjectiveId;
    miniBoss: CampaignObjectiveId;
  };
}

const RESPAWN_MS = 20000;

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
    spawnArchetypes: [
      ['rogueGenin', 'anbu'],
      ['mistNinja', 'sandNinja', 'whiteZetsu'],
      ['cloudNinja', 'whiteZetsu', 'blackZetsu'],
    ],
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
      ['sandNinja', 'rogueGenin'],
      ['sandNinja', 'whiteZetsu', 'anbu'],
      ['sandNinja', 'blackZetsu', 'cloudNinja'],
    ],
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
      ['mistNinja', 'blackZetsu', 'sandNinja'],
    ],
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
      ['cloudNinja', 'anbu'],
      ['cloudNinja', 'whiteZetsu', 'rogueGenin'],
      ['cloudNinja', 'blackZetsu', 'anbu'],
    ],
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
      ['sandNinja', 'rogueGenin'],
      ['sandNinja', 'cloudNinja', 'whiteZetsu'],
      ['anbu', 'blackZetsu', 'sandNinja'],
    ],
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
      ['whiteZetsu', 'mistNinja', 'anbu'],
      ['blackZetsu', 'whiteZetsu', 'cloudNinja'],
    ],
  },
];

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
      respawnMs: RESPAWN_MS,
      maxActive: 3,
      initialCount: 1,
    },
    {
      id: `${config.stageId}-outer-burrow`,
      label: 'Outer District Burrow',
      x: 13,
      y: 8,
      archetypes: config.spawnArchetypes[1],
      respawnMs: RESPAWN_MS,
      maxActive: 3,
      initialCount: 1,
    },
    {
      id: `${config.stageId}-boss-gate-burrow`,
      label: 'Boss Gate Burrow',
      x: 28,
      y: 28,
      archetypes: config.spawnArchetypes[2],
      respawnMs: RESPAWN_MS,
      maxActive: 4,
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
      requires: [objectives.defense],
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
