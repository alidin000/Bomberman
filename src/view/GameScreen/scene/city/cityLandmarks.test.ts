import * as THREE from 'three';
import { CITY_LOOKS, CityLookId, getLook } from '../../../../content/stageLooks';
import { PLAYER_SPAWNS } from '../../../../engine/constants';
import {
  CAMERA_BACK,
  CAMERA_HEIGHT,
  FRAME_MARGIN,
  WIDEST_SPREAD,
  framingScaleFor,
  groupShift,
  hudInsets,
  maxFramingFor,
  screenX,
  screenY,
} from '../cameraFraming';
import { ARENA_FRAME_PX, canvasHudInsets } from '../canvasInsets';
import { toWorld } from '../sceneSpace';
import {
  OPEN_SKY_MARGIN, SIDE_DEPTH_SHARE, StagePropInstance, placeStageProps, propKeepOut,
} from '../landmarkPlacement';
import { PROP_BASE_Y, stagePropLayers } from '../StageLandmarks';

// The city looks' skylines on the 35x35 arena board, held to the rules the
// villages' skylines meet (landmarkPlacement.test.ts).
const MAP = 35;
const VIEW = { width: 1366, height: 768 };
const CITY_IDS = Object.keys(CITY_LOOKS) as CityLookId[];

function cameraFor(box: { minX: number; maxX: number; minY: number; maxY: number }): THREE.Vector3 {
  const insets = hudInsets(100, VIEW.width, VIEW.height);
  const aspect = VIEW.width / VIEW.height;
  const halfWidth = (box.maxX - box.minX) / 2;
  const halfDepth = (box.maxY - box.minY) / 2;
  const maxFraming = maxFramingFor(aspect, insets);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
  const shift = groupShift(scale, halfWidth, halfDepth, insets);
  const [x, , z] = toWorld((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  return new THREE.Vector3(x, CAMERA_HEIGHT * scale, z + shift + CAMERA_BACK * scale);
}

/**
 * Where a point `h` cells above map cell (x, y) lands on a 1366x768 screen
 * (viewport px) at round start: the canvas inside the arena frame, framed on
 * the spawn block as CameraRig frames it, as the gates measure it.
 */
function spawnViewPoint(x: number, y: number, h: number): { px: number; py: number } {
  const width = VIEW.width - 2 * ARENA_FRAME_PX;
  const height = VIEW.height - 2 * ARENA_FRAME_PX;
  const insets = canvasHudInsets(100, width, height);
  const aspect = width / height;
  const xs = PLAYER_SPAWNS.map((spawn) => spawn.x);
  const ys = PLAYER_SPAWNS.map((spawn) => spawn.y);
  const halfWidth = (Math.max(...xs) - Math.min(...xs)) / 2;
  const halfDepth = (Math.max(...ys) - Math.min(...ys)) / 2;
  const maxFraming = maxFramingFor(aspect, insets);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
  const aimX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const aimY = (Math.max(...ys) + Math.min(...ys)) / 2
    + groupShift(scale, halfWidth, halfDepth, insets);
  return {
    px: ARENA_FRAME_PX + screenX(scale, x - aimX, y - aimY, h, aspect) * width,
    py: ARENA_FRAME_PX + screenY(scale, y - aimY, h) * height,
  };
}

/**
 * The HUD's match bar at 1366x768 (GameHUD.styles MissionStrip: 360 px wide,
 * centred, over the top edge) and the line under the top controls where the
 * seat cards start: whatever stands in the bar's column above it is hidden.
 */
const MATCH_BAR = { left: VIEW.width / 2 - 180, right: VIEW.width / 2 + 180, bottom: 84 };

function propBox(prop: StagePropInstance): THREE.Box3 {
  const [x, , z] = toWorld(prop.x, prop.y);
  return new THREE.Box3(
    new THREE.Vector3(x - prop.radius, PROP_BASE_Y, z - prop.halfDepth),
    new THREE.Vector3(x + prop.radius, PROP_BASE_Y + prop.height, z + prop.halfDepth)
  );
}

describe.each(CITY_IDS)('the %s skyline', (id) => {
  const look = getLook(id);
  const props = placeStageProps(look, MAP, MAP);
  const hero = look.landmarks.find((set) => set.anchor)!;

  it('stands its famous place once, square on, where its look anchors it', () => {
    expect(placeStageProps(look, MAP, MAP)).toEqual(props);
    const placed = props.filter((prop) => prop.kind === hero.kind);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      sector: 'far', rotation: 0, famous: true, x: hero.anchor!.x,
    });
    expect(props.length).toBeGreaterThan(8);
  });

  it('stands its silhouette in view at round start, clear of the HUD\'s match bar', () => {
    const [famous] = props.filter((prop) => prop.famous);
    // Half its height: the towers and roofs that make it recognisable, not its base.
    const { px, py } = spawnViewPoint(famous.x, famous.y, famous.height / 2);
    expect(px).toBeGreaterThan(0);
    expect(px).toBeLessThan(VIEW.width);
    expect(py).toBeGreaterThan(0);
    const underBar = py < MATCH_BAR.bottom && px > MATCH_BAR.left && px < MATCH_BAR.right;
    const seen = {
      id, px: Math.round(px), py: Math.round(py), underBar,
    };
    expect(seen).toMatchObject({ underBar: false });
  });

  it('leaves the sky behind its famous place open, so nothing merges with its silhouette', () => {
    const [famous] = props.filter((prop) => prop.famous);
    const behind = props.filter((prop) => !prop.famous && prop.sector === 'far' && prop.y < famous.y
      && Math.abs(prop.x - famous.x) < famous.radius + prop.radius + OPEN_SKY_MARGIN);
    expect(behind).toEqual([]);
    // The rest of the far band still fills in.
    expect(props.filter((prop) => !prop.famous && prop.sector === 'far').length).toBeGreaterThan(6);
  });

  it('keeps every footprint off the board and the near rows, in at most six draws', () => {
    const keepOut = propKeepOut(MAP, MAP);
    props.forEach((prop) => {
      if (prop.sector === 'far') expect(prop.y + prop.halfDepth).toBeLessThanOrEqual(keepOut.minY + 1e-9);
      else {
        const left = prop.x + prop.radius <= keepOut.minX + 1e-9;
        const right = prop.x - prop.radius >= keepOut.maxX - 1e-9;
        expect(left || right).toBe(true);
        expect(prop.y + prop.radius).toBeLessThanOrEqual((MAP - 1) * SIDE_DEPTH_SHARE + 1e-9);
      }
    });
    const layers = stagePropLayers(props);
    expect(layers.length).toBeLessThanOrEqual(6);
    expect(layers.filter((layer) => layer.famous)).toHaveLength(1);
  });

  it('shows its famous place from the spawns, and never hides a player behind scenery', () => {
    const camera = cameraFor({
      minX: 1, maxX: 1, minY: 1, maxY: 1,
    });
    const view = new THREE.PerspectiveCamera(48, VIEW.width / VIEW.height, 0.1, 200);
    view.position.copy(camera);
    view.lookAt(new THREE.Vector3(toWorld(1, 1)[0], 0, toWorld(1, 1)[2]));
    view.updateMatrixWorld();
    const [famous] = props.filter((prop) => prop.famous);
    const [wx, , wz] = toWorld(famous.x, famous.y);
    const seen = new THREE.Vector3(wx, PROP_BASE_Y + famous.height * 0.6, wz).project(view);
    expect(Math.abs(seen.x) < 1 && Math.abs(seen.y) < 1).toBe(true);

    const boxes = props.map(propBox);
    const spreads = [
      [[1, 1], [13, 8]],
      [[1, 1], [1 + WIDEST_SPREAD.halfWidth * 2, 1 + WIDEST_SPREAD.halfDepth * 2]],
      [[MAP - 2, 12]],
    ];
    spreads.forEach((players) => {
      const xs = players.map(([x]) => x);
      const ys = players.map(([, y]) => y);
      const eye = cameraFor({
        minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
      });
      players.forEach(([px, py]) => {
        const [x, , z] = toWorld(px, py);
        [0, 0.9, FRAME_MARGIN.head].forEach((h) => {
          const point = new THREE.Vector3(x, h, z);
          const toPoint = point.clone().sub(eye);
          const ray = new THREE.Ray(eye, toPoint.clone().normalize());
          const hit = new THREE.Vector3();
          boxes.forEach((box) => {
            const crossing = ray.intersectBox(box, hit);
            expect(!!crossing && crossing.distanceTo(eye) < toPoint.length()).toBe(false);
          });
        });
      });
    });
  });
});
