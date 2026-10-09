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
  CampaignPuzzleKind,
  CampaignPuzzleRole,
  CampaignPuzzleTuning,
  CampaignSpawnPointDefinition,
} from '../content/campaignMissions';
import { CampaignWaveEntryDefinition } from '../content/campaignWaves';
import { EnemyAbilityKind, EnemyArchetype } from '../content/enemies';
import { CampaignEventDefinition } from '../content/campaignEvents';
import { StoryUpgradeId } from '../story/progress';
import type { CampaignLoadout } from '../content/hubShop';
import type { DifficultyId } from './difficulty';

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

// What took a player out, as data, so the view can name both sides by slot
// (two players may be the same shinobi). Recorded next to `deathReason`
// when the hit lands; it never feeds back into the simulation.
export type DeathCauseKind = 'blast' | 'flame' | 'pressure' | 'enemy' | 'hazard' | 'ghost';

export interface DeathCause {
  kind: DeathCauseKind;
  // The player whose bomb or lingering flame it was.
  byPlayerId?: string;
  bombKind?: BombKind;
  // The enemy, boss or hazard source, and its attack.
  sourceName?: string;
  sourceAbility?: string;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  alive: boolean;
  deathReason?: string;
  deathCause?: DeathCause;
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
  // Time left in which a spent survival passive still shields its owner.
  survivalGraceMs?: number;
}

export interface MonsterPatrol {
  route: Point[];
  leg: number;
  forward: boolean;
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
  detectionRange?: number;
  spawnPointId?: string;
  clone?: boolean;
  elite?: boolean;
  // Short-lived summons (water clones) fade when this runs out.
  lifetimeMs?: number;
  // A mini boss guards its gate: with no player in sight it walks back
  // within `radius` cells of it instead of wandering the whole map.
  leash?: { x: number; y: number; radius: number };
  // A scripted walker (the Training Dojo's sentry): it walks its route's
  // waypoints in order and back again, turning when something blocks it,
  // and never dodges or chases. `leg` is the waypoint it heads for.
  patrol?: MonsterPatrol;
  // Milliseconds per step, in place of its kind's pace.
  moveMs?: number;
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
  sourceName?: string;
  sourceAbility?: string;
  // Lethal window at the end of the hazard's life. Missing means the boss
  // split, where the warning is 70% of the lifetime.
  activeMs?: number;
}

