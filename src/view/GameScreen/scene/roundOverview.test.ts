import * as THREE from 'three';
import { createInitialState, ROUND_START_COUNTDOWN_MS } from '../../../engine/initialState';
import { parseMapRows } from '../../../engine/mapLoader';
import { arenaMapRows } from '../../../content/arenaMaps';
import { GameEngineState } from '../../../engine/types';
import { CAMERA_BACK, CAMERA_HEIGHT, MAX_FRAMING } from './cameraFraming';
import { ARENA_FRAME_PX, canvasHudInsets } from './canvasInsets';
import {
  OVERVIEW_END_MS,
  OVERVIEW_PUSH,
  boardOverview,
  overviewDue,
  overviewInsets,
  overviewMs,
  overviewPush,
} from './roundOverview';
import { OVERVIEW_PLATE } from '../../CityArena/overviewPlate';
import { toWorld } from './sceneSpace';

function arena(selectedMap: string, mode: 'local' | 'solo' = 'local'): GameEngineState {
  return createInitialState({
    mode,
    numPlayers: 2,
    totalRounds: 3,
    selectedMap,
    stageId: 'hiddenLeaf',
    map: parseMapRows(selectedMap === 'rome' ? arenaMapRows('rome') : arenaMapRows('hiddenLeaf')),
  });
}

describe('round-start overview', () => {
  it('is due in a city\'s first countdown only, and never on a village or in the campaign', () => {
    const rome = arena('rome');
    expect(rome.roundStartTicksRemaining).toBe(ROUND_START_COUNTDOWN_MS);
    expect(overviewDue(rome)).toBe(true);
    expect(overviewDue({ ...rome, roundStartTicksRemaining: OVERVIEW_END_MS + 1 })).toBe(true);
    // The countdown's last second is on the players, and so is play.
    expect(overviewDue({ ...rome, roundStartTicksRemaining: OVERVIEW_END_MS })).toBe(false);
    expect(overviewDue({ ...rome, roundStartTicksRemaining: 0 })).toBe(false);
    // Later rounds open on the players.
    expect(overviewDue({ ...rome, round: 2 })).toBe(false);
    expect(overviewDue({ ...rome, phase: 'round_end' })).toBe(false);
    expect(overviewDue(arena('hiddenLeaf'))).toBe(false);
    expect(overviewDue(arena('rome', 'solo'))).toBe(false);
    expect(overviewDue(null)).toBe(false);
  });

  it('runs on the countdown clock and pushes in slowly, holding still under reduced motion', () => {
    expect(overviewMs(ROUND_START_COUNTDOWN_MS)).toBe(0);
    expect(overviewMs(2000)).toBe(1000);
    expect(overviewMs(OVERVIEW_END_MS)).toBeNull();
    expect(overviewMs(Number.NaN)).toBeNull();
    const span = ROUND_START_COUNTDOWN_MS - OVERVIEW_END_MS;
    expect(overviewPush(0, false)).toBe(1);
    expect(overviewPush(span / 2, false)).toBeLessThan(1);
    expect(overviewPush(span, false)).toBeCloseTo(OVERVIEW_PUSH, 6);
    [0, span / 2, span].forEach((ms) => expect(overviewPush(ms, true)).toBe(1));
  });

  it.each([
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ])('frames the whole 35x35 board clear of the HUD bands and the plate at $width x $height', (view) => {
    // CameraRig's view: the canvas inside the arena frame, with the HUD's bands
    // and the bottom one raised to the plate's (the countdown is in the plate).
    const width = view.width - 2 * ARENA_FRAME_PX;
    const height = view.height - 2 * ARENA_FRAME_PX;
    const hud = canvasHudInsets(100, width, height);
    const insets = overviewInsets(hud, height);
    // The plate's top edge on the canvas, as a fraction from the top.
    const platePx = OVERVIEW_PLATE.gapPx + OVERVIEW_PLATE.heightPx - ARENA_FRAME_PX;
    const plateTop = 1 - platePx / height;
    const aspect = width / height;
    const board = boardOverview(35, 35, aspect, insets);
    // Further out than any play framing, so it shows what play never does.
    expect(board.scale).toBeGreaterThan(MAX_FRAMING);
    const [x, , z] = toWorld(board.centerX, board.centerY);
    const aimZ = z + board.shift;
    const camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 1000);
    // The pushed-in end of the overview is its tightest view.
    const scale = board.scale * OVERVIEW_PUSH;
    camera.position.set(x, CAMERA_HEIGHT * scale, aimZ + CAMERA_BACK * scale);
    camera.lookAt(x, 0, aimZ);
    camera.updateMatrixWorld();
    // The board's outer corners, cell edges included.
    [[-0.5, -0.5], [34.5, -0.5], [-0.5, 34.5], [34.5, 34.5]].forEach(([cx, cy]) => {
      const [wx, , wz] = toWorld(cx, cy);
      const point = new THREE.Vector3(wx, 0, wz).project(camera);
      // Screen fractions, 0 at the top: under the top HUD band, above the bottom one.
      const screenY = (1 - point.y) / 2;
      const screenX = (1 + point.x) / 2;
      expect(screenY).toBeGreaterThan(insets.top - 0.02);
      // Nothing of the board runs under the plate or the HUD, even at the push-in's end.
      expect(screenY).toBeLessThan(Math.min(plateTop, 1 - hud.bottom));
      expect(screenX).toBeGreaterThan(0);
      expect(screenX).toBeLessThan(1);
    });
  });
});
