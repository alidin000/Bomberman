/* eslint-disable no-use-before-define */
/* eslint-disable prefer-destructuring, comma-dangle, object-curly-newline, prefer-const */
import {
  Bomb, GameMap, isBomb, isObstacle, randomPowerUpGenerator,
} from '../model/gameItem';
import {
  BombState, DestroyedBox, ExplosionCell, GameEngineState, MonsterState, PlayerState,
} from './types';
import {
  BOMB_FUSE_MS, BOX_DESTROY_MS, EXPLOSION_MS,
} from './constants';
import { applyCharacterSurvival, isPowerUpActive } from './players';
import { getCell, getPlayerCell, positionOverlapsCell } from './grid';
import {
  getCampaignDestructionOutcome,
  resolveCampaignDestroyedBox,
} from './campaignExploration';

let bombIdCounter = 0;

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
  naruto: 'rasenshuriken',
  sasuke: 'kirin',
  gaara: 'sandTsunami',
  minato: 'instantTeleport',
  itachi: 'tsukuyomi',
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
  };
}

function getBombFuse(kind: BombState['kind']): number {
  const fuseByKind: Partial<Record<BombState['kind'], number>> = {
    claySpider: 2600,
    shadowClone: 2800,
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

function canPlaceBombAt(state: GameEngineState, x: number, y: number): boolean {
  return state.map[y]?.[x] === 'Empty';
}

function getCloneBombPoint(
  state: GameEngineState,
  player: PlayerState,
): { x: number; y: number } | null {
  const origin = getPlayerCell(player);
  return [
    { x: origin.x + 1, y: origin.y },
    { x: origin.x - 1, y: origin.y },
    { x: origin.x, y: origin.y + 1 },
    { x: origin.x, y: origin.y - 1 },
  ].find((point) => canPlaceBombAt(state, point.x, point.y)) ?? null;
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

  if (kind === 'shadowClone') {
    const clonePoint = getCloneBombPoint(state, player);
    if (clonePoint) {
      bombs.push(createBomb(
        player.id,
        clonePoint.x,
        clonePoint.y,
        Math.max(1, player.bombRange - 1),
        hasDetonator,
        kind,
        getBombFuse(kind) + 220,
      ));
    }
  }

  return bombs;
}

function getExplosionPositions(bomb: BombState, map: GameMap): { x: number; y: number }[] {
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

  if (bomb.kind === 'shadowClone' || bomb.kind === 'crowClone' || bomb.kind === 'rasenshuriken') {
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
    const radius = ['giantClay', 'sandTsunami', 'tsukuyomi', 'rasenshuriken'].includes(bomb.kind)
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

  if (player.activeBombs >= player.maxBombs && player.characterId !== 'naruto') return state;
  if (currentCell !== 'Empty') return state;

  const kind = BASIC_BOMBS[player.characterId];
  const bombs = getBasicBombPlacements(state, player, kind, hasDetonator);
  const allowedBombs = player.characterId === 'naruto'
    ? bombs.slice(0, Math.max(1, player.maxBombs - player.activeBombs + 1))
    : bombs.slice(0, Math.max(0, player.maxBombs - player.activeBombs));
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

export function placeUltimateBomb(state: GameEngineState, playerId: string): GameEngineState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return state;
  if (player.ultimateCooldownRemaining > 0) return state;
  const origin = getPlayerCell(player);
  if (getCell(state.map, origin) !== 'Empty') return state;

  const bomb = createBomb(
    playerId,
    origin.x,
    origin.y,
    player.bombRange + (player.characterId === 'minato' ? 1 : 3),
    false,
    ULTIMATE_BOMBS[player.characterId],
    getBombFuse(ULTIMATE_BOMBS[player.characterId]),
  );
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
        ...(player.characterId === 'minato'
          ? getTeleportDestination(state, origin.x, origin.y)
          : {}),
        activeBombs: p.activeBombs + 1,
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

function getTeleportDestination(
  state: GameEngineState,
  x: number,
  y: number,
): { x: number; y: number } {
  const candidates = [
    { x: x + 3, y },
    { x: x - 3, y },
    { x, y: y + 3 },
    { x, y: y - 3 },
    { x: 1, y: 1 },
  ];
  return candidates.find((point) => state.map[point.y]?.[point.x] === 'Empty') ?? { x, y };
}

function getBombDeathLabel(kind: BombState['kind']): string {
  const labels: Record<BombState['kind'], string> = {
    standard: 'bomb',
    claySpider: 'Clay Spider',
    shadowClone: 'Shadow Clone',
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

function getBossDamage(kind: BombState['kind']): number {
  const damageByKind: Partial<Record<BombState['kind'], number>> = {
    claySpider: 90,
    shadowClone: 70,
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

function applyMonsterBombEffect(monster: MonsterState, bomb: BombState): MonsterState | null {
  if (bomb.kind === 'sandCoffin') {
    return { ...monster, moveCooldown: monster.moveCooldown + 1800 };
  }
  if (bomb.kind === 'sandTsunami') {
    return { ...monster, moveCooldown: monster.moveCooldown + 2600 };
  }
  if (bomb.kind === 'crowClone') {
    return { ...monster, moveCooldown: monster.moveCooldown + 1500 };
  }
  if (bomb.kind === 'tsukuyomi') {
    return { ...monster, moveCooldown: monster.moveCooldown + 3000 };
  }
  if (bomb.kind === 'thunderMark') {
    return { ...monster, moveCooldown: monster.moveCooldown + 900 };
  }
  return null;
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

export function explodeBombs(state: GameEngineState, bombsToExplode: BombState[]): GameEngineState {
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

    const positions = dedupePositions(getExplosionPositions(bomb, map));
    positions.forEach(({ x, y }) => {
      const key = getCellKey(x, y);
      if (!explosionKeys.has(key)) {
        explosionKeys.add(key);
        explosions.push({
          x,
          y,
          ticksRemaining: EXPLOSION_MS,
          kind: bomb.kind,
        });
      }

      const cell = map[y][x];
      if (cell === 'Box') {
        destroyedBoxes.push({
          x,
          y,
          ticksRemaining: BOX_DESTROY_MS,
          pendingPowerUp: state.campaign ? null : randomPowerUpGenerator(),
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
        if (p.alive && positionOverlapsCell(p, x, y)) {
          const invincible = isPowerUpActive(state, p.id, 'Invincibility');
          if (!invincible) {
            players[index] = applyCharacterSurvival(
              p,
              formatBombDeathReason(p, owner, bomb)
            );
          }
        }
      });

      for (let index = monsters.length - 1; index >= 0; index -= 1) {
        const monster = monsters[index];
        if (monster.x === x && monster.y === y) {
          const updatedMonster = applyMonsterBombEffect(monster, bomb);
          if (updatedMonster) {
            monsters[index] = updatedMonster;
          } else {
            monsters.splice(index, 1);
          }
        }
      }
      if (boss && Math.abs(boss.x - x) + Math.abs(boss.y - y) <= 1) {
        boss = applyBossBombEffect(boss, bomb);
      }
    });
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
  };

  if (chainBombs.length > 0) {
    next = explodeBombs(next, chainBombs);
  }
  return next;
}

export function tickBombs(state: GameEngineState, deltaMs: number): GameEngineState {
  const ready: BombState[] = [];
  const ticking = state.bombs.map((bomb) => {
    if (bomb.manualDetonation) return bomb;
    const remaining = bomb.ticksRemaining - deltaMs;
    if (remaining <= 0) {
      ready.push(bomb);
      return null;
    }
    return { ...bomb, ticksRemaining: remaining };
  }).filter((b): b is BombState => b !== null);

  let next = { ...state, bombs: ticking };
  if (ready.length > 0) {
    next = explodeBombs(next, ready);
  }
  return next;
}

export function tickExplosions(state: GameEngineState, deltaMs: number): GameEngineState {
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
      map = map.map((row) => [...row]);
      map[box.y][box.x] = box.pendingPowerUp;
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

export function killPlayersInExplosions(
  players: PlayerState[],
  explosions: ExplosionCell[],
  timedPowerUps: GameEngineState['timedPowerUps'],
): PlayerState[] {
  return players.map((player) => {
    if (!player.alive) return player;
    const invincible = timedPowerUps[player.id]?.some(
      (tp) => tp.power === 'Invincibility' && tp.ticksRemaining > 0,
    ) || player.powerUps.includes('Invincibility');
    if (invincible) return player;
    const hit = explosions.some((e) => positionOverlapsCell(player, e.x, e.y));
    return hit ? applyCharacterSurvival(player) : player;
  });
}
