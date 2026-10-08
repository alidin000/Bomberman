import { StageDefinition } from '../../../content/types';
import { cellKey } from '../../../engine/fogOfWar';
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
] as const;

export type StaticTileLayerId = typeof STATIC_TILE_LAYER_IDS[number];

export type StaticTileShape = 'ground' | 'wall' | 'crate';

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
  return {
    groundVisible: ground,
    groundExplored: ground,
    groundHidden: ground,
    wallVisible: { ...wall, emissive: palette.wall, emissiveIntensity: 0.02 },
    wallExplored: { ...wall, emissive: FOG_EMISSIVE, emissiveIntensity: 0.02 },
    crateVisible: { ...crate, emissive: palette.crate, emissiveIntensity: 0.04 },
    crateDestroyed: { ...crate, emissive: DESTROYED_CRATE_EMISSIVE, emissiveIntensity: 0.04 },
    crateExplored: { ...crate, emissive: FOG_EMISSIVE, emissiveIntensity: 0.02 },
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
  };
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
  destroyedCells: ReadonlySet<string>
): StaticTileLayers {
  const layers = createEmptyStaticTileLayers();
  // The camera always looks toward -z (lower rows), so walking rows from the
  // bottom up emits opaque instances roughly near-to-far and lets the depth
  // test reject hidden wall and crate fragments early.
  for (let y = map.length - 1; y >= 0; y -= 1) {
    map[y].forEach((cell, x) => {
      const key = cellKey(x, y);
      if (visibleCells.has(key)) {
        layers.groundVisible.push({ x, y, color: (x + y) % 2 ? palette.groundA : palette.groundB });
      } else if (exploredCells.has(key)) {
        layers.groundExplored.push({ x, y, color: EXPLORED_GROUND_COLOR });
      } else {
        layers.groundHidden.push({ x, y, color: HIDDEN_GROUND_COLOR });
        return;
      }

      const explored = !visibleCells.has(key);
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
