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

export function loadMapFromStorage(): GameMap {
  const stored = localStorage.getItem('selectedMap');
  const mapData: string[][] = stored && JSON.parse(stored).length > 0
    ? JSON.parse(stored)
    : defaultMap;
  return parseMapRows(mapData);
}

export async function fetchMapFromFile(mapName: string): Promise<string[][]> {
  const response = await fetch(`/maps/${mapName}.txt`);
  const mapText = await response.text();
  return mapText
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.trimEnd().split(''));
}
