import { defaultMap } from '../constants/contants';
import {
  GameMap, gameItem, genericPowerUpOptions,
} from '../model/gameItem';

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

export async function fetchMapFromFile(mapName: string): Promise<string[][]> {
  const response = await fetch(`/maps/${mapName}.txt`);
  const mapText = await response.text();
  return mapText
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.trimEnd().split(''));
}
