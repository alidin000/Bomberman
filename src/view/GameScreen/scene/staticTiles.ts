import { StageDefinition } from '../../../content/types';
import { cellKey } from '../../../engine/fogOfWar';
import type { CampaignRuntimeState } from '../../../engine/types';
import { GameMap, isObstacle } from '../../../model/gameItem';

type StagePalette = StageDefinition['palette'];

/**
 * One instanced draw per entry. Cells are split by whatever cannot vary per
 * instance (opacity, emissive colour/intensity, shadow flags); the diffuse
 * colour of each cell travels as an instance colour.
 */
export const STATIC_TILE_LAYER_IDS = [
  'groundVisible',
  'groundExplored',
  'groundHidden',
  'wallVisible',
  'wallExplored',
  'crateVisible',
  'crateDestroyed',
  'crateExplored',
  // Campaign map features. Same material settings as the walls (no new
  // shader program); an empty layer draws nothing.
  'crackedVisible',
  'crackedExplored',
  'passageVisible',
  'passageExplored',
  'gateVisible',
  'gateExplored',
] as const;

export type StaticTileLayerId = typeof STATIC_TILE_LAYER_IDS[number];

export type StaticTileShape = 'ground' | 'wall' | 'crate' | 'cracked' | 'passage' | 'gate';

/**
 * Cells the campaign draws as something other than a plain wall or crate:
 * secret-room cracked walls (crates that look like split masonry), hidden
 * passages (open floor drawn as a seamed false wall until the room is found)
 * and shut boss-arena gates. Each set holds "x,y" keys.
 */
export type StaticTileFeatures = {
  cracked: ReadonlySet<string>;
  passages: ReadonlySet<string>;
  gates: ReadonlySet<string>;
};

export const NO_TILE_FEATURES: StaticTileFeatures = {
  cracked: new Set(),
  passages: new Set(),
  gates: new Set(),
};

/**
 * The campaign's feature cells as one string, so the scene rebuilds the tile
 * layers only when a feature really changes (a hidden passage is found), not
 * whenever a snapshot hands over a new campaign object.
 */
export function campaignTileFeatureKey(campaign: CampaignRuntimeState | null | undefined): string {
  if (!campaign) return '';
  const cracked: string[] = [];
  const passages: string[] = [];
  campaign.hiddenAreas.forEach((area) => {
    if (!area.room) return;
    const key = cellKey(area.room.door.x, area.room.door.y);
    if (area.room.entry === 'crackedWall') cracked.push(key);
    else if (!campaign.discoveredSecrets.includes(area.id)) passages.push(key);
  });
  const gates = (campaign.bossArena.gates ?? []).map((gate) => cellKey(gate.x, gate.y));
  return [cracked, passages, gates].map((keys) => keys.join(';')).join('|');
}

export function tileFeaturesFromKey(key: string): StaticTileFeatures {
  if (!key) return NO_TILE_FEATURES;
  const [cracked, passages, gates] = key.split('|')
    .map((part) => new Set(part ? part.split(';') : []));
  return { cracked, passages, gates };
}

export type StaticTileInstance = {
  x: number;
  y: number;
  color: string;
};

export type StaticTileLayers = Record<StaticTileLayerId, StaticTileInstance[]>;

export type StaticTileLayerStyle = {
  shape: StaticTileShape;
  /** Set only for translucent layers. */
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness: number;
  castShadow: boolean;
  receiveShadow: boolean;
};

export const EXPLORED_GROUND_COLOR = '#777e86';
export const HIDDEN_GROUND_COLOR = '#353942';
export const EXPLORED_WALL_COLOR = '#5d6570';
export const DESTROYED_CRATE_COLOR = '#795d59';
export const EXPLORED_CRATE_COLOR = '#68616a';
const FOG_EMISSIVE = '#11151c';
const DESTROYED_CRATE_EMISSIVE = '#4c3030';

export function getStaticTileLayerStyles(
  palette: StagePalette
): Record<StaticTileLayerId, StaticTileLayerStyle> {
  const ground = {
    shape: 'ground' as const, roughness: 0.92, castShadow: false, receiveShadow: true
  };
  const wall = {
    shape: 'wall' as const, metalness: 0, roughness: 1, castShadow: true, receiveShadow: true
  };
  const crate = {
    shape: 'crate' as const, roughness: 1, castShadow: true, receiveShadow: true
  };
  // Feature tiles keep the wall material (one shader program for all).
  const feature = (
    shape: StaticTileShape,
    emissive: string,
    emissiveIntensity: number
  ): StaticTileLayerStyle => ({
    ...wall, shape, emissive, emissiveIntensity,
  });
  return {
    groundVisible: ground,
    groundExplored: ground,
    groundHidden: ground,
    wallVisible: { ...wall, emissive: palette.wall, emissiveIntensity: 0.02 },
    wallExplored: { ...wall, emissive: FOG_EMISSIVE, emissiveIntensity: 0.02 },
    crateVisible: { ...crate, emissive: palette.crate, emissiveIntensity: 0.04 },
    crateDestroyed: { ...crate, emissive: DESTROYED_CRATE_EMISSIVE, emissiveIntensity: 0.04 },
    crateExplored: { ...crate, emissive: FOG_EMISSIVE, emissiveIntensity: 0.02 },
    crackedVisible: feature('cracked', palette.wall, 0.02),
    crackedExplored: feature('cracked', FOG_EMISSIVE, 0.02),
    passageVisible: feature('passage', palette.wall, 0.02),
    passageExplored: feature('passage', FOG_EMISSIVE, 0.02),
    gateVisible: feature('gate', palette.accent, 0.12),
    gateExplored: feature('gate', FOG_EMISSIVE, 0.02),
  };
}

