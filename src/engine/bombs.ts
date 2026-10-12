/* eslint-disable no-use-before-define */
/* eslint-disable prefer-destructuring, comma-dangle, object-curly-newline, prefer-const */
import {
  Bomb, GameMap, GenericPower, genericPowerUpOptions, isBomb, isObstacle,
} from '../model/gameItem';
import {
  BombState, DestroyedBox, ExplosionCell, GameEngineState, PlayerState,
} from './types';
import {
  BOMB_FUSE_MS, BOX_DESTROY_MS, EXPLOSION_MS,
} from './constants';
import { applyCharacterSurvival, isPowerUpActive } from './players';
import {
  FLAME_HURT_RADIUS, getCell, getPlayerCell, positionOverlapsCell,
} from './grid';
import {
  getCampaignDestructionOutcome,
  resolveCampaignDestroyedBox,
} from './campaignExploration';
import { WeightedEntry, nextRandom, pickWeighted } from './random';
import {
  CARDINAL_DIRECTIONS,
  getShadowCloneBarragePositions,
  getShadowCloneBlocks,
} from './characterAbilities';

let bombIdCounter = 0;

// Not every crate hides an item. When one does, every shared category has the
// same odds for every fighter; in particular, basic and ultimate range are 50/50.
export const BOX_DROP_CHANCE = 0.45;
export const BOX_DROP_TABLE: readonly WeightedEntry<GenericPower>[] = genericPowerUpOptions
  .map((item) => ({ item, weight: 1 }));

function rollBoxDrop(seed: number): { power: GenericPower | null; seed: number } {
  const chance = nextRandom(seed);
  if (chance.value >= BOX_DROP_CHANCE) return { power: null, seed: chance.seed };
  const pick = nextRandom(chance.seed);
  return { power: pickWeighted(BOX_DROP_TABLE, pick.value), seed: pick.seed };
}

const BASIC_BOMBS: Record<PlayerState['characterId'], BombState['kind']> = {
  deidara: 'claySpider',
  naruto: 'shadowClone',
  sasuke: 'chidoriMine',
  gaara: 'sandCoffin',
  minato: 'thunderMark',
  itachi: 'crowClone',
};

const ULTIMATE_BOMBS: Record<PlayerState['characterId'], BombState['kind']> = {
  deidara: 'giantClay',
  naruto: 'shadowCloneBarrage',
  sasuke: 'kirin',
  gaara: 'sandTsunami',
  minato: 'instantTeleport',
  itachi: 'tsukuyomi',
};

// Ultimate reach has its own baseline, so BlastRangeUp cannot silently scale
// both bomb families. UltimateRangeUp is the only pickup that changes it.
const ULTIMATE_BASE_RANGES: Record<PlayerState['characterId'], number> = {
  deidara: 6,
  naruto: 5,
  sasuke: 5,
  gaara: 5,
  minato: 3,
  itachi: 5,
};

export function resetBombIdCounter(): void {
  bombIdCounter = 0;
}

export function createBomb(
  ownerId: string,
  x: number,
  y: number,
  range: number,
  manualDetonation = false,
  kind: BombState['kind'] = 'standard',
  ticksRemaining = BOMB_FUSE_MS,
): BombState {
  bombIdCounter += 1;
  return {
    id: `bomb-${bombIdCounter}`,
    ownerId,
    x,
    y,
    range,
    ticksRemaining,
    manualDetonation,
    kind,
    ageMs: 0,
    movementCooldownMs: kind === 'giantClay' ? 850 : undefined,
  };
}

function getBombFuse(kind: BombState['kind']): number {
  const fuseByKind: Partial<Record<BombState['kind'], number>> = {
    claySpider: 2600,
    shadowClone: 2800,
    shadowCloneBarrage: 2800,
    chidoriMine: 1800,
    sandCoffin: 3300,
    thunderMark: 1500,
    crowClone: 2400,
    giantClay: 2600,
    rasenshuriken: 2400,
    kirin: 2100,
    sandTsunami: 2600,
    instantTeleport: 1700,
    tsukuyomi: 2300,
  };
  return fuseByKind[kind] ?? BOMB_FUSE_MS;
}

