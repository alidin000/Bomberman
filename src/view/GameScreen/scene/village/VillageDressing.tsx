/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameEngineState } from '../../../../engine/types';
import type { StageId } from '../../../../content/types';
import type {
  RepairStage, VillageInteractable, VillageSquareLayout,
} from '../../../../content/villageSquare';
import { FIGHTER_INK_MATERIAL } from '../fighterInk';
import { tokenToonMaterial } from '../inkedToken';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';
import { villagerToken } from '../VillageSquareModels';
import { useScenery } from '../scenery';
import {
  birdToken, lanternToken, smokeToken, squareDressing,
} from './squareDressing';
import {
  ExtraPlayer, ExtraState, createExtraState, extraRoute, squareExtras, stepExtra,
} from './squareExtras';

/**
 * The living square (scene/village/*), mounted inside VillageSquare: the
 * village's dressing at this visit's repair stage, and the life in it.
 * Render only; it reads the live state in useFrame and never writes engine
 * state, so nothing here re-renders while players walk about.
 *
 * Cost: the dressing is one inked token (two draws); lanterns, smoke and
 * birds are one instanced draw each; each walking extra is one draw (a
 * token without the ink line, which marks the people you can talk to).
 * All of it uses the token toon and ink programs (plain and instanced, no
 * instance colours) that the village warmup compiles, and lit
 * lanterns are the same program with a glow uniform. Under reduced motion
 * nothing sways, rises, flies or walks. The "Stage scenery" setting off
 * drops the extras, smoke and birds.
 */

const TOKEN_MATERIAL = tokenToonMaterial();
/** Lit paper lanterns: the token program with a warm glow (a uniform). */
const LIT_LANTERN_MATERIAL = tokenToonMaterial('#ff9b42', 0.85);

const SMOKE_PUFFS = 4;
const SMOKE_RISE = 1.5;
const BIRD_HEIGHT = 4.4;
/** Beyond this far from the square (world units) the camera cannot see it. */
const FAR_AWAY = 26;

const MATRIX = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const EULER = new THREE.Euler();
const SCALE = new THREE.Vector3();
const CENTRE = new THREE.Vector3();

const worldX = (x: number) => (x + MAP_OFFSET_X) * TILE_SIZE;
const worldZ = (y: number) => (y + MAP_OFFSET_Z) * TILE_SIZE;

const DRESSING_MARK = { villageDressing: true };

type LifeProps = {
  square: VillageSquareLayout;
  stageId: StageId;
  repairStage: RepairStage;
  /** closedCellsKey(square, map): walls inside the bounds (the pillars). */
  closedCells: string;
  /** The interactables standing this visit (extras keep off their cells). */
  present: readonly VillageInteractable[];
  readState: () => GameEngineState | null;
  reducedMotion: boolean;
};

