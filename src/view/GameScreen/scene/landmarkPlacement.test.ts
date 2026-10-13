import * as THREE from 'three';
import { STAGE_DEFINITIONS } from '../../../content/stages';
import { StageLandmarkKind, getStageLook } from '../../../content/stageLooks';
import {
  CAMERA_BACK,
  CAMERA_HEIGHT,
  FRAME_MARGIN,
  WIDEST_SPREAD,
  framingScaleFor,
  groupShift,
  hudInsets,
  maxFramingFor,
} from './cameraFraming';
import { toWorld } from './sceneSpace';
import {
  LANDMARK_EXTENTS,
  SIDE_DEPTH_SHARE,
  StagePropInstance,
  placeStageProps,
  propKeepOut,
} from './landmarkPlacement';
import { PROP_BASE_Y, stagePropLayers } from './StageLandmarks';
import { buildLandmarkGeometry } from './landmarkGeometry';

// The 35x35 arena maps and the 50x50 campaign maps.
const SIZES = [35, 50];
const COLORS = {
  body: '#777777', trim: '#555555', accent: '#ff8800', pad: '#666666',
};

function allStageProps(MAP: number): { stageId: string; props: StagePropInstance[] }[] {
  return STAGE_DEFINITIONS.map((stage) => ({
    stageId: stage.id,
    props: placeStageProps(getStageLook(stage.id), MAP, MAP),
  }));
}

// A prop's world-space box: its footprint (radius wide, half depth deep), base to top.
function propBox(prop: StagePropInstance): THREE.Box3 {
  const [x, , z] = toWorld(prop.x, prop.y);
  return new THREE.Box3(
    new THREE.Vector3(x - prop.radius, PROP_BASE_Y, z - prop.halfDepth),
    new THREE.Vector3(x + prop.radius, PROP_BASE_Y + prop.height, z + prop.halfDepth)
  );
}