function getBasicBombRange(player: PlayerState, kind: BombState['kind']): number {
  const bonusByKind: Partial<Record<BombState['kind'], number>> = {
    claySpider: 1,
    chidoriMine: 1,
    thunderMark: 0,
    sandCoffin: 0,
    crowClone: 0,
    shadowClone: 0,
  };
  return player.bombRange + (bonusByKind[kind] ?? 0);
}

function getBasicBombPlacements(
  state: GameEngineState,
  player: PlayerState,
  kind: BombState['kind'],
  hasDetonator: boolean,
): BombState[] {
  const origin = getPlayerCell(player);
  const bombs = [
    createBomb(
      player.id,
      origin.x,
      origin.y,
      getBasicBombRange(player, kind),
      hasDetonator,
      kind,
      getBombFuse(kind),
    ),
  ];

  // Live placements derive ids from room state, so two server rooms cannot
  // reset or advance one another's module-level helper counter.
  return bombs.map((bomb, index) => ({
    ...bomb,
    id: `bomb-${state.tick}-${player.id}-${bomb.kind}-${state.bombs.length + index}`,
  }));
}

export function getExplosionPositions(bomb: BombState, map: GameMap): { x: number; y: number }[] {
  if (bomb.kind === 'shadowCloneBarrage') {
    return getShadowCloneBarragePositions(bomb, map);
  }
  const positions: { x: number; y: number }[] = [{ x: bomb.x, y: bomb.y }];
  const { x, y, range } = bomb;
  const h = map.length;
  const w = map[0].length;

  const addRay = (dx: number, dy: number) => {
    for (let i = 1; i <= range; i += 1) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) break;
      const cell = map[ny][nx];
      if (cell === 'Wall') break;
      positions.push({ x: nx, y: ny });
      if ((cell === 'Box' || isObstacle(cell)) && bomb.kind !== 'chidoriMine') break;
    }
  };

  addRay(0, -1);
  addRay(0, 1);
  addRay(-1, 0);
  addRay(1, 0);

  if (bomb.kind === 'shadowClone'
    || bomb.kind === 'crowClone'
    || bomb.kind === 'rasenshuriken') {
    [
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ].forEach(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && map[ny][nx] !== 'Wall') {
        positions.push({ x: nx, y: ny });
      }
    });
  }

  if (bomb.kind === 'sandCoffin'
    || bomb.kind === 'giantClay'
    || bomb.kind === 'sandTsunami'
    || bomb.kind === 'tsukuyomi'
    || bomb.kind === 'rasenshuriken') {
    const radius = [
      'giantClay', 'sandTsunami', 'tsukuyomi', 'rasenshuriken',
    ].includes(bomb.kind)
      ? 2
      : 1;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const inShape = Math.abs(dx) + Math.abs(dy) <= radius + 1;
        const nx = x + dx;
        const ny = y + dy;
        if (inShape && nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && map[ny][nx] !== 'Wall') {
          positions.push({ x: nx, y: ny });
        }
      }
    }
  }

  if (bomb.kind === 'kirin') {
    for (let nx = 1; nx < w - 1; nx += 1) {
      if (map[y][nx] !== 'Wall') positions.push({ x: nx, y });
    }
    for (let ny = 1; ny < h - 1; ny += 1) {
      if (map[ny][x] !== 'Wall') positions.push({ x, y: ny });
    }
  }

  if (bomb.kind === 'thunderMark' || bomb.kind === 'instantTeleport') {
    const skip = bomb.kind === 'instantTeleport' ? 2 : 1;
    [
      { dx: 0, dy: -skip },
      { dx: 0, dy: skip },
      { dx: -skip, dy: 0 },
      { dx: skip, dy: 0 },
    ].forEach(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && map[ny][nx] !== 'Wall') {
        positions.push({ x: nx, y: ny });
      }
    });
  }

  if (bomb.kind === 'instantTeleport') {
    [
      { dx: -2, dy: -2 },
      { dx: 2, dy: -2 },
      { dx: -2, dy: 2 },
      { dx: 2, dy: 2 },
    ].forEach(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && map[ny][nx] !== 'Wall') {
        positions.push({ x: nx, y: ny });
      }
    });
  }
  return positions;
}

function getCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function dedupePositions(positions: { x: number; y: number }[]): { x: number; y: number }[] {
  const seen = new Set<string>();
  return positions.filter(({ x, y }) => {
    const key = getCellKey(x, y);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cellHasBomb(map: GameMap, x: number, y: number): Bomb | null {
  const cell = map[y][x];
  return isBomb(cell) ? cell : null;
}

export function placeBomb(state: GameEngineState, playerId: string): GameEngineState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return state;
  const hasDetonator = player.powerUps.includes('Detonator');
  const origin = getPlayerCell(player);
  const currentCell = getCell(state.map, origin);

  const bombLimit = player.maxBombs;
  if (player.activeBombs >= bombLimit) return state;
  if (currentCell !== 'Empty') return state;

  const kind = BASIC_BOMBS[player.characterId];
  const bombs = getBasicBombPlacements(state, player, kind, hasDetonator);
  const allowedBombs = bombs.slice(0, bombLimit - player.activeBombs);
  if (allowedBombs.length === 0) return state;

  const newMap = state.map.map((row) => [...row]);
  allowedBombs.forEach((bomb) => {
    newMap[bomb.y][bomb.x] = {
      range: bomb.range,
      coords: { x: bomb.x, y: bomb.y },
      ownerId: playerId,
    };
  });

  const players = state.players.map((p) => (
    p.id === playerId ? { ...p, activeBombs: p.activeBombs + allowedBombs.length } : p
  ));

  return {
    ...state,
    map: newMap,
    bombs: [...state.bombs, ...allowedBombs],
    players,
  };
}

export function placeTeleportMarker(
  state: GameEngineState,
  playerId: string,
): GameEngineState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player?.alive || player.characterId !== 'minato') return state;
  const origin = getPlayerCell(player);
  if (getCell(state.map, origin) !== 'Empty') return state;
  return {
    ...state,
    players: state.players.map((candidate) => (
      candidate.id === playerId ? { ...candidate, teleportMark: origin } : candidate
    )),
  };
}

export function placeUltimateBomb(state: GameEngineState, playerId: string): GameEngineState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return state;
  if (player.ultimateCooldownRemaining > 0) return state;
  const origin = player.characterId === 'minato'
    ? player.teleportMark ?? getPlayerCell(player)
    : getPlayerCell(player);
  if (getCell(state.map, origin) !== 'Empty') return state;

  const created = createBomb(
    playerId,
    origin.x,
    origin.y,
    ULTIMATE_BASE_RANGES[player.characterId] + (player.ultimateRangeBonus ?? 0),
    false,
    ULTIMATE_BOMBS[player.characterId],
    getBombFuse(ULTIMATE_BOMBS[player.characterId]),
  );
  const bomb = {
    ...created,
    id: `bomb-${state.tick}-${player.id}-${created.kind}-${state.bombs.length}`,
    ultimateRangeBonus: player.ultimateRangeBonus ?? 0,
  };
  const newMap = state.map.map((row) => [...row]);
  newMap[origin.y][origin.x] = {
    range: bomb.range,
    coords: { x: bomb.x, y: bomb.y },
    ownerId: playerId,
  };
  const players = state.players.map((p) => (
    p.id === playerId
      ? {
        ...p,
        activeBombs: p.activeBombs + 1,
        teleportMark: player.characterId === 'minato' ? undefined : p.teleportMark,
        ultimateCooldownRemaining: p.ultimateCooldown,
        ultimateCharge: 0,
      }
      : p
  ));

  return {
    ...state,
    map: newMap,
    bombs: [...state.bombs, bomb],
    players,
  };
}

/**
 * What DROP_BOMB (or USE_ULTIMATE) would place right now, and where its owner
 * would then stand (Minato's ultimate teleports), without placing anything.
 * CPU players plan their escape with it. The id counter is restored, so this
 * look-ahead never shifts the ids a replay of the same actions produces.
 */
export function previewPlayerBombs(
  state: GameEngineState,
  playerId: string,
  ultimate = false
): { bombs: BombState[]; owner: PlayerState } | null {
  const savedCounter = bombIdCounter;
  const next = ultimate ? placeUltimateBomb(state, playerId) : placeBomb(state, playerId);
  bombIdCounter = savedCounter;
  if (next === state) return null;
  const owner = next.players.find((p) => p.id === playerId);
  return owner ? { bombs: next.bombs.slice(state.bombs.length), owner } : null;
}

