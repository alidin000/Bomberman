import { defaultMap } from '../constants/contants';
import {
  GameMap, gameItem, genericPowerUpOptions,
} from '../model/gameItem';
// The stage maps ship inside the bundle (about 2 KB gzip for all seven), so
// starting a match never waits on a network round trip. The files stay in
// public/maps, where the engine tests read them.
/* eslint-disable import/no-unresolved -- Vite `?raw` imports */
import akatsukiHideout from '../../public/maps/akatsukiHideout.txt?raw';
import greatShinobiWar from '../../public/maps/greatShinobiWar.txt?raw';
import hiddenCloud from '../../public/maps/hiddenCloud.txt?raw';
import hiddenLeaf from '../../public/maps/hiddenLeaf.txt?raw';
import hiddenMist from '../../public/maps/hiddenMist.txt?raw';
import hiddenSand from '../../public/maps/hiddenSand.txt?raw';
import hiddenStone from '../../public/maps/hiddenStone.txt?raw';
/* eslint-enable import/no-unresolved */

const STAGE_MAP_TEXT: Readonly<Record<string, string>> = {
  akatsukiHideout,
  greatShinobiWar,
  hiddenCloud,
  hiddenLeaf,
  hiddenMist,
  hiddenSand,
  hiddenStone,
};

function normalizeMapData(mapData: string[][]): string[][] {
  const width = Math.max(...mapData.map((row) => row.length));
  return mapData.map((row) => {
    if (row.length >= width) return row;
    const lastCell = row[row.length - 1];
    if (row[0] === 'W' && lastCell === 'W') {
      return [
        ...row.slice(0, -1),
        ...Array(width - row.length).fill(' '),
        lastCell,
      ];
    }
    return [...row, ...Array(width - row.length).fill(' ')];
  });
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

function getMapSeed(mapData: string[][]): number {
  return hashString(mapData.map((row) => row.join('')).join('\n'));
}

function deterministicPowerUp(seed: number, x: number, y: number): gameItem {
  const hash = hashString(`${seed}:${x}:${y}`);
  return genericPowerUpOptions[hash % genericPowerUpOptions.length];
}

export function parseMapRows(mapData: string[][]): GameMap {
  const normalized = normalizeMapData(mapData);
  const seed = getMapSeed(normalized);
  return normalized.map((row, y) => row.map((cell: string, x): gameItem => {
    switch (cell) {
      case ' ':
        return 'Empty';
      case 'W':
        return 'Wall';
      case 'B':
        return 'Box';
      case 'P':
        return deterministicPowerUp(seed, x, y);
      default:
        throw new Error(`Invalid map data: unexpected character '${cell}'`);
    }
  }));
}

function readStoredMap(): string[][] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('selectedMap') ?? 'null');
    const valid = Array.isArray(parsed)
      && parsed.length > 0
      && parsed.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'));
    return valid ? parsed as string[][] : null;
  } catch {
    return null;
  }
}

// A corrupted or hand-edited `selectedMap` falls back to the default arena
// instead of throwing while the game screen renders.
export function loadMapFromStorage(): GameMap {
  return parseMapRows(readStoredMap() ?? defaultMap);
}

/** Splits an authored map file into rows of cells, dropping blank lines. */
export function parseMapText(mapText: string): string[][] {
  return mapText
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.trimEnd().split(''));
}

/** The authored rows for a stage map, from the bundle (no fetch). */
export function loadStageMapRows(mapId: string): string[][] {
  const mapText = STAGE_MAP_TEXT[mapId];
  if (mapText === undefined) throw new Error(`Unknown stage map '${mapId}'`);
  return parseMapText(mapText);
}