export function createEmptyStaticTileLayers(): StaticTileLayers {
  return {
    groundVisible: [],
    groundExplored: [],
    groundHidden: [],
    wallVisible: [],
    wallExplored: [],
    crateVisible: [],
    crateDestroyed: [],
    crateExplored: [],
    crackedVisible: [],
    crackedExplored: [],
    passageVisible: [],
    passageExplored: [],
    gateVisible: [],
    gateExplored: [],
  };
}

/**
 * The first instance that differs between the last build of a layer and the
 * next one, or -1 when they match. A step on a 50x50 map changes a few cells,
 * so StaticTiles rewrites only from here on, and skips unchanged layers.
 */
export function firstChangedTile(
  previous: readonly StaticTileInstance[],
  next: readonly StaticTileInstance[]
): number {
  const shared = Math.min(previous.length, next.length);
  for (let index = 0; index < shared; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (before.x !== after.x || before.y !== after.y || before.color !== after.color) {
      return index;
    }
  }
  return previous.length === next.length ? -1 : shared;
}

// "x,y" fog keys for every cell, built once per row width and reused: a fog
// step rebuilds the layers of all 2,500 cells of a 50x50 map without
// allocating a key string per cell.
const keyRows = new Map<number, string[][]>();

function cellKeyRow(y: number, width: number): string[] {
  let rows = keyRows.get(width);
  if (!rows) {
    rows = [];
    keyRows.set(width, rows);
  }
  let row = rows[y];
  if (!row) {
    row = Array.from({ length: width }, (_, x) => cellKey(x, y));
    rows[y] = row;
  }
  return row;
}

export function getMapCellCount(map: GameMap): number {
  return map.reduce((total, row) => total + row.length, 0);
}

/**
 * Buckets every map cell into the static (non-animated) tile layers. Hidden
 * cells only get fogged ground; walls, crates and player obstacles appear once
 * a cell has been explored. Bombs and power-ups are animated per cell, so they
 * stay out of these layers.
 */
export function buildStaticTileLayers(
  map: GameMap,
  palette: StagePalette,
  visibleCells: ReadonlySet<string>,
  exploredCells: ReadonlySet<string>,
  destroyedCells: ReadonlySet<string>,
  features: StaticTileFeatures = NO_TILE_FEATURES
): StaticTileLayers {
  const layers = createEmptyStaticTileLayers();
  // The camera always looks toward -z (lower rows), so walking rows from the
  // bottom up emits opaque instances roughly near-to-far and lets the depth
  // test reject hidden wall and crate fragments early.
  for (let y = map.length - 1; y >= 0; y -= 1) {
    const keys = cellKeyRow(y, map[y].length);
    map[y].forEach((cell, x) => {
      const key = keys[x];
      if (visibleCells.has(key)) {
        layers.groundVisible.push({ x, y, color: (x + y) % 2 ? palette.groundA : palette.groundB });
      } else if (exploredCells.has(key)) {
        layers.groundExplored.push({ x, y, color: EXPLORED_GROUND_COLOR });
      } else {
        layers.groundHidden.push({ x, y, color: HIDDEN_GROUND_COLOR });
        return;
      }

      const explored = !visibleCells.has(key);
      if (cell === 'Wall' && features.gates.has(key)) {
        if (explored) layers.gateExplored.push({ x, y, color: EXPLORED_WALL_COLOR });
        else layers.gateVisible.push({ x, y, color: palette.accent });
        return;
      }
      if (cell === 'Box' && features.cracked.has(key)) {
        if (explored) layers.crackedExplored.push({ x, y, color: EXPLORED_WALL_COLOR });
        else layers.crackedVisible.push({ x, y, color: palette.wall });
        return;
      }
      if (features.passages.has(key) && cell === 'Empty') {
        if (explored) layers.passageExplored.push({ x, y, color: EXPLORED_WALL_COLOR });
        else layers.passageVisible.push({ x, y, color: palette.wall });
        return;
      }
      if (cell === 'Wall') {
        if (explored) layers.wallExplored.push({ x, y, color: EXPLORED_WALL_COLOR });
        else layers.wallVisible.push({ x, y, color: palette.wall });
        return;
      }
      if (cell !== 'Box' && !isObstacle(cell)) return;
      if (explored) {
        layers.crateExplored.push({ x, y, color: EXPLORED_CRATE_COLOR });
      } else if (cell === 'Box' && destroyedCells.has(key)) {
        layers.crateDestroyed.push({ x, y, color: DESTROYED_CRATE_COLOR });
      } else {
        layers.crateVisible.push({ x, y, color: palette.crate });
      }
    });
  }
  return layers;
}
