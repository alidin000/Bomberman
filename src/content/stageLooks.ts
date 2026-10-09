import { StageId } from './types';
import { getStageDefinition } from './stages';

/**
 * Off-grid landmark shapes. Each one is a single low-poly silhouette drawn
 * outside the playable rectangle, so the grid itself stays as quiet as it is.
 */
export type StageLandmarkKind =
  | 'marketStall'
  | 'rootArch'
  | 'cedar'
  | 'terraceBlock'
  | 'kilnDome'
  | 'clothTower'
  | 'dockPier'
  | 'reedScreen'
  | 'stiltHut'
  | 'snowTemple'
  | 'ropeSpan'
  | 'snowPeak'
  | 'strataPillar'
  | 'quarryStep'
  | 'boulder'
  | 'inkSpire'
  | 'ruinedScreen'
  | 'cavernArch'
  | 'warBanner'
  | 'paperShard'
  | 'stakeFence';

/** The far skyline behind the top rows, or the left and right margins. */
export type StageLandmarkSector = 'far' | 'side';

export interface StageLandmarkSet {
  kind: StageLandmarkKind;
  sector: StageLandmarkSector;
  /** Main mass, then the secondary material (roofs, caps, bark, frames). */
  body: string;
  trim: string;
  /** Relative share of the sector's slots this landmark takes. */
  weight: number;
  /** Instance scale range. */
  scale: [number, number];
}

/**
 * How a stage looks around the grid: the sky behind the arena, one linear fog,
 * the colours of the three scene lights and an accent. Pure data; the scene
 * recolours its existing lights from it and never adds one.
 */
