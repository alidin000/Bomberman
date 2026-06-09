import { StageId } from './types';

export type CampaignEventId =
  | 'nineTailsAlert'
  | 'sandstorm'
  | 'denseFog'
  | 'lightningStorm'
  | 'rockslide'
  | 'akatsukiAmbush'
  | 'warfrontSurge';

export interface CampaignEventDefinition {
  id: CampaignEventId;
  stageId: StageId;
  name: string;
  description: string;
  effectLabel: string;
  color: string;
  visionModifier: number;
  respawnPressure: number;
  structureDamageBonus: number;
}

export const CAMPAIGN_EVENTS: CampaignEventDefinition[] = [
  {
    id: 'nineTailsAlert',
    stageId: 'hiddenLeaf',
    name: 'Nine Tails Alert',
    description: 'Evacuation bells pull enemy patrols toward the village center.',
    effectLabel: '+10 structure damage when enemies breach objectives',
    color: '#fb923c',
    visionModifier: 0,
    respawnPressure: 1.05,
    structureDamageBonus: 10,
  },
  {
    id: 'sandstorm',
    stageId: 'hiddenSand',
    name: 'Sandstorm',
    description: 'Windblown grit lowers visibility while patrols rotate faster.',
    effectLabel: '-1 vision radius, +20% respawn pressure',
    color: '#facc15',
    visionModifier: -1,
    respawnPressure: 1.2,
    structureDamageBonus: 0,
  },
  {
    id: 'denseFog',
    stageId: 'hiddenMist',
    name: 'Dense Fog',
    description: 'Mist hides distant bridges and makes enemy outlines more valuable.',
    effectLabel: '-1 vision radius',
    color: '#7dd3fc',
    visionModifier: -1,
    respawnPressure: 1,
    structureDamageBonus: 0,
  },
  {
    id: 'lightningStorm',
    stageId: 'hiddenCloud',
    name: 'Lightning Storm',
    description: 'Storm relays overload and pull Cloud patrols back into combat.',
    effectLabel: '+25% respawn pressure',
    color: '#60a5fa',
    visionModifier: 0,
    respawnPressure: 1.25,
    structureDamageBonus: 0,
  },
  {
    id: 'rockslide',
    stageId: 'hiddenStone',
    name: 'Rockslide',
    description: 'Falling stone makes structure defense riskier.',
    effectLabel: '+15 structure damage when enemies breach objectives',
    color: '#a8a29e',
    visionModifier: 0,
    respawnPressure: 1.05,
    structureDamageBonus: 15,
  },
  {
    id: 'akatsukiAmbush',
    stageId: 'akatsukiHideout',
    name: 'Akatsuki Ambush',
    description: 'Hidden scouts keep pressure on ritual corridors.',
    effectLabel: '+20% respawn pressure',
    color: '#dc2626',
    visionModifier: 0,
    respawnPressure: 1.2,
    structureDamageBonus: 0,
  },
  {
    id: 'warfrontSurge',
    stageId: 'greatShinobiWar',
    name: 'Warfront Surge',
    description: 'Allied lines shift as the battlefield floods with enemy squads.',
    effectLabel: '+30% respawn pressure, +10 structure damage',
    color: '#fb923c',
    visionModifier: 0,
    respawnPressure: 1.3,
    structureDamageBonus: 10,
  },
];

export function getCampaignEvent(stageId?: StageId): CampaignEventDefinition | null {
  return CAMPAIGN_EVENTS.find((event) => event.stageId === stageId) ?? null;
}