function getBombDeathLabel(kind: BombState['kind']): string {
  const labels: Record<BombState['kind'], string> = {
    standard: 'bomb',
    claySpider: 'Clay Spider',
    shadowClone: 'Shadow Clone',
    shadowCloneBarrage: 'Shadow Clone Barrage',
    chidoriMine: 'Chidori Mine',
    sandCoffin: 'Sand Coffin',
    thunderMark: 'Flying Thunder Mark',
    crowClone: 'Crow Clone',
    giantClay: 'C3 Giant Clay',
    rasenshuriken: 'Rasenshuriken',
    kirin: 'Kirin',
    sandTsunami: 'Sand Tsunami',
    instantTeleport: 'Flying Thunder God',
    tsukuyomi: 'Tsukuyomi',
  };
  return labels[kind];
}

function formatBombDeathReason(
  player: PlayerState,
  owner: PlayerState | undefined,
  bomb: BombState
): string {
  const label = getBombDeathLabel(bomb.kind);
  if (owner?.id === player.id) {
    return `${player.name} was caught in their own ${label} blast.`;
  }
  if (owner) {
    return `${player.name} was caught in ${owner.name}'s ${label} blast.`;
  }
  return `${player.name} was caught in a ${label} blast.`;
}

const CHIP_DAMAGE_ULTIMATES = new Set<BombState['kind']>([
  'sandTsunami', 'kirin', 'tsukuyomi',
]);

function getUltimateOuterPositions(
  bomb: BombState,
  core: { x: number; y: number }[],
  map: GameMap,
): { x: number; y: number }[] {
  if (!CHIP_DAMAGE_ULTIMATES.has(bomb.kind)) return [];
  const coreKeys = new Set(core.map(({ x, y }) => getCellKey(x, y)));
  const perimeterWidth = bomb.kind === 'kirin'
    ? 1 + (bomb.ultimateRangeBonus ?? 0)
    : 1;
  const perimeter = core.flatMap(({ x, y }) => CARDINAL_DIRECTIONS.flatMap((direction) => (
    Array.from({ length: perimeterWidth }, (_, index) => ({
      x: x + direction.x * (index + 1),
      y: y + direction.y * (index + 1),
    }))
  )));
  return dedupePositions(perimeter).filter((point) => (
    map[point.y]?.[point.x] !== undefined
    && map[point.y][point.x] !== 'Wall'
    && !coreKeys.has(getCellKey(point.x, point.y))
  ));
}

function applyUltimateChipDamage(
  state: GameEngineState,
  player: PlayerState,
  owner: PlayerState | undefined,
  bomb: BombState,
): PlayerState {
  if (!player.alive || isPowerUpActive(state, player.id, 'Invincibility')) return player;
  const health = Math.max(0, (player.health ?? player.maxHealth ?? 3) - 1);
  if (health > 0) return { ...player, health };
  const label = getBombDeathLabel(bomb.kind);
  const reason = owner?.id === player.id
    ? `${player.name} was defeated by their own ${label} outer attack.`
    : `${player.name} was defeated by ${owner?.name ?? 'an opponent'}'s ${label} outer attack.`;
  const resolved = applyCharacterSurvival(
    { ...player, health: 0 },
    reason,
    { kind: 'blast', byPlayerId: owner?.id, bombKind: bomb.kind }
  );
  return resolved.alive ? { ...resolved, health: 1 } : resolved;
}

function getBossDamage(kind: BombState['kind']): number {
  const damageByKind: Partial<Record<BombState['kind'], number>> = {
    claySpider: 90,
    shadowClone: 70,
    shadowCloneBarrage: 150,
    chidoriMine: 95,
    sandCoffin: 60,
    thunderMark: 65,
    crowClone: 55,
    giantClay: 180,
    rasenshuriken: 150,
    kirin: 190,
    sandTsunami: 135,
    instantTeleport: 120,
    tsukuyomi: 110,
  };
  return damageByKind[kind] ?? 80;
}

