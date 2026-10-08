/* eslint-disable comma-dangle */
import { GameMap } from '../model/gameItem';
import {
  GameConfig, GameEngineState, MonsterState, PlayerState,
} from './types';
import { PLAYER_COLORS, PLAYER_SPAWNS } from './constants';
import { getMonstersForMap } from './monsterSpawns';
import { resetBombIdCounter } from './bombs';
import { resetBossHazardIdCounter } from './bosses';
import { getDetectionRange, resetMonsterHazardIdCounter } from './monsters';
import {
  DEFAULT_CHARACTER_ID,
  STAGE_DEFINITIONS,
  getBossDefinition,
  getCharacterDefinition,
  getStageDefinition,
} from '../content';
import { withUpdatedFogOfWar } from './fogOfWar';
import { createCampaignRuntimeState } from './campaignObjectives';
import { initializeCampaignEnemies } from './campaignEnemies';
import { normalizeSeed } from './random';
import { getMatchDifficulty } from './difficulty';

const PLAYER_NAMES = ['player1', 'player2', 'player3'];
const ULTIMATE_COOLDOWN_MS = 12000;
export const ROUND_START_COUNTDOWN_MS = 3000;
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

// The versus monster tables were laid out for the 15x10 arenas. On the 35x35
// stage maps some of those cells are pillars or crates, or sit right beside a
// spawn, so one player is hunted from the first second while the others are
// not. Such a monster starts on the nearest cell it can stand on that is out
// of its detection range of every spawn.
const MONSTER_PLACEMENT_STEPS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function canMonsterStartAt(
  map: GameMap,
  monster: MonsterState,
  x: number,
  y: number,
  players: PlayerState[],
  taken: Set<string>
): boolean {
  const cell = map[y]?.[x];
  if (cell === undefined || isBoundaryCell(map, x, y) || taken.has(`${x},${y}`)) return false;
  // Ghosts drift through crates, like their movement rules allow.
  const standable = monster.kind === 'ghost' ? cell !== 'Wall' : cell === 'Empty';
  const detectionRange = getDetectionRange(monster);
  return standable && players.every((player) => (
    Math.abs(player.x - x) + Math.abs(player.y - y) > detectionRange
  ));
}

function placeVersusMonsters(
  monsters: MonsterState[],
  map: GameMap,
  players: PlayerState[]
): MonsterState[] {
  const taken = new Set(monsters.map((monster) => `${monster.x},${monster.y}`));
  return monsters.map((monster) => {
    taken.delete(`${monster.x},${monster.y}`);
    const queue = [{ x: monster.x, y: monster.y }];
    const seen = new Set([`${monster.x},${monster.y}`]);
    for (let index = 0; index < queue.length; index += 1) {
      const { x, y } = queue[index];
      if (canMonsterStartAt(map, monster, x, y, players, taken)) {
        taken.add(`${x},${y}`);
        return x === monster.x && y === monster.y ? monster : { ...monster, x, y };
      }
      MONSTER_PLACEMENT_STEPS.forEach((step) => {
        const next = { x: x + step.x, y: y + step.y };
        const key = `${next.x},${next.y}`;
        if (!seen.has(key) && map[next.y]?.[next.x] !== undefined) {
          seen.add(key);
          queue.push(next);
        }
      });
    }
    taken.add(`${monster.x},${monster.y}`);
    return monster;
  });
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
  const stageIndex = Math.max(
    0,
    STAGE_DEFINITIONS.findIndex((item) => item.id === stage.id)
  );
  // Bombs now hit the boss once each (not once per blast cell), so health is
  // tuned for roughly 7 signature-bomb hits on the first stage and 12 on the
  // last, scaled by the campaign difficulty (rounded to 10s).
  const maxHealth = Math.round(
    ((520 + stageIndex * 60) * getMatchDifficulty(config).bossHealthScale) / 10
  ) * 10;
  return {
    id: boss.id,
    name: boss.name,
    x: spawn.x,
    y: spawn.y,
    health: maxHealth,
    maxHealth,
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
  resetBossHazardIdCounter();
  resetMonsterHazardIdCounter();
  const players = Array.from({ length: config.numPlayers }, (_, i) => createPlayer(i, config));
  const map = createSpawnSafeMap(config.map, players);
  const campaignRuntime = createCampaignRuntimeState(config);
  const {
    campaign,
    monsters: campaignMonsters,
  } = initializeCampaignEnemies(campaignRuntime, map);

  const state: GameEngineState = {
    map,
    players,
    monsters: config.mode === 'solo'
      ? campaignMonsters
      : placeVersusMonsters(
        getMonstersForMap(config.selectedMap, config.numPlayers),
        map,
        players
      ),
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
    roundStartTicksRemaining: ROUND_START_COUNTDOWN_MS,
    rngSeed: normalizeSeed(config.seed),
    roundElapsedMs: 0,
    pressureBlocksPlaced: 0,
    config: { ...config, map },
    roundProcessed: false,
  };

  return withUpdatedFogOfWar(state);
}

export function resetRoundState(state: GameEngineState): GameEngineState {
  resetBombIdCounter();
  resetBossHazardIdCounter();
  resetMonsterHazardIdCounter();
  const players = Array.from(
    { length: state.config.numPlayers },
    (_, i) => createPlayer(i, state.config),
  );
  const map = createSpawnSafeMap(state.config.map, players);
  const campaignRuntime = createCampaignRuntimeState(state.config);
  const {
    campaign,
    monsters: campaignMonsters,
  } = initializeCampaignEnemies(campaignRuntime, map);

  const next: GameEngineState = {
    ...state,
    map,
    players,
    monsters: state.config.mode === 'solo'
      ? campaignMonsters
      : placeVersusMonsters(
        getMonstersForMap(state.config.selectedMap, state.config.numPlayers),
        map,
        players
      ),
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
    roundStartTicksRemaining: ROUND_START_COUNTDOWN_MS,
    roundElapsedMs: 0,
    pressureBlocksPlaced: 0,
  };

  return withUpdatedFogOfWar(next);
}
