import { defaultMap } from '../constants/contants';
import {
  GameMap, gameItem, randomPowerUpGenerator,
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

export function parseMapRows(mapData: string[][]): GameMap {
  return normalizeMapData(mapData).map((row) => row.map((cell: string): gameItem => {
    switch (cell) {
      case ' ':
        return 'Empty';
      case 'W':
        return 'Wall';
      case 'B':
        return 'Box';
      case 'P':
        return randomPowerUpGenerator();
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
  return mapText.split(/\r?\n/).map((row) => row.trim().split('').slice(0, 15));
}