// Where CameraRig puts the camera for players spanning [minX..maxX] x [minY..maxY].
function cameraFor(
  view: { width: number; height: number },
  box: { minX: number; maxX: number; minY: number; maxY: number }
): THREE.Vector3 {
  const insets = hudInsets(100, view.width, view.height);
  const aspect = view.width / view.height;
  const halfWidth = (box.maxX - box.minX) / 2;
  const halfDepth = (box.maxY - box.minY) / 2;
  const maxFraming = maxFramingFor(aspect, insets);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
  const shift = groupShift(scale, halfWidth, halfDepth, insets);
  const [x, , z] = toWorld((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  return new THREE.Vector3(x, CAMERA_HEIGHT * scale, z + shift + CAMERA_BACK * scale);
}

// Points that must stay visible for a player standing on a cell: feet, body
// and the "P1" tag, at the cell's corners and centre.
function playerPoints(cellX: number, cellY: number): THREE.Vector3[] {
  const [x, , z] = toWorld(cellX, cellY);
  return [0, 0.9, FRAME_MARGIN.head].flatMap((h) => [
    [0, 0], [-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35],
  ].map(([dx, dz]) => new THREE.Vector3(x + dx, h, z + dz)));
}

const VIEWS = [{ width: 1366, height: 768 }, { width: 390, height: 844 }];

// Player spreads the engine allows: the two-player spawn corner, the widest
// escape spread pressed into the top-left corner, and a lone player on the
// right edge in the middle rows (where side landmarks stand).
const spreadsFor = (MAP: number) => [
  [[1, 1], [3, 1]],
  [[1, 1], [1 + WIDEST_SPREAD.halfWidth * 2, 1 + WIDEST_SPREAD.halfDepth * 2]],
  [[MAP - 2, 12]],
  [[1, MAP - 2], [MAP - 2, MAP - 2]],
];

describe.each(SIZES)('stage landmarks on a %i-cell board', (MAP) => {
  it('places the same landmarks every time, and different ones per stage', () => {
    const first = allStageProps(MAP);
    expect(allStageProps(MAP)).toEqual(first);
    first.forEach(({ props }) => expect(props.length).toBeGreaterThan(8));
    const layouts = new Set(first.map(({ props }) => (
      JSON.stringify(props.map((prop) => [prop.kind, prop.x, prop.y]))
    )));
    expect(layouts.size).toBe(STAGE_DEFINITIONS.length);
  });

  it('keeps every footprint off the board and off the near rows', () => {
    const keepOut = propKeepOut(MAP, MAP);
    allStageProps(MAP).forEach(({ props }) => {
      props.forEach((prop, index) => {
        const outside = prop.y + prop.halfDepth <= keepOut.minY + 1e-9
          || prop.x + prop.radius <= keepOut.minX + 1e-9
          || prop.x - prop.radius >= keepOut.maxX - 1e-9;
        expect(outside).toBe(true);
        if (prop.sector === 'far') expect(prop.y + prop.halfDepth).toBeLessThanOrEqual(keepOut.minY + 1e-9);
        else expect(prop.y + prop.radius).toBeLessThanOrEqual((MAP - 1) * SIDE_DEPTH_SHARE + 1e-9);
        props.slice(index + 1).forEach((other) => {
          expect(Math.hypot(other.x - prop.x, other.y - prop.y))
            .toBeGreaterThan(other.radius + prop.radius - 0.3);
        });
      });
    });
  });

  it('never stands between the camera and a player at any legal framing', () => {
    allStageProps(MAP).forEach(({ props }) => {
      const boxes = props.map(propBox);
      VIEWS.forEach((view) => {
        spreadsFor(MAP).forEach((players) => {
          const xs = players.map(([x]) => x);
          const ys = players.map(([, y]) => y);
          const camera = cameraFor(view, {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
          });
          players.forEach(([px, py]) => {
            playerPoints(px, py).forEach((point) => {
              const toPoint = point.clone().sub(camera);
              const ray = new THREE.Ray(camera, toPoint.clone().normalize());
              const hit = new THREE.Vector3();
              boxes.forEach((box) => {
                const crossing = ray.intersectBox(box, hit);
                const blocked = !!crossing && crossing.distanceTo(camera) < toPoint.length();
                expect(blocked).toBe(false);
              });
            });
          });
        });
      });
    });
  });

  it('stands each village\'s famous places on the skyline above the square', () => {
    const famous: Record<string, string[]> = {
      hiddenLeaf: ['hokageRock', 'hokageTower'],
      hiddenSand: ['kazekageDome', 'sandCliff'],
      hiddenMist: ['mizukageTower', 'mistBridge'],
      hiddenCloud: ['raikageTower'],
      hiddenStone: ['tsuchikageTower', 'rockBridge'],
      akatsukiHideout: ['demonStatue', 'hideoutCave'],
      greatShinobiWar: ['commandTent'],
    };
    // Where the camera stands for a player at the square's spawn (1,1).
    const camera = cameraFor(VIEWS[0], {
      minX: 1, maxX: 1, minY: 1, maxY: 1,
    });
    const view = new THREE.PerspectiveCamera(48, VIEWS[0].width / VIEWS[0].height, 0.1, 200);
    view.position.copy(camera);
    view.lookAt(new THREE.Vector3(toWorld(1, 1)[0], 0, toWorld(1, 1)[2]));
    view.updateMatrixWorld();
    allStageProps(MAP).forEach(({ stageId, props }) => {
      famous[stageId].forEach((kind) => {
        const placed = props.filter((prop) => prop.kind === kind);
        expect({ stageId, kind, count: placed.length }).toEqual({ stageId, kind, count: 1 });
        const [prop] = placed;
        expect(prop.sector).toBe('far');
        expect(prop.rotation).toBe(0);
        const anchor = getStageLook(stageId).landmarks.find((set) => set.kind === kind)!.anchor!;
        expect(prop.x).toBe(anchor.x);
      });
      // All of a village's famous places cost one draw together.
      expect(stagePropLayers(props).filter((layer) => layer.famous)).toHaveLength(1);
      // The first famous place faces the square's opening view.
      const [first] = props.filter((prop) => prop.kind === famous[stageId][0]);
      const [wx, , wz] = toWorld(first.x, first.y);
      const seen = new THREE.Vector3(wx, PROP_BASE_Y + first.height * 0.6, wz).project(view);
      expect({ stageId, onScreen: Math.abs(seen.x) < 1 && Math.abs(seen.y) < 1 })
        .toEqual({ stageId, onScreen: true });
    });
  });

  it('costs at most six instanced draws a stage', () => {
    allStageProps(MAP).forEach(({ props }) => {
      expect(stagePropLayers(props).length).toBeLessThanOrEqual(6);
    });
  });

  it('builds every landmark inside the extents placement relies on', () => {
    (Object.keys(LANDMARK_EXTENTS) as StageLandmarkKind[]).forEach((kind) => {
      const geometry = buildLandmarkGeometry(kind, COLORS);
      const positions = geometry.getAttribute('position');
      let reach = 0;
      let depth = 0;
      let top = -Infinity;
      let bottom = Infinity;
      for (let index = 0; index < positions.count; index += 1) {
        reach = Math.max(reach, Math.hypot(positions.getX(index), positions.getZ(index)));
        depth = Math.max(depth, Math.abs(positions.getZ(index)));
        top = Math.max(top, positions.getY(index));
        bottom = Math.min(bottom, positions.getY(index));
      }
      expect({ kind, fits: reach <= LANDMARK_EXTENTS[kind].radius }).toEqual({ kind, fits: true });
      expect({ kind, fits: top <= LANDMARK_EXTENTS[kind].height }).toEqual({ kind, fits: true });
      const { halfDepth } = LANDMARK_EXTENTS[kind];
      expect({ kind, fits: depth <= (halfDepth ?? Infinity) }).toEqual({ kind, fits: true });
      expect(bottom).toBeGreaterThan(-0.15);
      // Flat-shaded faces and one colour per vertex, ready for one draw.
      expect(geometry.getAttribute('color').count).toBe(positions.count);
      geometry.dispose();
    });
  });
});