export interface StageLook {
  stageId: StageId;
  /** The place the margin should read as, in a few words. */
  motif: string;
  /** CSS gradient behind the canvas: top of the screen, mid band, bottom. */
  sky: { top: string; horizon: string; low: string };
  /**
   * Linear fog. It starts at the board's far edge, so no playable cell is
   * ever fogged, and reaches full strength `range` depth units beyond it.
   */
  fog: { color: string; range: number };
  ambient: { color: string; intensity: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  directional: { color: string; intensity: number };
  /** The stage palette's accent, used on landmark cloth, lanterns and tags. */
  accent: string;
  landmarks: StageLandmarkSet[];
}

type StageLookData = Omit<StageLook, 'stageId' | 'accent'>;

const STAGE_LOOK_DATA: Record<StageId, StageLookData> = {
  hiddenLeaf: {
    motif: 'Timber market under giant roots',
    sky: { top: '#7fa9b6', horizon: '#cfdcc0', low: '#9fb59a' },
    fog: { color: '#cbd8bd', range: 5 },
    ambient: { color: '#fff8ec', intensity: 0.55 },
    hemisphere: { sky: '#fff1d6', ground: '#4f6b55', intensity: 0.85 },
    directional: { color: '#ffecc9', intensity: 1.7 },
    landmarks: [
      {
        kind: 'cedar', sector: 'far', body: '#5a3f31', trim: '#35543f', weight: 2, scale: [0.9, 1.2],
      },
      {
        kind: 'rootArch', sector: 'far', body: '#6b4a36', trim: '#4a3427', weight: 1.4, scale: [0.9, 1.2],
      },
      {
        kind: 'marketStall', sector: 'side', body: '#8a5a3c', trim: '#3b3346', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  hiddenSand: {
    motif: 'Kiln terraces and cloth towers',
    sky: { top: '#b98463', horizon: '#efd2a6', low: '#d6ad84' },
    fog: { color: '#ecd0a4', range: 6 },
    ambient: { color: '#fff1e0', intensity: 0.52 },
    hemisphere: { sky: '#ffe9c4', ground: '#7a5a44', intensity: 0.85 },
    directional: { color: '#ffe2b0', intensity: 1.8 },
    landmarks: [
      {
        kind: 'terraceBlock', sector: 'far', body: '#c4946a', trim: '#8c5f43', weight: 1.6, scale: [0.9, 1.3],
      },
      {
        kind: 'clothTower', sector: 'far', body: '#7d5640', trim: '#e4d3b4', weight: 1, scale: [0.85, 1.1],
      },
      {
        kind: 'kilnDome', sector: 'side', body: '#b87452', trim: '#4b3429', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  hiddenMist: {
    motif: 'Marsh docks behind reed screens',
    sky: { top: '#5f828c', horizon: '#b6cac8', low: '#88a3a3' },
    fog: { color: '#b2c6c4', range: 3.5 },
    ambient: { color: '#eef6f6', intensity: 0.62 },
    hemisphere: { sky: '#e4f1f1', ground: '#3f5d66', intensity: 0.95 },
    directional: { color: '#e8f2f0', intensity: 1.4 },
    landmarks: [
      {
        kind: 'stiltHut', sector: 'far', body: '#4c626b', trim: '#26333b', weight: 1.2, scale: [0.9, 1.2],
      },
      {
        kind: 'dockPier', sector: 'far', body: '#55646a', trim: '#2b363c', weight: 1.4, scale: [1, 1.3],
      },
      {
        kind: 'reedScreen', sector: 'side', body: '#6f8f86', trim: '#2f3f48', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  hiddenCloud: {
    motif: 'Snow temples on rope spans',
    sky: { top: '#6f86ad', horizon: '#dfe7f2', low: '#aab8cf' },
    fog: { color: '#e0e8f2', range: 7 },
    ambient: { color: '#f2f6ff', intensity: 0.55 },
    hemisphere: { sky: '#eef4ff', ground: '#56607a', intensity: 0.88 },
    directional: { color: '#fbfdff', intensity: 1.75 },
    landmarks: [
      {
        kind: 'snowPeak', sector: 'far', body: '#5d6880', trim: '#eef3f8', weight: 1.4, scale: [0.9, 1.3],
      },
      {
        kind: 'snowTemple', sector: 'far', body: '#5a4e63', trim: '#e8eef5', weight: 1.2, scale: [0.9, 1.15],
      },
      {
        kind: 'ropeSpan', sector: 'side', body: '#4d5466', trim: '#c9b98f', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  hiddenStone: {
    motif: 'Layered quarry and strata pillars',
    sky: { top: '#8e8c7d', horizon: '#d8d3c1', low: '#b2ac98' },
    fog: { color: '#d3cebb', range: 5.5 },
    ambient: { color: '#f5f2ea', intensity: 0.56 },
    hemisphere: { sky: '#f3eedf', ground: '#5f5a4d', intensity: 0.86 },
    directional: { color: '#fff2dc', intensity: 1.65 },
    landmarks: [
      {
        kind: 'strataPillar', sector: 'far', body: '#8a8170', trim: '#5e5648', weight: 1.6, scale: [0.9, 1.3],
      },
      {
        kind: 'quarryStep', sector: 'far', body: '#9a907c', trim: '#6c6455', weight: 1, scale: [0.9, 1.2],
      },
      {
        kind: 'boulder', sector: 'side', body: '#7c7466', trim: '#5a5348', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  akatsukiHideout: {
    motif: 'Ink cavern with ruined screens',
    sky: { top: '#231d2b', horizon: '#56475e', low: '#3a3042' },
    fog: { color: '#4b3e54', range: 4 },
    ambient: { color: '#efe6f2', intensity: 0.6 },
    hemisphere: { sky: '#f0e2ee', ground: '#3d2c45', intensity: 0.9 },
    directional: { color: '#f3dfe6', intensity: 1.55 },
    landmarks: [
      {
        kind: 'inkSpire', sector: 'far', body: '#2c2533', trim: '#47394f', weight: 1.6, scale: [0.9, 1.3],
      },
      {
        kind: 'cavernArch', sector: 'far', body: '#3a3142', trim: '#251f2b', weight: 1, scale: [0.9, 1.2],
      },
      {
        kind: 'ruinedScreen', sector: 'side', body: '#2b2230', trim: '#d6ccbd', weight: 1, scale: [0.8, 1],
      },
    ],
  },
  greatShinobiWar: {
    motif: 'Scarred paper and a banner field',
    sky: { top: '#555266', horizon: '#d6b698', low: '#9a8a86' },
    fog: { color: '#c9b09b', range: 5 },
    ambient: { color: '#f6eee8', intensity: 0.56 },
    hemisphere: { sky: '#fdebdc', ground: '#4b4652', intensity: 0.86 },
    directional: { color: '#ffe4cc', intensity: 1.7 },
    landmarks: [
      {
        kind: 'warBanner', sector: 'far', body: '#3a3036', trim: '#e3d6c2', weight: 1.6, scale: [0.9, 1.2],
      },
      {
        kind: 'paperShard', sector: 'far', body: '#e2d8c6', trim: '#2d2629', weight: 1.2, scale: [0.9, 1.3],
      },
      {
        kind: 'stakeFence', sector: 'side', body: '#5a4a40', trim: '#2d2629', weight: 1, scale: [0.8, 1],
      },
    ],
  },
};

export const STAGE_LOOKS: Record<StageId, StageLook> = Object.fromEntries(
  (Object.keys(STAGE_LOOK_DATA) as StageId[]).map((stageId) => [stageId, {
    stageId,
    accent: getStageDefinition(stageId).palette.accent,
    ...STAGE_LOOK_DATA[stageId],
  }])
) as Record<StageId, StageLook>;

/** The look of a stage; unknown ids fall back like getStageDefinition does. */
export function getStageLook(id?: string): StageLook {
  return STAGE_LOOKS[getStageDefinition(id).id];
}

/** The sky behind the canvas, as a CSS background. */
export function stageSkyBackground(look: StageLook): string {
  return `linear-gradient(180deg, ${look.sky.top} 0%, ${look.sky.horizon} 46%, ${look.sky.low} 100%)`;
}