function applyBossBombEffect(
  boss: NonNullable<GameEngineState['boss']>,
  bomb: BombState,
): NonNullable<GameEngineState['boss']> {
  const damage = getBossDamage(bomb.kind);
  const crowdControl = ['sandCoffin', 'sandTsunami', 'crowClone', 'tsukuyomi']
    .includes(bomb.kind);
  return {
    ...boss,
    health: Math.max(0, boss.health - damage),
    phase: boss.health - damage <= boss.maxHealth / 2 ? 2 : boss.phase,
    attackCooldown: crowdControl
      ? boss.attackCooldown + 900
      : Math.max(900, boss.attackCooldown - 80),
    moveCooldown: crowdControl
      ? boss.moveCooldown + 700
      : boss.moveCooldown,
    currentAbility: crowdControl ? 'Stunned by special bomb' : boss.currentAbility,
  };
}

export function detonatePlayerBombs(state: GameEngineState, playerId: string): GameEngineState {
  const playerBombs = state.bombs.filter(
    (bomb) => bomb.ownerId === playerId && bomb.manualDetonation
  );
  if (playerBombs.length === 0) return state;

  let next = explodeBombs(state, playerBombs);
  const players = next.players.map((p) => (
    p.id === playerId
      ? { ...p, powerUps: p.powerUps.filter((pw) => pw !== 'Detonator') }
      : p
  ));
  return { ...next, players };
}

