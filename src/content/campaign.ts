import { CharacterId, StageId } from './types';

type CampaignRewardUpgradeId =
  | 'extraClay'
  | 'blastTraining'
  | 'quickUltimate'
  | 'sandGuard';

export type CampaignFlowStepId =
  | 'exploration'
  | 'combat'
  | 'elite'
  | 'miniBoss'
  | 'villageBoss'
  | 'reward';

export interface CampaignFlowStep {
  id: CampaignFlowStepId;
  label: string;
}

export interface CampaignVillageDefinition {
  stageId: StageId;
  order: number;
  villageName: string;
  theme: string;
  props: string[];
  enemies: string[];
  miniBoss: string;
  villageBoss: string;
  reward: string;
  rewardCharacter?: CharacterId;
  rewardUpgrade?: CampaignRewardUpgradeId;
}

export const CAMPAIGN_FLOW_STEPS: CampaignFlowStep[] = [
  { id: 'exploration', label: 'Exploration' },
  { id: 'combat', label: 'Combat' },
  { id: 'elite', label: 'Elite Enemy' },
  { id: 'miniBoss', label: 'Mini Boss' },
  { id: 'villageBoss', label: 'Village Boss' },
  { id: 'reward', label: 'Reward' },
];

export const CAMPAIGN_VILLAGES: CampaignVillageDefinition[] = [
  {
    stageId: 'hiddenLeaf',
    order: 1,
    villageName: 'Hidden Leaf',
    theme: 'Forest',
    props: ['Trees', 'Training Logs', 'Hokage Banners'],
    enemies: ['Rogue Genin', 'Training Clone', 'ANBU Trainee'],
    miniBoss: 'Iruka',
    villageBoss: 'Kurama',
    reward: 'Naruto Unlock',
    rewardCharacter: 'naruto',
  },
  {
    stageId: 'hiddenSand',
    order: 2,
    villageName: 'Hidden Sand',
    theme: 'Desert',
    props: ['Sandstone Pillars', 'Cactus', 'Bones'],
    enemies: ['Sand Ninja', 'Puppet', 'Desert Scorpion'],
    miniBoss: 'Kankuro',
    villageBoss: 'Shukaku',
    reward: 'Gaara Unlock',
    rewardCharacter: 'gaara',
  },
  {
    stageId: 'hiddenMist',
    order: 3,
    villageName: 'Hidden Mist',
    theme: 'Fog',
    props: ['Bridges', 'Torii Gates', 'Water Pools'],
    enemies: ['Mist Ninja', 'Water Clone', 'Hunter Ninja'],
    miniBoss: 'Haku',
    villageBoss: 'Isobu',
    reward: 'Itachi Unlock',
    rewardCharacter: 'itachi',
  },
  {
    stageId: 'hiddenCloud',
    order: 4,
    villageName: 'Hidden Cloud',
    theme: 'Lightning',
    props: ['Floating Rocks', 'Lightning Towers'],
    enemies: ['Lightning Ninja', 'Thunder Hawk', 'Cloud Samurai'],
    miniBoss: 'Darui',
    villageBoss: 'Gyuki',
    reward: 'Minato Unlock',
    rewardCharacter: 'minato',
  },
  {
    stageId: 'hiddenStone',
    order: 5,
    villageName: 'Hidden Stone',
    theme: 'Mountains',
    props: ['Boulder Fields', 'Cave Entrances'],
    enemies: ['Rock Golem', 'Cave Spider', 'Stone Guard'],
    miniBoss: 'Akatsuchi',
    villageBoss: 'Kokuo',
    reward: 'Sasuke Unlock',
    rewardCharacter: 'sasuke',
  },
  {
    stageId: 'akatsukiHideout',
    order: 6,
    villageName: 'Akatsuki Hideout',
    theme: 'Dark Fortress',
    props: ['Ritual Seals', 'Cave Pillars', 'Red Lanterns'],
    enemies: ['White Zetsu', 'Crow Swarm', 'Cultists'],
    miniBoss: 'Konan',
    villageBoss: 'Matatabi',
    reward: 'Deidara Upgrade',
    rewardUpgrade: 'sandGuard',
  },
  {
    stageId: 'greatShinobiWar',
    order: 7,
    villageName: 'Great Shinobi War',
    theme: 'Final Battlefield',
    props: ['War Banners', 'Broken Cover', 'Chakra Scars'],
    enemies: ['Masked Clone', 'War Zetsu', 'Battlefield Shinobi'],
    miniBoss: 'Obito',
    villageBoss: 'Kurama',
    reward: 'Story Completion',
  },
];

export function getCampaignVillage(stageId?: StageId): CampaignVillageDefinition {
  return CAMPAIGN_VILLAGES.find((village) => village.stageId === stageId)
    ?? CAMPAIGN_VILLAGES[0];
}

export function getNextCampaignStageId(stageId: StageId): StageId | null {
  const currentIndex = CAMPAIGN_VILLAGES.findIndex(
    (village) => village.stageId === stageId
  );
  if (currentIndex === -1) return null;
  return CAMPAIGN_VILLAGES[currentIndex + 1]?.stageId ?? null;
}
