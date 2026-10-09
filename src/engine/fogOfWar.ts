import { getCharacterDefinition } from '../content';
import { CharacterId } from '../content/types';
import {
  CellVisibility,
  FogOfWarState,
  GameEngineState,
  Point,
} from './types';
import { getPlayerCell } from './grid';
import { getMatchDifficulty } from './difficulty';
import { getLoadoutEffects } from './campaignLoadout';

const DEFAULT_VISION_RADIUS = 3;
const DEIDARA_EXPLOSION_REVEAL_RADIUS = 3;
const SASUKE_ENEMY_SENSE_BONUS = 2;
const ITACHI_ENEMY_SENSE_BONUS = 3;
const MINATO_PROXIMITY_SENSE_RADIUS = 6;
const GAARA_WALL_SENSE_BONUS = 2;
const DEIDARA_REVEAL_KINDS = new Set(['claySpider', 'giantClay']);
const fogLookupCache = new WeakMap<
  FogOfWarState,
  { visible: Set<string>; explored: Set<string> }
>();

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function mapContains(state: GameEngineState, x: number, y: number): boolean {
  return y >= 0
    && y < state.map.length
    && x >= 0
    && x < (state.map[y]?.length ?? 0);
}

// Cell keys within `radius` steps of `center`, in the same order as before.
function addRadius(
  state: GameEngineState,
  visible: Set<string>,
  center: Point,
  radius: number
): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
      if (mapContains(state, x, y) && distance <= radius) {
        visible.add(cellKey(x, y));
      }
    }
  }
}

// Every-cell fog for modes without fog of war. It depends only on the map's
// shape, so one frozen copy per shape is shared: the reducer then sees the
// same arrays on every action and skips the comparison work.
const allCellsFogCache = new Map<string, FogOfWarState>();

function buildAllCells(state: GameEngineState): FogOfWarState {
  const cells: string[] = [];
  state.map.forEach((row, y) => {
    row.forEach((_, x) => cells.push(cellKey(x, y)));
  });
  return {
    visible: cells,
    explored: cells,
    sensedEnemies: [],
    sensedWalls: [],
  };
}

function addAllCells(state: GameEngineState): FogOfWarState {
  const height = state.map.length;
  const width = state.map[0]?.length ?? 0;
  for (let y = 1; y < height; y += 1) {
    if (state.map[y].length !== width) return buildAllCells(state);
  }
  const key = `${width}x${height}`;
  const cached = allCellsFogCache.get(key);
  if (cached) return cached;
  const fog = buildAllCells(state);
  allCellsFogCache.set(key, fog);
  return fog;
}

function getDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function addSensedEnemies(
  state: GameEngineState,
  sensedEnemies: Set<string>,
  center: Point,
  radius: number
): void {
  state.monsters.forEach((monster) => {
    const enemyCell = { x: Math.round(monster.x), y: Math.round(monster.y) };
    if (mapContains(state, enemyCell.x, enemyCell.y)
      && getDistance(center, enemyCell) <= radius) {
      sensedEnemies.add(cellKey(enemyCell.x, enemyCell.y));
    }
  });

  if (state.boss && state.boss.health > 0) {
    const bossCell = { x: Math.round(state.boss.x), y: Math.round(state.boss.y) };
    if (mapContains(state, bossCell.x, bossCell.y)
      && getDistance(center, bossCell) <= radius) {
      sensedEnemies.add(cellKey(bossCell.x, bossCell.y));
    }
  }
}

function addSensedWalls(
  state: GameEngineState,
  sensedWalls: Set<string>,
  center: Point,
  radius: number
): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (mapContains(state, x, y) && getDistance(center, { x, y }) <= radius) {
        const cell = state.map[y]?.[x];
        if (cell === 'Wall' || cell === 'Box') {
          sensedWalls.add(cellKey(x, y));
        }
      }
    }
  }
}

export function getVisionRadius(characterId: CharacterId): number {
  return getCharacterDefinition(characterId).visionRadius ?? DEFAULT_VISION_RADIUS;
}