export function explodeBombs(
  state: GameEngineState,
  bombsToExplode: BombState[],
  explosionRaycastMap: GameMap = state.map,
): GameEngineState {
  if (bombsToExplode.length === 0) return state;

  let map = state.map.map((row) => [...row]);
  let players = [...state.players];
  let monsters = [...state.monsters];
  let boss = state.boss ? { ...state.boss } : null;
  let explosions: ExplosionCell[] = [...state.explosions];
  let destroyedBoxes: DestroyedBox[] = [...state.destroyedBoxes];
  const explodedIds = new Set(bombsToExplode.map((b) => b.id));
  let remainingBombs = state.bombs.filter((b) => !explodedIds.has(b.id));
  const remainingBombsByCell = new Map(
    remainingBombs.map((bomb) => [getCellKey(bomb.x, bomb.y), bomb])
  );
  const chainedIds = new Set<string>();
  const chainBombs: BombState[] = [];
  const explosionKeys = new Set(explosions.map((e) => getCellKey(e.x, e.y)));
  const ownerBombCounts = new Map<string, number>();
  const raycastMap = explosionRaycastMap.map((row) => [...row]);
  let { rngSeed } = state;

  bombsToExplode.forEach((bomb) => {
    ownerBombCounts.set(
      bomb.ownerId,
      (ownerBombCounts.get(bomb.ownerId) ?? 0) + 1
    );
  });

  if (ownerBombCounts.size > 0) {
    players = players.map((p) => {
      const explodedCount = ownerBombCounts.get(p.id) ?? 0;
      if (explodedCount === 0) return p;
      return {
        ...p,
        activeBombs: Math.max(0, p.activeBombs - explodedCount),
      };
    });
  }

  bombsToExplode.forEach((bomb) => {
    map[bomb.y][bomb.x] = 'Empty';
    const owner = players.find((player) => player.id === bomb.ownerId);
    let bossWasHit = false;

    const positions = dedupePositions(getExplosionPositions(bomb, raycastMap));
    positions.forEach(({ x, y }) => {
      const key = getCellKey(x, y);
      const sparedIds = [
        ...players
          .filter((p) => p.alive && positionOverlapsCell(p, x, y, FLAME_HURT_RADIUS))
          .map((p) => p.id),
        ...monsters.filter((m) => m.x === x && m.y === y).map((m) => m.id),
      ];
      if (!explosionKeys.has(key)) {
        explosionKeys.add(key);
        explosions.push({
          x,
          y,
          ticksRemaining: EXPLOSION_MS,
          kind: bomb.kind,
          ownerId: bomb.ownerId,
          sparedIds,
        });
      } else {
        // A second blast through a burning cell restarts the flame there, so
        // only those this blast resolved are spared by the restarted flame.
        const index = explosions.findIndex((e) => e.x === x && e.y === y);
        if (index >= 0) {
          const current = explosions[index];
          explosions[index] = {
            ...current,
            ticksRemaining: EXPLOSION_MS,
            chipDamage: false,
            sparedIds,
          };
        }
      }

      const cell = map[y][x];
      if (cell === 'Box') {
        let pendingPowerUp: GenericPower | null = null;
        // Training Dojo crates hide nothing: each room places its own pickups.
        if (!state.campaign && state.config.mode !== 'training') {
          const drop = rollBoxDrop(rngSeed);
          pendingPowerUp = drop.power;
          rngSeed = drop.seed;
        }
        destroyedBoxes.push({
          x,
          y,
          ticksRemaining: BOX_DESTROY_MS,
          pendingPowerUp,
          pendingOutcome: state.campaign
            ? getCampaignDestructionOutcome(state, x, y, bomb.ownerId)
            : null,
        });
        map[y][x] = 'Empty';
      }
      if (isObstacle(cell)) {
        map[y][x] = 'Empty';
      }

      const chained = cellHasBomb(map, x, y);
      const chainedBomb = chained ? remainingBombsByCell.get(key) : null;
      if (chainedBomb && !chainedIds.has(chainedBomb.id)) {
        chainedIds.add(chainedBomb.id);
        remainingBombsByCell.delete(key);
        chainBombs.push(chainedBomb);
      }

      players.forEach((p, index) => {
        if (p.alive && positionOverlapsCell(p, x, y, FLAME_HURT_RADIUS)) {
          const invincible = isPowerUpActive(state, p.id, 'Invincibility');
          if (!invincible) {
            players[index] = applyCharacterSurvival(
              p,
              formatBombDeathReason(p, owner, bomb),
              { kind: 'blast', byPlayerId: owner?.id, bombKind: bomb.kind }
            );
          }
        }
      });

      for (let index = monsters.length - 1; index >= 0; index -= 1) {
        const monster = monsters[index];
        if (monster.x === x && monster.y === y) {
          monsters.splice(index, 1);
        }
      }
      if (boss && Math.abs(boss.x - x) + Math.abs(boss.y - y) <= 1) {
        bossWasHit = true;
      }
    });
    const outerPositions = getUltimateOuterPositions(bomb, positions, raycastMap);
    outerPositions.forEach(({ x, y }) => {
      const key = getCellKey(x, y);
      if (!explosionKeys.has(key)) {
        explosionKeys.add(key);
        explosions.push({
          x,
          y,
          ticksRemaining: EXPLOSION_MS,
          kind: bomb.kind,
          ownerId: bomb.ownerId,
          chipDamage: true,
          sparedIds: [],
        });
      }
    });
    if (outerPositions.length > 0) {
      players = players.map((player) => (
        outerPositions.some((point) => (
          positionOverlapsCell(player, point.x, point.y, FLAME_HURT_RADIUS)
        ))
          ? applyUltimateChipDamage(state, player, owner, bomb)
          : player
      ));
    }
    if (boss && bossWasHit) {
      boss = applyBossBombEffect(boss, bomb);
    }
  });

  if (chainedIds.size > 0) {
    remainingBombs = remainingBombs.filter((bomb) => !chainedIds.has(bomb.id));
  }

  let next: GameEngineState = {
    ...state,
    map,
    players,
    monsters,
    boss,
    bombs: remainingBombs,
    explosions,
    destroyedBoxes,
    rngSeed,
  };

  if (chainBombs.length > 0) {
    next = explodeBombs(next, chainBombs, raycastMap);
  }
  return next;
}

const TRACKING_CLAY_STEP_MS = 850;
const CLAY_SPIDER_DETECTION_RANGE = 7;

function getClaySpiderTargets(state: GameEngineState, bomb: BombState): { x: number; y: number }[] {
  const rivalPlayers = state.config.mode === 'solo'
    ? []
    : state.players
      .filter((player) => player.alive && player.id !== bomb.ownerId)
      .map(getPlayerCell);
  const enemies = state.monsters.map((monster) => ({ x: monster.x, y: monster.y }));
  if (state.boss && state.boss.health > 0) enemies.push({ x: state.boss.x, y: state.boss.y });
  return [...rivalPlayers, ...enemies].filter((target) => (
    Math.abs(target.x - bomb.x) + Math.abs(target.y - bomb.y) <= CLAY_SPIDER_DETECTION_RANGE
  ));
}

