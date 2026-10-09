// The fighters' illustrated look at scene level: toon bands plus one ink
// outline per fighter that rides the pose and the KO hide, with every look a
// fighter can take mid-match (Ghost, KO, high contrast) compiled before play.
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';
import { CharacterId } from '../../content/types';
import { MotionStore, createMotionStore } from '../../hooks/motionStore';
import { CUE_DURATION_MS, CueStore, recordBodyCue } from '../../hooks/cueStore';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';

beforeAll(() => {
  installFakeWebGL();
});

function liveVersus(characters: CharacterId[]): GameEngineState {
  const state = createInitialState({
    mode: 'local',
    numPlayers: characters.length,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: characters,
    map: parseMapRows(defaultMap),
  });
  return { ...state, roundStartTicksRemaining: 0, tick: 40 };
}

function withGhost(state: GameEngineState, playerId: string): GameEngineState {
  return {
    ...state,
    timedPowerUps: {
      ...state.timedPowerUps,
      [playerId]: [{ power: 'Ghost', ticksRemaining: 5000, flashTicksRemaining: 0 }],
    },
  };
}

function knockedOut(state: GameEngineState, playerId: string): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => (
      player.id === playerId ? { ...player, alive: false } : player
    )),
  };
}

async function mount(
  state: GameEngineState,
  motion: MotionStore,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES
) {
  const scene3d = (next: GameEngineState, prefs: GamePreferences) => (
    <GameScene3D state={next} preferences={prefs} motion={motion} />
  );
  const view = render(scene3d(state, preferences));
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  // r3f mounts once its (debounced) size measurement lands.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  const root = () => {
    const found = _roots.get(canvas);
    if (!found) throw new Error('scene not mounted');
    return found.store.getState();
  };
  let time = 0;
  const frame = (ms = 16) => {
    time += ms;
    act(() => { advance(time); });
  };
  return {
    scene: () => root().scene,
    programs: () => root().gl.info.programs?.length ?? 0,
    frame,
    rerender: async (next: GameEngineState, prefs: GamePreferences = preferences) => {
      view.rerender(scene3d(next, prefs));
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
      frame();
    },
    unmount: () => view.unmount(),
  };
}

function find<T extends THREE.Object3D>(
  root: THREE.Object3D,
  test: (object: THREE.Object3D) => boolean
): T[] {
  const found: T[] = [];
  root.traverse((object) => { if (test(object)) found.push(object as T); });
  return found;
}

const inkOf = (scene: THREE.Scene, id: string) => (
  find<THREE.Mesh>(scene, (object) => object.userData.fighterInk === id)[0]
);

// The fighter's figure: the group holding its body capsule (radius 0.19).
function figureOf(scene: THREE.Scene, id: string): THREE.Object3D {
  const ring = find(scene, (object) => object.userData.playerRing === id)[0];
  const body = ring.parent as THREE.Object3D;
  const capsule = find<THREE.Mesh>(body, (object) => {
    const geometry = (object as THREE.Mesh).geometry as THREE.CapsuleGeometry | undefined;
    return geometry?.type === 'CapsuleGeometry' && geometry.parameters.radius === 0.19;
  })[0];
  return capsule.parent as THREE.Object3D;
}

function drawn(scene: THREE.Scene, object: THREE.Object3D): boolean {
  let seen = false;
  scene.traverseVisible((visible) => { if (visible === object) seen = true; });
  return seen;
}

function partMaterials(figure: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  figure.traverse((object) => {
    const { material } = object as THREE.Mesh;
    if (material) materials.push(material as THREE.Material);
  });
  return materials;
}

const isToon = (material: THREE.Material) => (
  !!(material as THREE.MeshToonMaterial).isMeshToonMaterial
);

const cuesOf = (motion: MotionStore) => motion.cues as CueStore;