function pillarsOf(closedCells: string, square: VillageSquareLayout): [number, number][] {
  const {
    x0, y0, x1, y1,
  } = square.bounds;
  return closedCells.split(';').filter(Boolean).map((key) => key.split(',').map(Number) as [number, number])
    .filter(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function VillageDressingBase({
  square,
  stageId,
  repairStage,
  closedCells,
  present,
  readState,
  reducedMotion,
}: LifeProps) {
  const scenery = useScenery();
  const pillars = useMemo(() => pillarsOf(closedCells, square), [closedCells, square]);
  const dressing = useMemo(
    () => squareDressing(stageId, repairStage, square, pillars),
    [pillars, repairStage, square, stageId]
  );
  const { ambience } = dressing;
  const lantern = lanternToken(stageId);
  const smoke = smokeToken(ambience.smoke.some((source) => source.dark) ? '#6b655e' : '#d9d5cf');
  const bird = birdToken(ambience.birdDark ? '#26221f' : '#4b5563');

  const standingIds = useMemo(() => present
    .filter((item) => item.kind === 'villager' && item.villagerId)
    .map((item) => item.villagerId as string), [present]);
  const extraIds = useMemo(
    () => squareExtras(stageId, repairStage, standingIds),
    [repairStage, stageId, standingIds]
  );
  const blocked = useMemo(() => new Set([
    ...pillars.map(([x, y]) => `${x},${y}`),
    ...present.map((item) => `${item.x},${item.y}`),
  ]), [pillars, present]);
  const routes = useMemo(
    () => extraIds.map((_, index) => extraRoute(square, index)),
    [extraIds, square]
  );
  const extras = useRef<ExtraState[]>([]);
  if (extras.current.length !== extraIds.length) {
    extras.current = routes.map((route, index) => createExtraState(route, index));
  }
  const extraGroups = useRef<(THREE.Group | null)[]>([]);
  const extraRefs = useMemo(
    () => extraIds.map((_, index) => (group: THREE.Group | null) => {
      extraGroups.current[index] = group;
    }),
    [extraIds]
  );
  const players = useRef<ExtraPlayer[]>([]);
  const tick = useRef(0);

  const lanternRef = useRef<THREE.InstancedMesh>(null);
  const smokeRef = useRef<THREE.InstancedMesh>(null);
  const birdRef = useRef<THREE.InstancedMesh>(null);
  // One sphere round the square and the air above it, for culling the
  // animated layers (their instances move every frame).
  const bounds = useMemo(() => {
    const {
      x0, y0, x1, y1,
    } = square.bounds;
    CENTRE.set(worldX((x0 + x1) / 2), 2.5, worldZ((y0 + y1) / 2));
    return new THREE.Sphere(CENTRE.clone(), Math.hypot(x1 - x0, y1 - y0) / 2 + 5);
  }, [square]);

  const writeLanterns = (seconds: number) => {
    const mesh = lanternRef.current;
    if (!mesh) return;
    const { lanterns } = ambience;
    for (let index = 0; index < lanterns.length; index += 1) {
      const anchor = lanterns[index];
      const sway = reducedMotion ? 0 : 1;
      EULER.set(
        Math.sin(seconds * 1.7 + anchor.phase) * 0.1 * sway,
        0,
        Math.cos(seconds * 1.3 + anchor.phase * 1.3) * 0.08 * sway
      );
      QUATERNION.setFromEuler(EULER);
      MATRIX.compose(POSITION.set(anchor.x, anchor.y, anchor.z), QUATERNION, SCALE.set(1, 1, 1));
      mesh.setMatrixAt(index, MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const writeSmoke = (seconds: number) => {
    const mesh = smokeRef.current;
    if (!mesh) return;
    const sources = ambience.smoke;
    let index = 0;
    for (let source = 0; source < sources.length; source += 1) {
      const from = sources[source];
      for (let puff = 0; puff < SMOKE_PUFFS; puff += 1) {
        const offset = puff / SMOKE_PUFFS + source * 0.21;
        const life = reducedMotion ? offset % 1 : (seconds * 0.32 + offset) % 1;
        const size = (0.4 + life * 0.8) * Math.min(1, (1 - life) * 3);
        MATRIX.compose(
          POSITION.set(
            from.x + Math.sin(life * 4 + source) * 0.1 + life * 0.35,
            from.y + life * SMOKE_RISE,
            from.z - life * 0.2
          ),
          QUATERNION.identity(),
          SCALE.set(size, size * 0.85, size)
        );
        mesh.setMatrixAt(index, MATRIX);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const writeBirds = (seconds: number) => {
    const mesh = birdRef.current;
    if (!mesh) return;
    const count = ambience.birdCount;
    const { perches } = ambience;
    for (let index = 0; index < count; index += 1) {
      if (reducedMotion) {
        // Perched on the roofs, wings folded.
        const perch = perches[(index * 2) % perches.length];
        QUATERNION.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, index * 1.3);
        POSITION.set(perch[0], perch[1], perch[2]);
        MATRIX.compose(POSITION, QUATERNION, SCALE.set(1, 0.25, 1));
      } else {
        const angle = seconds * (0.32 + index * 0.03) + (index * Math.PI * 2) / count;
        const radius = 2.6 + (index % 2) * 0.7;
        const flap = 0.25 + Math.abs(Math.sin(seconds * 9 + index * 1.9)) * 0.75;
        EULER.set(0, angle + Math.PI, Math.sin(seconds * 0.8 + index) * 0.2);
        QUATERNION.setFromEuler(EULER);
        MATRIX.compose(
          POSITION.set(
            bounds.center.x + Math.cos(angle) * radius * 1.4,
            BIRD_HEIGHT + Math.sin(seconds * 0.9 + index * 2) * 0.25,
            bounds.center.z - 2.4 + Math.sin(angle) * radius * 0.6
          ),
          QUATERNION,
          SCALE.set(1, flap, 1)
        );
      }
      mesh.setMatrixAt(index, MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    [lanternRef.current, smokeRef.current, birdRef.current].forEach((mesh) => {
      const target = mesh;
      if (target) target.boundingSphere = bounds;
    });
    writeLanterns(0);
    writeSmoke(0);
    writeBirds(0);
  // The writers read refs, the ambience and reducedMotion only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambience, bounds, reducedMotion, scenery]);

  useFrame(({ clock, camera }, delta) => {
    if (camera.position.distanceTo(bounds.center) > FAR_AWAY + bounds.radius) return;
    const seconds = clock.elapsedTime;
    // Ambient layers at half rate: slow sway, rising smoke, distant birds.
    tick.current += 1;
    if (!reducedMotion && tick.current % 2 === 0) {
      writeLanterns(seconds);
      if (scenery) {
        writeSmoke(seconds);
        writeBirds(seconds);
      }
    }
    if (!scenery) return;
    const live = readState();
    const list = players.current;
    const count = live ? live.players.length : 0;
    for (let index = 0; index < count; index += 1) {
      const player = live!.players[index];
      if (!list[index]) list[index] = { x: 0, y: 0, alive: false };
      list[index].x = player.x;
      list[index].y = player.y;
      list[index].alive = player.alive && live!.phase === 'playing';
    }
    list.length = count;
    const dt = Math.min(delta, 0.1);
    for (let index = 0; index < extras.current.length; index += 1) {
      const state = extras.current[index];
      const crowd = extras.current;
      stepExtra(state, routes[index], square, blocked, list, dt, reducedMotion, crowd, index);
      const group = extraGroups.current[index];
      if (group) {
        const bob = state.yielding || state.wait > 0 || reducedMotion
          ? 0
          : Math.abs(Math.sin(state.stride)) * 0.035;
        group.position.set(worldX(state.x), bob, worldZ(state.y));
        group.rotation.y = state.heading;
        group.scale.setScalar(Math.max(0.001, state.shown));
        group.visible = state.shown > 0.02;
      }
    }
  });

  const smokeCount = ambience.smoke.length * SMOKE_PUFFS;
  return (
    <group userData={{ villageLife: true, repairStage }}>
      <mesh geometry={dressing.token.body} material={TOKEN_MATERIAL} userData={DRESSING_MARK} />
      {dressing.token.ink && <mesh geometry={dressing.token.ink} material={FIGHTER_INK_MATERIAL} />}
      {ambience.lanterns.length > 0 && (
        <instancedMesh
          key={`lanterns-${ambience.lanterns.length}`}
          ref={lanternRef}
          args={[
            lantern.body,
            ambience.lit ? LIT_LANTERN_MATERIAL : TOKEN_MATERIAL,
            ambience.lanterns.length,
          ]}
          userData={{ villageLanterns: true, lit: ambience.lit }}
        />
      )}
      {scenery && smokeCount > 0 && (
        <instancedMesh
          key={`smoke-${smokeCount}`}
          ref={smokeRef}
          args={[smoke.body, TOKEN_MATERIAL, smokeCount]}
          userData={{ villageSmoke: true }}
        />
      )}
      {scenery && (
        <instancedMesh
          key={`birds-${ambience.birdCount}`}
          ref={birdRef}
          args={[bird.body, TOKEN_MATERIAL, ambience.birdCount]}
          userData={{ villageBirds: true }}
        />
      )}
      {scenery && extraIds.map((id, index) => {
        const token = villagerToken(id);
        const start = extras.current[index];
        return (
          <group
            key={id}
            ref={extraRefs[index]}
            position={[worldX(start.x), 0, worldZ(start.y)]}
            userData={{ villageExtra: id }}
          >
            {/* No ink line: the inked people are the ones to talk to. */}
            <mesh geometry={token.body} material={TOKEN_MATERIAL} />
          </group>
        );
      })}
    </group>
  );
}

/** Mount once inside VillageSquare; memoised, so ticks never re-render it. */
export const VillageDressing = React.memo(VillageDressingBase);