export interface ExplosionCell {
  x: number;
  y: number;
  ticksRemaining: number;
  kind?: BombKind;
  ownerId?: string;
  // Players and monsters the blast already resolved when it ignited. Anyone
  // else who walks into the lingering flame is caught by it.
  sparedIds?: string[];
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

// One piece of a route puzzle (see engine/campaignPuzzles.ts).
export interface CampaignPuzzleElementState {
  id: string;
  label: string;
  role: CampaignPuzzleRole;
  // Where the piece stands. A carried keystone keeps its bed here.
  x: number;
  y: number;
  order?: number;
  pair?: number;
  flips?: string[];
  // Lit, toppled, raised, struck, delivered: the piece's done state.
  on: boolean;
  // Engine tick at which `on` lapses (a pylon re-ties, a beacon burns out,
  // a struck ward relights). Missing while on means it holds.
  untilTick?: number;
  // A player stands on it: stepping pieces react when this turns true.
  pressed?: boolean;
  // The player carrying this keystone.
  carriedBy?: string;
}

export interface CampaignPuzzleState {
  kind: CampaignPuzzleKind;
  unit: string;
  rule: string;
  ruleShort: string;
  // The mission difficulty's rules, fixed when the mission starts.
  tuning: CampaignPuzzleTuning;
  elements: CampaignPuzzleElementState[];
  progress: number;
  total: number;
  solved: boolean;
  // Wrong orders, re-tied pylons, burnt-out beacons: times the puzzle undid itself.
  setbacks: number;
  // Lever pulls since the spans last dropped (toggle).
  pulls?: number;
  // Tick by which a timed order must be finished (sequence on Hard).
  deadlineTick?: number;
  // Campaign lives when last checked, to notice a fall (carry).
  livesSeen?: number;
  // Shown instead of the objective hint until the given tick.
  notice?: string;
  noticeUntilTick?: number;
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
  miniBossGuardId?: string;
  miniBossSpawned?: boolean;
  puzzle?: CampaignPuzzleState;
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

export interface CampaignWaveUnitPlan {
  archetype: EnemyArchetype;
  entryId: string;
  // Set for the wave's captain: its title, shown as the enemy's name.
  eliteLabel?: string;
}

export interface CampaignWavePlan {
  id: string;
  label: string;
  // Quiet time before this wave arrives (after the previous one did).
  breatherMs: number;
  units: CampaignWaveUnitPlan[];
  // The entries it uses, in first-use order: these are telegraphed.
  entryIds: string[];
}

// Scripted defense waves (engine/campaignWaves.ts), resolved for the
// difficulty, the village event and the match seed when the match starts.
// Times are on the defense clock: ms since the defense objective began.
export interface CampaignWaveRuntimeState {
  scriptId: string;
  objectiveId: CampaignObjectiveId;
  entries: CampaignWaveEntryDefinition[];
  waves: CampaignWavePlan[];
  telegraphMs: number;
  maxActive: number;
  leashRadius: number;
  eventNote?: string;
  // How many waves of this seal run have arrived (a fallen seal restarts).
  opened: number;
  // When the next wave is due.
  dueAtMs: number;
  // Its spawn points are marked.
  telegraphing: boolean;
  // It is due, but waits until enough wave enemies are down (maxActive).
  held: boolean;
  // Wave enemies still alive.
  activeMonsterIds: string[];
  run: number;
  // The defense ended: survivors were released to patrol.
  finished: boolean;
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
  event: CampaignEventDefinition | null;
  structures: CampaignStructureState[];
  miniBossGateLabel: string;
  bossGateLabel: string;
  bossArena: CampaignBossArenaState;
  objectives: CampaignObjectiveState[];
  bossUnlocked: boolean;
  message: string;
  difficulty?: DifficultyId;
  // Lives left in this mission, the current one included. A fall with more
  // than one left regroups at the last cleared objective.
  livesRemaining?: number;
  livesTotal?: number;
  // Shown instead of the objective hint until the given tick after a fall.
  fallNotice?: string;
  fallNoticeUntilTick?: number;
  // Scripted waves for the defense objective; missing without a script.
  waves?: CampaignWaveRuntimeState | null;
}

export type CellVisibility = 'hidden' | 'explored' | 'visible';

export interface FogOfWarState {
  visible: string[];
  explored: string[];
  sensedEnemies: string[];
  sensedWalls: string[];
}

// Who plays each slot in Local Arena: a human at that slot's keys, or a CPU
// at one of three levels. A missing list (or entry) means human, so configs
// and replays from before CPU players load and play exactly as they did.
export type PlayerSlotController = 'human' | 'cpu-easy' | 'cpu-normal' | 'cpu-hard';

// Training Dojo rooms. A room ends as soon as every goal holds at once
// (cleared) or its player falls (failed).
export type TrainingGoal =
  // Stand on this cell.
  | { kind: 'reach'; x: number; y: number }
  // These crates are broken.
  | { kind: 'breakCrates'; cells: Point[] }
  // Every training charge has gone off.
  | { kind: 'outlastCharges' }
  // The pickups on these cells are taken.
  | { kind: 'collect'; cells: Point[] }
  // No enemy is left.
  | { kind: 'defeatAll' };

// A bomb lit before the room starts (owned by no player), so the room can
// show a blast the player did not set.
export interface TrainingCharge {
  x: number;
  y: number;
  range: number;
  fuseMs: number;
}

export interface TrainingSentry {
  id: string;
  name: string;
  route: Point[];
  moveMs: number;
}

export interface TrainingSetup {
  roomId: string;
  goals: TrainingGoal[];
  charges?: TrainingCharge[];
  sentries?: TrainingSentry[];
}

export interface GameConfig {
  mode?: GameMode;
  numPlayers: number;
  totalRounds: number;
  selectedMap: string;
  map: GameMap;
  stageId?: StageId;
  selectedCharacters?: CharacterId[];
  // Optional display names for remote seats. Local modes use character names.
  playerNames?: string[];
  selectedUpgrade?: StoryUpgradeId;
  // Seeds the match's random draws (power-up drops). Missing means the fixed
  // default seed, so recorded configs always replay the same way.
  seed?: number;
  // Campaign difficulty; missing means Normal. Versus ignores it.
  difficulty?: DifficultyId;
  // Per-slot controllers for Local Arena (see PlayerSlotController). The
  // reducer never reads it: CPU players act through ordinary actions.
  controllers?: PlayerSlotController[];
  // Training mode only: the room's goals, charges and sentries.
  training?: TrainingSetup;
  // Solo campaign only: hub consumables packed for this mission and the
  // permanent upgrade ranks (campaignLoadout.ts). Missing means none.
  loadout?: CampaignLoadout;
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
  roundStartTicksRemaining: number;
  // Campaign boss intro (BOSS_INTRO_MS) still to run: the arena is frozen
  // while it is above 0. Set once, when the boss appears; missing means 0.
  bossIntroMsRemaining?: number;
  rngSeed: number;
  // Live round time, used by versus sudden death.
  roundElapsedMs: number;
  pressureBlocksPlaced: number;
  config: GameConfig;
  roundProcessed: boolean;
}