function getClaySpiderStep(
  state: GameEngineState,
  map: GameMap,
  bomb: BombState,
): { x: number; y: number } | null {
  const targets = getClaySpiderTargets(state, bomb);
  if (targets.length === 0) return null;

  const distances = map.map((row) => row.map(() => Infinity));
  const queue = targets.filter((target) => map[target.y]?.[target.x] !== undefined);
  queue.forEach((target) => { distances[target.y][target.x] = 0; });
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const nextDistance = distances[current.y][current.x] + 1;
    CARDINAL_DIRECTIONS.forEach((direction) => {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const isOrigin = x === bomb.x && y === bomb.y;
      if (!map[y]?.[x] || (!isOrigin && map[y][x] !== 'Empty')) return;
      if (nextDistance < distances[y][x]) {
        distances[y][x] = nextDistance;
        queue.push({ x, y });
      }
    });
  }

  const currentDistance = distances[bomb.y]?.[bomb.x] ?? Infinity;
  if (
    !Number.isFinite(currentDistance)
    || currentDistance > CLAY_SPIDER_DETECTION_RANGE
  ) return null;
  const occupied = new Set([
    ...state.players.filter((player) => player.alive).map((player) => {
      const point = getPlayerCell(player);
      return getCellKey(point.x, point.y);
    }),
    ...state.monsters.map((monster) => getCellKey(monster.x, monster.y)),
    ...(state.boss ? [getCellKey(state.boss.x, state.boss.y)] : []),
  ]);
  return CARDINAL_DIRECTIONS
    .map((direction) => ({ x: bomb.x + direction.x, y: bomb.y + direction.y }))
    .filter((point) => map[point.y]?.[point.x] === 'Empty')
    .filter((point) => !occupied.has(getCellKey(point.x, point.y)))
    .sort((first, second) => (
      distances[first.y][first.x] - distances[second.y][second.x]
    ))
    .find((point) => distances[point.y][point.x] < currentDistance) ?? null;
}

function advanceBombAbilities(state: GameEngineState, deltaMs: number): GameEngineState {
  let map = state.map;
  let mapChanged = false;
  const bombs = state.bombs.map((bomb) => {
    let next = { ...bomb, ageMs: (bomb.ageMs ?? 0) + deltaMs };
    if (bomb.kind !== 'giantClay') return next;

    const movementCooldownMs = (bomb.movementCooldownMs ?? TRACKING_CLAY_STEP_MS) - deltaMs;
    if (movementCooldownMs > 0) return { ...next, movementCooldownMs };
    const step = getClaySpiderStep(state, map, bomb);
    next = { ...next, movementCooldownMs: TRACKING_CLAY_STEP_MS };
    if (!step) return next;

    if (!mapChanged) {
      map = map.map((row) => [...row]);
      mapChanged = true;
    }
    map[bomb.y][bomb.x] = 'Empty';
    map[step.y][step.x] = {
      range: bomb.range,
      coords: { x: step.x, y: step.y },
      ownerId: bomb.ownerId,
    };
    return { ...next, x: step.x, y: step.y };
  });
  const abilityState = { ...state, map, bombs };
  const cloneCells = getShadowCloneBlocks(abilityState);
  const players = cloneCells.length === 0
    ? state.players
    : state.players.map((player) => (
      player.alive && cloneCells.some((cell) => (
        cell.ownerId !== player.id
        && positionOverlapsCell(player, cell.x, cell.y)
      ))
        ? {
          ...player,
          movementLockMs: Math.max(player.movementLockMs ?? 0, deltaMs + 60),
          movementLockReason: 'shadowClone' as const,
        }
        : player
    ));
  const monsters = cloneCells.length === 0
    ? state.monsters
    : state.monsters.map((monster) => (
      cloneCells.some((cell) => cell.x === monster.x && cell.y === monster.y)
        ? { ...monster, moveCooldown: Math.max(monster.moveCooldown, deltaMs + 60) }
        : monster
    ));
  const boss = state.boss && cloneCells.some((cell) => (
    cell.x === state.boss!.x && cell.y === state.boss!.y
  ))
    ? { ...state.boss, moveCooldown: Math.max(state.boss.moveCooldown, deltaMs + 60) }
    : state.boss;
  return {
    ...abilityState, players, monsters, boss,
  };
}

