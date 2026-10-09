import {
  StageLandmarkKind, StageLandmarkSet, StageLook,
} from '../../../content/stageLooks';

/**
 * Off-grid landmarks: where they stand. Pure and deterministic, so the same
 * stage and map size always give the same skyline, and tests can check that
 * nothing ever lands on, or in front of, the playable rectangle.
 *
 * Coordinates are map cells (x right, y down the map toward the camera), the
 * same space as `toWorld`. The camera always sits south of the board (larger
 * y) and inside its column span, which is why props only go on the far (top)
 * margin and the left and right margins: from there no prop can come between
 * the camera and anything on the board.
 */

/** Footprint radius and height of each landmark at scale 1, in cells. */
export const LANDMARK_EXTENTS: Record<StageLandmarkKind, { radius: number; height: number }> = {
  marketStall: { radius: 1.05, height: 1.95 },
  rootArch: { radius: 1.75, height: 2.2 },
  cedar: { radius: 1.25, height: 5.4 },
  terraceBlock: { radius: 1.6, height: 1.9 },
  kilnDome: { radius: 1.1, height: 1.75 },
  clothTower: { radius: 0.8, height: 4.4 },
  dockPier: { radius: 1.35, height: 1.2 },
  reedScreen: { radius: 1.05, height: 2.9 },
  stiltHut: { radius: 1.2, height: 3.1 },
  snowTemple: { radius: 1.45, height: 4.2 },
  ropeSpan: { radius: 2.05, height: 2.3 },
  snowPeak: { radius: 1.6, height: 5.6 },
  strataPillar: { radius: 0.95, height: 3.8 },
  quarryStep: { radius: 1.75, height: 2.15 },
  boulder: { radius: 0.9, height: 1.2 },
  inkSpire: { radius: 1.15, height: 4.2 },
  ruinedScreen: { radius: 1.05, height: 2.1 },
  cavernArch: { radius: 1.75, height: 3.7 },
  warBanner: { radius: 0.75, height: 3.5 },
  paperShard: { radius: 1.05, height: 2.0 },
  stakeFence: { radius: 1.45, height: 1.4 },
};

export type StagePropSector = 'far' | 'left' | 'right';

export type StagePropInstance = {
  kind: StageLandmarkKind;
  sector: StagePropSector;
  /** 0 is the row nearest the board; the far skyline has three. */
  layer: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** Footprint radius and height after scaling, in cells. */
  radius: number;
  height: number;
  /** Value multiplier for the instance colour: back layers sit darker. */
  shade: number;
};

/** Half a cell plus the floor slab's lip (Floor draws width + 1.1). */
export const BOARD_LIP = 0.55;
/** Free cells kept between the floor slab and the nearest landmark footprint. */
export const PROP_CLEARANCE = 0.9;
/**
 * Side landmarks stop this far down the map (share of its height), so the
 * rows nearest the camera never have scenery beside them.
 */
export const SIDE_DEPTH_SHARE = 0.62;

const FAR_LAYERS = [
  {
    y: -2.3, step: 3.1, density: 0.82, grow: 1,
  },
  {
    y: -5.2, step: 3.7, density: 0.72, grow: 1.15,
  },
  {
    y: -8.6, step: 4.4, density: 0.66, grow: 1.3,
  },
];
const SIDE_COLUMNS = [
  { offset: 2.1, step: 3.4, density: 0.78 },
  { offset: 4.9, step: 4.1, density: 0.6 },
];
const FAR_OVERHANG = 7;

function hashSeed(text: string): number {
  let hash = 7;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

/** Park-Miller minimal standard generator: identical on every platform. */
function createRandom(seed: number): () => number {
  let state = (seed % 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pickLandmark(
  sets: StageLandmarkSet[],
  random: () => number
): StageLandmarkSet | null {
  const total = sets.reduce((sum, set) => sum + set.weight, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (let index = 0; index < sets.length; index += 1) {
    roll -= sets[index].weight;
    if (roll <= 0) return sets[index];
  }
  return sets[sets.length - 1];
}

/** The rectangle no landmark footprint may enter: the slab plus clearance. */
export function propKeepOut(width: number, height: number) {
  const pad = BOARD_LIP + PROP_CLEARANCE;
  return {
    minX: -pad,
    maxX: width - 1 + pad,
    minY: -pad,
    maxY: height - 1 + pad,
  };
}

/**
 * Every landmark for a stage on a `width` x `height` map. The same inputs
 * always give the same list. Footprints never enter `propKeepOut`, never
 * overlap each other, and side landmarks stay in the upper part of the map.
 */
export function placeStageProps(
  look: StageLook,
  width: number,
  height: number
): StagePropInstance[] {
  const random = createRandom(hashSeed(`${look.stageId}:${width}x${height}`));
  const keepOut = propKeepOut(width, height);
  const farSets = look.landmarks.filter((set) => set.sector === 'far');
  const sideSets = look.landmarks.filter((set) => set.sector === 'side');
  const placed: StagePropInstance[] = [];

  const fits = (x: number, y: number, radius: number) => placed.every((other) => (
    Math.hypot(other.x - x, other.y - y) >= other.radius + radius - 0.25
  ));

  const tryPlace = (
    set: StageLandmarkSet,
    sector: StagePropSector,
    layer: number,
    rawX: number,
    rawY: number,
    grow: number
  ) => {
    const extents = LANDMARK_EXTENTS[set.kind];
    const [low, high] = set.scale;
    const scale = (low + (high - low) * random()) * grow;
    const radius = extents.radius * scale;
    let x = rawX;
    let y = rawY;
    if (sector === 'far') y = Math.min(y, keepOut.minY - radius);
    if (sector === 'left') x = Math.min(x, keepOut.minX - radius);
    if (sector === 'right') x = Math.max(x, keepOut.maxX + radius);
    if (sector !== 'far' && y + radius > (height - 1) * SIDE_DEPTH_SHARE) return;
    if (!fits(x, y, radius)) return;
    placed.push({
      kind: set.kind,
      sector,
      layer,
      x,
      y,
      rotation: (random() - 0.5) * 0.9,
      scale,
      radius,
      height: extents.height * scale,
      shade: 1 - layer * 0.07 - random() * 0.05,
    });
  };

  FAR_LAYERS.forEach((band, layer) => {
    for (let x = -FAR_OVERHANG; x <= width - 1 + FAR_OVERHANG; x += band.step) {
      const jitterX = (random() - 0.5) * band.step * 0.5;
      const jitterY = (random() - 0.5) * 1.1;
      const set = random() < band.density ? pickLandmark(farSets, random) : null;
      if (set) tryPlace(set, 'far', layer, x + jitterX, band.y + jitterY, band.grow);
    }
  });

  SIDE_COLUMNS.forEach((column, layer) => {
    (['left', 'right'] as const).forEach((sector) => {
      const edge = sector === 'left' ? keepOut.minX - column.offset : keepOut.maxX + column.offset;
      for (let y = keepOut.minY + 0.6; y < height; y += column.step) {
        const jitterX = (random() - 0.5) * 0.8;
        const jitterY = (random() - 0.5) * column.step * 0.45;
        const set = random() < column.density ? pickLandmark(sideSets, random) : null;
        if (set) tryPlace(set, sector, layer, edge + jitterX, y + jitterY, 1);
      }
    });
  });

  return placed;
}