// Sight in this match: a stage event (sandstorm, fog) shortens it, but never
// below the difficulty's floor (2 on Hard), nor above the character's own.
function getMatchVisionRadius(state: GameEngineState, characterId: CharacterId): number {
  // Lantern Oil (a hub upgrade) adds to the character's own sight.
  const base = getVisionRadius(characterId) + getLoadoutEffects(state.config).visionBonus;
  const modifier = state.campaign?.event?.visionModifier ?? 0;
  if (modifier >= 0) return Math.max(2, base + modifier);
  const floor = Math.min(base, getMatchDifficulty(state.config).eventVisionFloor);
  return Math.max(2, floor, base + modifier);
}

// Arrays this module produced: sorted, without duplicates. Only these take
// the incremental path; anything else is recomputed from scratch as before.
const sortedKeyArrays = new WeakSet<string[]>();
const keySetCache = new WeakMap<string[], Set<string>>();
// The vision sources (cell and radius of every eye) a fog state was computed
// from. Same sources mean the same visible cells, and explored already holds them.
const visionSourcesCache = new WeakMap<FogOfWarState, number[]>();

function getKeySet(keys: string[]): Set<string> {
  let set = keySetCache.get(keys);
  if (!set) {
    set = new Set(keys);
    keySetCache.set(keys, set);
  }
  return set;
}

function sameCellKeys(prev: string[] = [], next: string[] = []): boolean {
  if (prev === next) return true;
  return prev.length === next.length
    && prev.every((cell, index) => cell === next[index]);
}

function sortedKeys(keys: Set<string>, previous?: string[]): string[] {
  const next = Array.from(keys).sort();
  if (previous && sameCellKeys(previous, next)) return previous;
  sortedKeyArrays.add(next);
  return next;
}

// explored = previous explored + visible, sorted. Reuses the previous array
// when nothing new was revealed, and never re-sorts or copies it otherwise.
function mergeExplored(previous: string[], visible: string[]): string[] {
  if (!sortedKeyArrays.has(previous)) {
    const merged = Array.from(new Set([...previous, ...visible])).sort();
    // Same content means `previous` is already sorted and unique: adopt it,
    // so the next call takes the fast path instead of re-sorting forever.
    const result = sameCellKeys(previous, merged) ? previous : merged;
    sortedKeyArrays.add(result);
    return result;
  }
  const known = getKeySet(previous);
  const revealed = visible.filter((key) => !known.has(key));
  if (revealed.length === 0) return previous;
  const merged = previous.concat(revealed).sort();
  sortedKeyArrays.add(merged);
  return merged;
}

function getVisionSources(state: GameEngineState): number[] {
  // The map's shape bounds every radius, so it is part of the key.
  const sources: number[] = [state.map.length, state.map[0]?.length ?? 0];
  state.players.forEach((player) => {
    if (!player.alive) return;
    const playerCell = getPlayerCell(player);
    sources.push(
      playerCell.x,
      playerCell.y,
      getMatchVisionRadius(state, player.characterId)
    );
  });
  state.explosions.forEach((explosion) => {
    if (explosion.kind && DEIDARA_REVEAL_KINDS.has(explosion.kind)) {
      sources.push(explosion.x, explosion.y, DEIDARA_EXPLOSION_REVEAL_RADIUS);
    }
  });
  return sources;
}

function sameNumbers(prev: number[], next: number[]): boolean {
  if (prev.length !== next.length) return false;
  for (let index = 0; index < prev.length; index += 1) {
    if (prev[index] !== next[index]) return false;
  }
  return true;
}