export function tickBombs(state: GameEngineState, deltaMs: number): GameEngineState {
  if (state.bombs.length === 0) return state;
  const advanced = advanceBombAbilities(state, deltaMs);
  const ready: BombState[] = [];
  const ownerAlive = (ownerId: string) => advanced.players.some((p) => p.id === ownerId && p.alive);
  const ticking = advanced.bombs.map((bomb) => {
    // A manual bomb waits for its owner; once they fall it burns its normal fuse.
    if (bomb.manualDetonation && ownerAlive(bomb.ownerId)) return bomb;
    const remaining = bomb.ticksRemaining - deltaMs;
    if (remaining <= 0) {
      ready.push(bomb);
      return null;
    }
    return { ...bomb, ticksRemaining: remaining };
  }).filter((b): b is BombState => b !== null);

  let next = { ...advanced, bombs: ticking };
  if (ready.length > 0) {
    next = explodeBombs(next, ready);
  }
  return next;
}

export function tickExplosions(state: GameEngineState, deltaMs: number): GameEngineState {
  if (state.explosions.length === 0 && state.destroyedBoxes.length === 0) return state;
  const explosions = state.explosions
    .map((e) => ({ ...e, ticksRemaining: e.ticksRemaining - deltaMs }))
    .filter((e) => e.ticksRemaining > 0);

  let map = state.map;
  let monsters = state.monsters;
  let campaign = state.campaign;
  const destroyedBoxes: DestroyedBox[] = [];

  state.destroyedBoxes.forEach((box) => {
    const remaining = box.ticksRemaining - deltaMs;
    if (remaining > 0) {
      destroyedBoxes.push({ ...box, ticksRemaining: remaining });
    } else if (box.pendingPowerUp) {
      // A bomb or cover planted on the burning crate keeps the cell, as in
      // campaign reveals: the drop never overwrites it.
      if (map[box.y][box.x] === 'Empty') {
        map = map.map((row) => [...row]);
        map[box.y][box.x] = box.pendingPowerUp;
      }
    } else if (box.pendingOutcome) {
      const resolved = resolveCampaignDestroyedBox(
        { ...state, map, monsters, campaign },
        box
      );
      map = resolved.map;
      monsters = resolved.monsters;
      campaign = resolved.campaign;
    }
  });

  return {
    ...state,
    map,
    monsters,
    campaign,
    explosions,
    destroyedBoxes,
  };
}

// Classic rule: a flame stays lethal for its whole lifetime. Whoever the blast
// already resolved at ignition is spared, so a survival passive is not undone
// by the same flame on the next tick.
export function burnInLingeringFlames(state: GameEngineState): GameEngineState {
  if (state.explosions.length === 0) return state;

  let changed = false;
  const explosions = state.explosions.map((explosion) => ({
    ...explosion,
    sparedIds: explosion.sparedIds ?? [],
  }));
  const ownerName = (ownerId?: string) => (
    state.players.find((player) => player.id === ownerId)?.name
  );

  const players = state.players.map((player) => {
    if (!player.alive) return player;
    const flame = explosions.find((explosion) => (
      !explosion.chipDamage
      && !explosion.sparedIds.includes(player.id)
      && positionOverlapsCell(player, explosion.x, explosion.y, FLAME_HURT_RADIUS)
    ));
    if (!flame) return player;
    flame.sparedIds = [...flame.sparedIds, player.id];
    changed = true;
    if (isPowerUpActive(state, player.id, 'Invincibility')) return player;
    const owner = ownerName(flame.ownerId);
    let reason = `${player.name} walked into a lingering flame.`;
    if (flame.ownerId === player.id) {
      reason = `${player.name} walked into their own lingering flame.`;
    } else if (owner) {
      reason = `${player.name} walked into ${owner}'s lingering flame.`;
    }
    return applyCharacterSurvival(player, reason, {
      kind: 'flame',
      byPlayerId: state.players.some((other) => other.id === flame.ownerId)
        ? flame.ownerId
        : undefined,
      bombKind: flame.kind,
    });
  });

  const monsters = state.monsters.filter((monster) => {
    const flame = explosions.find((explosion) => (
      !explosion.chipDamage
      && explosion.x === monster.x
      && explosion.y === monster.y
      && !explosion.sparedIds.includes(monster.id)
    ));
    if (!flame) return true;
    changed = true;
    return false;
  });

  return changed ? {
    ...state,
    players,
    monsters,
    explosions,
  } : state;
}
