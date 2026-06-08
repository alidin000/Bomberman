import { StageId } from './types';

export type CampaignMissionId = 'hiddenLeafOpening';

export type CampaignMissionStep =
  | 'exploration'
  | 'rescue'
  | 'defense'
  | 'miniBoss'
  | 'bossGate'
  | 'boss'
  | 'complete'
  | 'failed';

export type CampaignObjectiveId =
  | 'rescueLeafVillagers'
  | 'protectHokageBuilding'
  | 'confrontIruka';

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
  discoveredSecrets: string[];
  miniBossGateLabel: string;
  bossGateLabel: string;
  bossArena: CampaignBossArenaDefinition;
  objectives: CampaignObjectiveDefinition[];
}

export const CAMPAIGN_MISSIONS: CampaignMissionDefinition[] = [
  {
    id: 'hiddenLeafOpening',
    stageId: 'hiddenLeaf',
    title: 'Hidden Leaf Emergency',
    villageName: 'Hidden Leaf',
    districts: [
      {
        id: 'villageEntrance',
        label: 'Village Entrance',
        description: 'The evacuation route at the edge of Hidden Leaf.',
        x: 1,
        y: 1,
      },
      {
        id: 'trainingGrounds',
        label: 'Training Grounds',
        description: 'Scattered logs and lanes where villagers are hiding.',
        x: 3,
        y: 1,
      },
      {
        id: 'villageCenter',
        label: 'Village Center',
        description: 'The central evacuation seal near the Hokage Building.',
        x: 17,
        y: 16,
      },
      {
        id: 'forestGate',
        label: 'Forest Gate',
        description: 'Iruka holds the seal that opens Kurama\'s arena.',
        x: 29,
        y: 29,
      },
    ],
    spawnPoints: [
      {
        id: 'leaf-main-gate',
        label: 'Main Gate',
        x: 1,
        y: 1,
      },
    ],
    discoveredSecrets: [],
    miniBossGateLabel: 'Iruka evacuation seal',
    bossGateLabel: 'Kurama arena seal',
    bossArena: {
      label: 'Kurama Arena',
      x: 17,
      y: 17,
      requires: ['confrontIruka'],
    },
    objectives: [
      {
        id: 'rescueLeafVillagers',
        kind: 'rescue',
        label: 'Rescue Villagers',
        description: 'Reach the marked villagers before challenging the tailed beast.',
        districtId: 'trainingGrounds',
        targetCount: 2,
        targets: [
          {
            id: 'leaf-villager-west',
            label: 'Training Grounds Villager',
            x: 3,
            y: 1,
          },
          {
            id: 'leaf-villager-east',
            label: 'Village Center Villager',
            x: 10,
            y: 6,
          },
        ],
      },
      {
        id: 'protectHokageBuilding',
        kind: 'defense',
        label: 'Protect Hokage Building',
        description: 'Hold the village center until the evacuation seal finishes.',
        districtId: 'villageCenter',
        durationMs: 20000,
        structureLabel: 'Hokage Building',
        structureHp: 100,
        x: 17,
        y: 16,
        requires: ['rescueLeafVillagers'],
      },
      {
        id: 'confrontIruka',
        kind: 'miniBoss',
        label: 'Confront Iruka',
        description: 'Reach Iruka at the forest gate to open Kurama\'s arena seal.',
        districtId: 'forestGate',
        miniBossLabel: 'Iruka',
        gateLabel: 'Forest Gate Seal',
        x: 29,
        y: 29,
        requires: ['protectHokageBuilding'],
      },
    ],
  },
];

export function getCampaignMission(
  stageId?: StageId
): CampaignMissionDefinition | null {
  return CAMPAIGN_MISSIONS.find((mission) => mission.stageId === stageId) ?? null;
}
