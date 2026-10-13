import { defaultMap } from '../constants/contants';
import {
  GameMap, gameItem, genericPowerUpOptions,
} from '../model/gameItem';
// The stage maps ship inside the bundle (a few KB gzip in all), so starting a
// match never waits on a network round trip. The files stay in public/maps,
// where the engine tests read them. Each village has two: its 35x35 arena map
// (Local Arena and online arena rooms) and its 50x50 campaign map in
// public/maps/campaign (solo and co-op missions), with the secret rooms and
// the walled boss arena the mission layout (content/campaignLayouts.ts) uses.
/* eslint-disable import/no-unresolved -- Vite `?raw` imports */
import akatsukiHideoutCampaign from '../../public/maps/campaign/akatsukiHideout.txt?raw';
import greatShinobiWarCampaign from '../../public/maps/campaign/greatShinobiWar.txt?raw';
import hiddenCloudCampaign from '../../public/maps/campaign/hiddenCloud.txt?raw';
import hiddenLeafCampaign from '../../public/maps/campaign/hiddenLeaf.txt?raw';
import hiddenMistCampaign from '../../public/maps/campaign/hiddenMist.txt?raw';
import hiddenSandCampaign from '../../public/maps/campaign/hiddenSand.txt?raw';
import hiddenStoneCampaign from '../../public/maps/campaign/hiddenStone.txt?raw';
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

// A village without its own campaign map plays its mission on the arena map.
const CAMPAIGN_MAP_TEXT: Readonly<Record<string, string>> = {
  akatsukiHideout: akatsukiHideoutCampaign,
  greatShinobiWar: greatShinobiWarCampaign,
  hiddenCloud: hiddenCloudCampaign,
  hiddenLeaf: hiddenLeafCampaign,
  hiddenMist: hiddenMistCampaign,
  hiddenSand: hiddenSandCampaign,
  hiddenStone: hiddenStoneCampaign,
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
      // Campaign map marks (their meaning lives in the mission layout):
      // a secret room's cracked wall breaks like a crate, a hidden passage is
      // open floor drawn as a false wall, and an arena gate is a wall until
      // the boss arena opens.
      case 'C':
        return 'Box';
      case 'H':
        return 'Empty';
      case 'G':
        return 'Wall';
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

/** The authored rows a village's campaign mission plays on (solo or co-op). */
export function loadCampaignMapRows(mapId: string): string[][] {
  const mapText = CAMPAIGN_MAP_TEXT[mapId];
  return mapText === undefined ? loadStageMapRows(mapId) : parseMapText(mapText);
}
