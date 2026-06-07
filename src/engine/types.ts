import { GameMap, Power } from '../model/gameItem';
import {
  BossId, CharacterId, GameMode, StageId,
} from '../content/types';
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

export interface DestroyedBox {
  x: number;
  y: number;
  ticksRemaining: number;
  pendingPowerUp: Power | null;
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
  boss: BossState | null;
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

export interface Point {
  x: number;
  y: number;
}