describe('fighter ink outline', () => {
  it('outlines each fighter with one back-face hull that follows its pose and its KO hide', async () => {
    const state = knockedOut(liveVersus(['naruto', 'sasuke']), 'player2');
    const motion = createMotionStore();
    const cues = cuesOf(motion);
    recordBodyCue(cues, 'player1', 'hit', 0);
    recordBodyCue(cues, 'player2', 'death', 0);
    cues.clockMs = 400;
    const view = await mount(state, motion);
    view.frame();
    const scene = view.scene();
    const ink = inkOf(scene, 'player1');
    const figure = figureOf(scene, 'player1');
    expect(ink).toBeDefined();
    // One extra mesh per fighter: the parts share one welded hull.
    expect(find(scene, (object) => object.userData.fighterInk !== undefined)).toHaveLength(2);
    expect((ink.material as THREE.Material).side).toBe(THREE.BackSide);
    expect(ink.castShadow).toBe(false);

    // The hull lines up with the figure it outlines, part for part.
    scene.updateMatrixWorld(true);
    const hullBox = new THREE.Box3().setFromObject(ink, true);
    const figureBox = new THREE.Box3().setFromObject(figure, true);
    expect(hullBox.min.distanceTo(figureBox.min)).toBeLessThan(1e-3);
    expect(hullBox.max.distanceTo(figureBox.max)).toBeLessThan(1e-3);

    // Standing, then mid-hit (a lean and a squash): the hull is carried.
    const standing = ink.matrixWorld.clone();
    cues.clockMs = 40;
    view.frame();
    expect(ink.matrixWorld.equals(standing)).toBe(false);
    expect(ink.matrixWorld.equals(figure.matrixWorld)).toBe(true);

    // The fallen fighter's line shows for its death pose, then goes with it.
    const fallenInk = inkOf(scene, 'player2');
    cues.clockMs = 120;
    view.frame();
    expect(drawn(scene, fallenInk)).toBe(true);
    expect(fallenInk.matrixWorld.equals(figureOf(scene, 'player2').matrixWorld)).toBe(true);
    cues.clockMs = CUE_DURATION_MS.death + 20;
    view.frame();
    expect(drawn(scene, fallenInk)).toBe(false);
    expect(drawn(scene, ink)).toBe(true);
    view.unmount();
  });
});

describe('fighter looks are compiled before play', () => {
  it('turns Ghost on and off, KOs a fighter and switches high contrast without a new program', async () => {
    const live = liveVersus(['gaara', 'itachi', 'minato']);
    const motion = createMotionStore();
    const view = await mount(live, motion);
    view.frame();
    view.frame();
    const programs = view.programs();
    const scene = () => view.scene();
    const solid = partMaterials(figureOf(scene(), 'player1'));
    expect(solid.every(isToon)).toBe(true);
    expect(solid.some((material) => material.transparent)).toBe(false);

    // Ghost: the fighter turns see-through toon and drops its ink line.
    await view.rerender(withGhost(live, 'player1'));
    const ghosted = partMaterials(figureOf(scene(), 'player1'));
    expect(ghosted.filter((material) => material.transparent).length).toBeGreaterThan(5);
    expect(ghosted.every(isToon)).toBe(true);
    expect(drawn(scene(), inkOf(scene(), 'player1'))).toBe(false);
    await view.rerender(live);
    expect(drawn(scene(), inkOf(scene(), 'player1'))).toBe(true);

    // A KO poses and hides the fighter, ink and all.
    recordBodyCue(cuesOf(motion), 'player3', 'death', cuesOf(motion).clockMs);
    await view.rerender(knockedOut(live, 'player3'));
    cuesOf(motion).clockMs += CUE_DURATION_MS.death + 20;
    view.frame();
    expect(drawn(scene(), inkOf(scene(), 'player3'))).toBe(false);

    // High contrast inks the line black through its colour uniform.
    const ink = inkOf(scene(), 'player1').material as THREE.MeshBasicMaterial;
    const normal = ink.color.getHex();
    await view.rerender(live, { ...DEFAULT_GAME_PREFERENCES, highContrast: true });
    expect(ink.color.getHex()).toBe(0x000000);
    expect(normal).not.toBe(0x000000);
    await view.rerender(live, DEFAULT_GAME_PREFERENCES);
    expect(ink.color.getHex()).toBe(normal);

    expect(view.programs()).toBe(programs);
    view.unmount();
  });
});