function computeFogOfWar(state: GameEngineState): {
  fog: FogOfWarState;
  sources: number[] | null;
} {
  if (state.config.mode !== 'solo') {
    return { fog: addAllCells(state), sources: null };
  }

  const previous: FogOfWarState | undefined = state.fogOfWar;
  const sources = getVisionSources(state);
  let visible: string[];
  let explored: string[];
  const previousSources = previous ? visionSourcesCache.get(previous) : undefined;
  if (
    previous
    && previousSources
    && sameNumbers(previousSources, sources)
    && sortedKeyArrays.has(previous.explored)
  ) {
    visible = previous.visible;
    explored = previous.explored;
  } else {
    const visibleKeys = new Set<string>();
    for (let index = 2; index < sources.length; index += 3) {
      addRadius(
        state,
        visibleKeys,
        { x: sources[index], y: sources[index + 1] },
        sources[index + 2]
      );
    }
    visible = sortedKeys(visibleKeys, previous?.visible);
    explored = mergeExplored(previous?.explored ?? [], visible);
  }

  const sensedEnemies = new Set<string>();
  const sensedWalls = new Set<string>();
  state.players.forEach((player) => {
    if (!player.alive) return;
    const playerCell = getPlayerCell(player);
    const visionRadius = getMatchVisionRadius(state, player.characterId);
    if (player.characterId === 'sasuke') {
      addSensedEnemies(
        state,
        sensedEnemies,
        playerCell,
        visionRadius + SASUKE_ENEMY_SENSE_BONUS
      );
    }
    if (player.characterId === 'itachi') {
      addSensedEnemies(
        state,
        sensedEnemies,
        playerCell,
        visionRadius + ITACHI_ENEMY_SENSE_BONUS
      );
    }
    if (player.characterId === 'minato') {
      addSensedEnemies(
        state,
        sensedEnemies,
        playerCell,
        MINATO_PROXIMITY_SENSE_RADIUS
      );
    }
    if (player.characterId === 'gaara') {
      addSensedWalls(
        state,
        sensedWalls,
        playerCell,
        visionRadius + GAARA_WALL_SENSE_BONUS
      );
    }
  });

  return {
    fog: {
      visible,
      explored,
      sensedEnemies: sortedKeys(sensedEnemies, previous?.sensedEnemies),
      sensedWalls: sortedKeys(sensedWalls, previous?.sensedWalls),
    },
    sources,
  };
}

export function calculateFogOfWar(state: GameEngineState): FogOfWarState {
  return { ...computeFogOfWar(state).fog };
}

function getFogLookup(fogOfWar: FogOfWarState): {
  visible: Set<string>;
  explored: Set<string>;
} {
  const cached = fogLookupCache.get(fogOfWar);
  if (cached) return cached;
  const lookup = {
    visible: new Set(fogOfWar.visible),
    explored: new Set(fogOfWar.explored),
  };
  fogLookupCache.set(fogOfWar, lookup);
  return lookup;
}

export function withUpdatedFogOfWar(state: GameEngineState): GameEngineState {
  const { fog: nextFogOfWar, sources } = computeFogOfWar(state);
  const currentFogOfWar = state.fogOfWar;
  const visibleSame = sameCellKeys(currentFogOfWar.visible, nextFogOfWar.visible);
  const exploredSame = sameCellKeys(currentFogOfWar.explored, nextFogOfWar.explored);
  const sensedEnemiesSame = sameCellKeys(
    currentFogOfWar.sensedEnemies,
    nextFogOfWar.sensedEnemies
  );
  const sensedWallsSame = sameCellKeys(
    currentFogOfWar.sensedWalls,
    nextFogOfWar.sensedWalls
  );

  if (visibleSame && exploredSame && sensedEnemiesSame && sensedWallsSame) {
    if (sources && sortedKeyArrays.has(currentFogOfWar.explored)) {
      visionSourcesCache.set(currentFogOfWar, sources);
    }
    return state;
  }

  const fogOfWar = {
    visible: visibleSame ? currentFogOfWar.visible : nextFogOfWar.visible,
    explored: exploredSame ? currentFogOfWar.explored : nextFogOfWar.explored,
    sensedEnemies: sensedEnemiesSame
      ? currentFogOfWar.sensedEnemies
      : nextFogOfWar.sensedEnemies,
    sensedWalls: sensedWallsSame
      ? currentFogOfWar.sensedWalls
      : nextFogOfWar.sensedWalls,
  };
  if (sources && sortedKeyArrays.has(fogOfWar.explored)) {
    visionSourcesCache.set(fogOfWar, sources);
  }
  return { ...state, fogOfWar };
}

export function getCellVisibility(
  fogOfWar: FogOfWarState,
  x: number,
  y: number
): CellVisibility {
  const key = cellKey(x, y);
  const lookup = getFogLookup(fogOfWar);
  if (lookup.visible.has(key)) return 'visible';
  if (lookup.explored.has(key)) return 'explored';
  return 'hidden';
}

export function isCellVisible(fogOfWar: FogOfWarState, x: number, y: number): boolean {
  return getCellVisibility(fogOfWar, x, y) === 'visible';
}
