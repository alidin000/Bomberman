import { GameMap, Power } from '../model/gameItem';
import {
  BossId, CharacterId, GameMode, StageId,
} from '../content/types';
import {
  CampaignBossArenaDefinition,
  CampaignDistrictDefinition,
  CampaignHiddenAreaDefinition,
  CampaignMissionId,
  CampaignMissionStep,
  CampaignObjectiveId,
  CampaignObjectiveKind,
  CampaignSpawnPointDefinition,
} from '../content/campaignMissions';
import { EnemyAbilityKind, EnemyArchetype } from '../content/enemies';
import { StoryUpgradeId } from '../story/progress';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type MonsterKind = 'basic' | 'smart' | 'ghost' | 'fork';

export type GamePhase = 'playing' | 'round_end' | 'game_over';

export type BombKind =
  | 'standard'
  | 'claySpider'
  | 'shadowClone'
  | 'chidoriMine'
  | 'sandCoffin'
  | 'thunderMark'
  | 'crowClone'
  | 'giantClay'
  | 'rasenshuriken'
  | 'kirin'
  | 'sandTsunami'
  | 'instantTeleport'
  | 'tsukuyomi';

export interface Point {
  x: number;
  y: number;
}

export type HazardKind =
  | 'sandTornado'
  | 'sandSpikes'
  | 'blueFireTrail'
  | 'waterCannon'
  | 'lavaBurst'
  | 'steamCharge'
  | 'acidBubble'
  | 'airStrike'
  | 'tentacleSlam'
  | 'beastBomb'
  | 'chakraShockwave';

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  alive: boolean;
  maxBombs: number;
  activeBombs: number;
  bombRange: number;
  powerUps: Power[];
  obstacles: number;
  color: string;
  characterId: CharacterId;
  ultimateCooldown: number;
  ultimateCooldownRemaining: number;
  ultimateCharge: number;
  facing?: Direction;
  specialState?: string;
  passiveState?: string;
}

export interface MonsterState {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: MonsterKind;
  moveCooldown: number;
  archetype?: EnemyArchetype;
  abilityKind?: EnemyAbilityKind;
  abilityLabel?: string;
  abilityCooldown?: number;
  abilityWarningTicks?: number;
  abilityTarget?: Point | null;
  spawnPointId?: string;
  clone?: boolean;
  elite?: boolean;
}

export interface BombState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  range: number;
  ticksRemaining: number;
  manualDetonation: boolean;
  kind: BombKind;
}

export interface BossState {
  id: BossId;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  phase: number;
  attackCooldown: number;
  moveCooldown: number;
  currentAbility: string;
  color: string;
  tails: number;
}

export interface BossHazard {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  ticksRemaining: number;
  warningTicks: number;
  color: string;
  damage: number;
}

export interface ExplosionCell {
  x: number;
  y: number;
  ticksRemaining: number;
  kind?: BombKind;
}

export type CampaignDestructionOutcomeKind =
  | 'nothing'
  | 'powerUp'
  | 'whiteZetsu'
  | 'eliteZetsu'
  | 'rareReward';

export interface CampaignDestructionOutcome {
  kind: CampaignDestructionOutcomeKind;
  powerUp?: Power;
  enemyArchetype?: EnemyArchetype;
  secretId?: string;
  label?: string;
}

export interface DestroyedBox {
  x: number;
  y: number;
  ticksRemaining: number;
  pendingPowerUp: Power | null;
  pendingOutcome?: CampaignDestructionOutcome | null;
}

export interface TimedPowerUp {
  power: Power;
  ticksRemaining: number;
  flashTicksRemaining: number;
}

export interface PowerUpMessage {
  id: string;
  playerId: string;
  power: Power;
  ticksRemaining: number;
}

export type CampaignObjectiveStatus = 'locked' | 'active' | 'complete' | 'failed';

export interface CampaignRescueTargetState {
  id: string;
  label: string;
  x: number;
  y: number;
  rescued: boolean;
}

export interface CampaignObjectiveState {
  id: CampaignObjectiveId;
  kind: CampaignObjectiveKind;
  label: string;
  description: string;
  districtId?: string;
  status: CampaignObjectiveStatus;
  current: number;
  target: number;
  targets?: CampaignRescueTargetState[];
  ticksRemaining?: number;
  durationMs?: number;
  structureLabel?: string;
  structureHp?: number;
  structureMaxHp?: number;
  structureDamageCooldownMs?: number;
  miniBossLabel?: string;
  gateLabel?: string;
  x?: number;
  y?: number;
  requires?: CampaignObjectiveId[];
}

export type CampaignMissionResult = 'in_progress' | 'success' | 'failed';

export interface CampaignStructureState {
  id: CampaignObjectiveId;
  label: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  status: CampaignObjectiveStatus;
}

export interface CampaignBossArenaState extends CampaignBossArenaDefinition {
  unlocked: boolean;
}

export interface CampaignRespawnPointState extends CampaignSpawnPointDefinition {
  ticksRemaining: number;
  activeMonsterIds: string[];
  spawnCount: number;
}

export interface CampaignRuntimeState {
  missionId: CampaignMissionId;
  stageId: StageId;
  currentVillage: StageId;
  title: string;
  villageName: string;
  missionStep: CampaignMissionStep;
  missionResult: CampaignMissionResult;
  currentDistrictId: string;
  districts: CampaignDistrictDefinition[];
  spawnPoints: CampaignRespawnPointState[];
  hiddenAreas: CampaignHiddenAreaDefinition[];
  discoveredSecrets: string[];
  structures: CampaignStructureState[];
  miniBossGateLabel: string;
  bossGateLabel: string;
  bossArena: CampaignBossArenaState;
  objectives: CampaignObjectiveState[];
  bossUnlocked: boolean;
  message: string;
}

export type CellVisibility = 'hidden' | 'explored' | 'visible';

export interface FogOfWarState {
  visible: string[];
  explored: string[];
  sensedEnemies: string[];
  sensedWalls: string[];
}

export interface GameConfig {
  mode?: GameMode;
  numPlayers: number;
  totalRounds: number;
  selectedMap: string;
  map: GameMap;
  stageId?: StageId;
  selectedCharacters?: CharacterId[];
  selectedUpgrade?: StoryUpgradeId;
}

export interface GameEngineState {
  map: GameMap;
  players: PlayerState[];
  monsters: MonsterState[];
  bombs: BombState[];
  explosions: ExplosionCell[];
  destroyedBoxes: DestroyedBox[];
  timedPowerUps: Record<string, TimedPowerUp[]>;
  pickupMessages: PowerUpMessage[];
  campaign: CampaignRuntimeState | null;
  boss: BossState | null;
  fogOfWar: FogOfWarState;
  hazards: BossHazard[];
  round: number;
  totalRounds: number;
  roundWinners: string[];
  phase: GamePhase;
  resultMessage: string;
  paused: boolean;
  tick: number;
  config: GameConfig;
  roundProcessed: boolean;
}
