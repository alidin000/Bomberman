/* eslint-disable comma-dangle */
import { GameMap } from '../model/gameItem';
import { GameConfig, GameEngineState, PlayerState } from './types';
import { PLAYER_COLORS, PLAYER_SPAWNS } from './constants';
import { getMonstersForMap } from './monsterSpawns';
import { resetBombIdCounter } from './bombs';
import {
  DEFAULT_CHARACTER_ID,
  getBossDefinition,
  getCharacterDefinition,
  getStageDefinition,
} from '../content';
import { withUpdatedFogOfWar } from './fogOfWar';
import { createCampaignRuntimeState } from './campaignObjectives';

const PLAYER_NAMES = ['player1', 'player2', 'player3'];
const ULTIMATE_COOLDOWN_MS = 12000;
const SPAWN_CLEAR_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function createPlayer(index: number, config: GameConfig): PlayerState {
  const spawn = PLAYER_SPAWNS[index];
  const characterId = config.selectedCharacters?.[index] ?? DEFAULT_CHARACTER_ID;
  const character = getCharacterDefinition(characterId);
  const isClayArtist = character.id === 'deidara';
  const extraBombs = config.selectedUpgrade === 'extraClay' ? 1 : 0;
  const extraRange = config.selectedUpgrade === 'blastTraining' ? 1 : 0;
  const ultimateCooldown = config.selectedUpgrade === 'quickUltimate'
    ? ULTIMATE_COOLDOWN_MS * 0.75
    : ULTIMATE_COOLDOWN_MS;
  return {
    id: PLAYER_NAMES[index],
    name: character.name,
    x: spawn.x,
    y: spawn.y,
    alive: true,
    maxBombs: (isClayArtist ? 2 : 1) + extraBombs,
    activeBombs: 0,
    bombRange: (isClayArtist ? 3 : 2) + extraRange,
    powerUps: character.id === 'minato' ? ['RollerSkate'] : [],
    obstacles: 0,
    color: character.primaryColor || PLAYER_COLORS[index],
    characterId: character.id,
    ultimateCooldown,
    ultimateCooldownRemaining: 0,
    ultimateCharge: 100,
    facing: index === 1 ? 'left' : 'right',
    passiveState: character.passive,
  };
}

function isBoundaryCell(map: GameMap, x: number, y: number): boolean {
  return y <= 0 || y >= map.length - 1 || x <= 0 || x >= map[0].length - 1;
}

function createSpawnSafeMap(map: GameMap, players: PlayerState[]): GameMap {
  const next = map.map((row) => [...row]);
  players.forEach((player) => {
    SPAWN_CLEAR_OFFSETS.forEach((offset) => {
      const x = player.x + offset.x;
      const y = player.y + offset.y;
      if (next[y]?.[x] && !isBoundaryCell(next, x, y)) {
        next[y][x] = 'Empty';
      }
    });
  });
  return next;
}

function getBossSpawn(config: GameConfig): { x: number; y: number } {
  const centerX = Math.floor(config.map[0].length / 2);
  const centerY = Math.floor(config.map.length / 2);
  const candidates = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX + 1, y: centerY },
    { x: centerX, y: centerY - 1 },
    { x: centerX, y: centerY + 1 },
    { x: centerX - 2, y: centerY },
    { x: centerX + 2, y: centerY },
  ];

  return candidates.find(({ x, y }) => config.map[y]?.[x] === 'Empty')
    ?? { x: centerX, y: centerY };
}

export function createBossForConfig(config: GameConfig): GameEngineState['boss'] {
  if (config.mode !== 'solo') return null;
  const stage = getStageDefinition(config.stageId);
  const boss = getBossDefinition(stage.bossId);
  const spawn = getBossSpawn(config);
  return {
    id: boss.id,
    name: boss.name,
    x: spawn.x,
    y: spawn.y,
    health: 900,
    maxHealth: 900,
    phase: 1,
    attackCooldown: 1200,
    moveCooldown: 650,
    currentAbility: boss.attacks[0],
    color: boss.color,
    tails: boss.tails,
  };
}

export function createInitialState(config: GameConfig): GameEngineState {
  resetBombIdCounter();
  const players = Array.from({ length: config.numPlayers }, (_, i) => createPlayer(i, config));
  const map = createSpawnSafeMap(config.map, players);
  const campaign = createCampaignRuntimeState(config);

  const state: GameEngineState = {
    map,
    players,
    monsters: config.mode === 'solo'
      ? []
      : getMonstersForMap(config.selectedMap, config.numPlayers),
    bombs: [],
    explosions: [],
    destroyedBoxes: [],
    timedPowerUps: {},
    pickupMessages: [],
    campaign,
    boss: campaign && !campaign.bossUnlocked
      ? null
      : createBossForConfig({ ...config, map }),
    fogOfWar: {
      visible: [],
      explored: [],
      sensedEnemies: [],
      sensedWalls: [],
    },
    hazards: [],
    round: 1,
    totalRounds: config.totalRounds,
    roundWinners: [],
    phase: 'playing',
    resultMessage: '',
    paused: false,
    tick: 0,
    config: { ...config, map },
    roundProcessed: false,
  };

  return withUpdatedFogOfWar(state);
}

export function resetRoundState(state: GameEngineState): GameEngineState {
  resetBombIdCounter();
  const players = Array.from(
    { length: state.config.numPlayers },
    (_, i) => createPlayer(i, state.config),
  );
  const map = createSpawnSafeMap(state.config.map, players);
  const campaign = createCampaignRuntimeState(state.config);

  const next: GameEngineState = {
    ...state,
    map,
    players,
    monsters: state.config.mode === 'solo'
      ? []
      : getMonstersForMap(state.config.selectedMap, state.config.numPlayers),
    bombs: [],
    explosions: [],
    destroyedBoxes: [],
    timedPowerUps: {},
    pickupMessages: [],
    campaign,
    boss: campaign && !campaign.bossUnlocked
      ? null
      : createBossForConfig({ ...state.config, map }),
    fogOfWar: {
      visible: [],
      explored: [],
      sensedEnemies: [],
      sensedWalls: [],
    },
    hazards: [],
    phase: 'playing',
    resultMessage: '',
    roundProcessed: false,
    paused: false,
  };

  return withUpdatedFogOfWar(next);
}
