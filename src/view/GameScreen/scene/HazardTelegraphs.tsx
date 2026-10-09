/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TICK_MS } from '../../../engine/constants';
import { BossHazard, BossState } from '../../../engine/types';
import { cellKey } from '../../../engine/fogOfWar';
import { MotionStore } from '../../../hooks/motionStore';
import { toWorld } from './sceneSpace';
import {
  HAZARD_FAMILIES,
  HAZARD_FAMILY,
  HazardFamily,
  TELEGRAPH_EDGE_MATERIAL,
  TELEGRAPH_FILL_MATERIAL,
  TELEGRAPH_GEOMETRY,
  lineHeading,
  telegraphClosingScale,
  telegraphCountdown,
  telegraphPhase,
} from './hazardTelegraph';

// Two instanced meshes per family (outline, fill) stay mounted all match:
// no draw call while a family has no hazard, one per layer while it has
// any, however many cells a line attack covers. Instances are rewritten when
// the engine publishes new hazards; between ticks only the closing outlines
// move, on the simulation clock, so a pause freezes them.

export const TELEGRAPH_CAPACITY = 160;
const EDGE_Y = 0.047;
const FILL_Y = 0.044;
// Per edge instance: world x, world z, heading, warning ms left, lead ms.
const EDGE_STRIDE = 5;

type FamilyBuffers = {
  edge: Float32Array;
  edgeCount: number;
  fillCount: number;
  closing: boolean;
};

const DUMMY = new THREE.Object3D();
// Fixed per mesh, so re-renders never re-apply them.
const LAYER_TAGS = Object.fromEntries(HAZARD_FAMILIES.map((family) => [family, {
  edge: { telegraph: family, layer: 'edge' },
  fill: { telegraph: family, layer: 'fill' },
}])) as Record<HazardFamily, { edge: object; fill: object }>;

function writeMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  z: number,
  heading: number,
  across: number,
  along: number,
  height: number
): void {
  DUMMY.position.set(x, height, z);
  DUMMY.rotation.set(0, heading, 0);
  DUMMY.scale.set(along, 1, across);
  DUMMY.updateMatrix();
  mesh.setMatrixAt(index, DUMMY.matrix);
}

// A lane closes across its width only, so its cells keep meeting end to end.
function alongScale(family: HazardFamily, scale: number): number {
  return family === 'line' ? 1 : scale;
}

function HazardTelegraphsBase({
  hazards,
  boss,
  visibleCells,
  motion,
}: {
  hazards: readonly BossHazard[];
  boss: BossState | null;
  visibleCells: Set<string>;
  motion: MotionStore | null;
}) {
  const edgeRefs = useRef<Partial<Record<HazardFamily, THREE.InstancedMesh | null>>>({});
  const fillRefs = useRef<Partial<Record<HazardFamily, THREE.InstancedMesh | null>>>({});
  const buffers = useMemo(() => {
    const map = {} as Record<HazardFamily, FamilyBuffers>;
    HAZARD_FAMILIES.forEach((family) => {
      map[family] = {
        edge: new Float32Array(TELEGRAPH_CAPACITY * EDGE_STRIDE),
        edgeCount: 0,
        fillCount: 0,
        closing: false,
      };
    });
    return map;
  }, []);
  // A line cell's lane direction never changes once it spawns.
  const headings = useRef(new Map<string, number>());
  // Stable ref setters: a new callback each render would detach and reattach.
  const setRefs = useMemo(() => {
    const map = {} as Record<HazardFamily, {
      edge: (mesh: THREE.InstancedMesh | null) => void;
      fill: (mesh: THREE.InstancedMesh | null) => void;
    }>;
    HAZARD_FAMILIES.forEach((family) => {
      map[family] = {
        edge: (mesh) => { edgeRefs.current[family] = mesh; },
        fill: (mesh) => { fillRefs.current[family] = mesh; },
      };
    });
    return map;
  }, []);
  const publishedAtRef = useRef(0);

  useLayoutEffect(() => {
    HAZARD_FAMILIES.forEach((family) => {
      const target = buffers[family];
      target.edgeCount = 0;
      target.fillCount = 0;
      target.closing = false;
    });
    const known = headings.current;
    for (let index = 0; index < hazards.length; index += 1) {
      const hazard = hazards[index];
      const family = HAZARD_FAMILY[hazard.kind];
      const target = buffers[family];
      const edge = edgeRefs.current[family];
      const fill = fillRefs.current[family];
      if (
        edge && fill
        && target.edgeCount < TELEGRAPH_CAPACITY
        && visibleCells.has(cellKey(hazard.x, hazard.y))
      ) {
        let heading = known.get(hazard.id);
        if (heading === undefined) {
          heading = family === 'line' ? lineHeading(hazard, hazards, boss) : 0;
          known.set(hazard.id, heading);
        }
        const [wx, , wz] = toWorld(hazard.x, hazard.y);
        const slot = target.edgeCount * EDGE_STRIDE;
        target.edge[slot] = wx;
        target.edge[slot + 1] = wz;
        target.edge[slot + 2] = heading;
        if (telegraphPhase(hazard) === 'active') {
          target.edge[slot + 3] = 0;
          target.edge[slot + 4] = 1;
          writeMatrix(fill, target.fillCount, wx, wz, heading, 1, 1, FILL_Y);
          target.fillCount += 1;
        } else {
          const { remainingMs, leadMs } = telegraphCountdown(hazard);
          target.edge[slot + 3] = remainingMs;
          target.edge[slot + 4] = leadMs;
          target.closing = true;
        }
        const scale = telegraphClosingScale(target.edge[slot + 3], target.edge[slot + 4]);
        writeMatrix(
          edge,
          target.edgeCount,
          wx,
          wz,
          heading,
          scale,
          alongScale(family, scale),
          EDGE_Y
        );
        target.edgeCount += 1;
      }
    }
    HAZARD_FAMILIES.forEach((family) => {
      const target = buffers[family];
      const edge = edgeRefs.current[family];
      const fill = fillRefs.current[family];
      if (edge) {
        edge.count = target.edgeCount;
        // An empty layer leaves the render list (no program bind per frame).
        edge.visible = target.edgeCount > 0;
        if (target.edgeCount > 0) {
          edge.instanceMatrix.addUpdateRange(0, target.edgeCount * 16);
          edge.instanceMatrix.needsUpdate = true;
        }
      }
      if (fill) {
        fill.count = target.fillCount;
        fill.visible = target.fillCount > 0;
        if (target.fillCount > 0) {
          fill.instanceMatrix.addUpdateRange(0, target.fillCount * 16);
          fill.instanceMatrix.needsUpdate = true;
        }
      }
    });
    if (known.size > hazards.length * 2 + 32) {
      const live = new Set(hazards.map((hazard) => hazard.id));
      known.forEach((_, id) => { if (!live.has(id)) known.delete(id); });
    }
    publishedAtRef.current = motion?.simTimeMs ?? 0;
  }, [boss, buffers, hazards, motion, visibleCells]);

  useFrame(() => {
    if (!motion) return;
    // Like countdownNow: between ticks run on, at most one tick ahead.
    const elapsed = Math.min(Math.max(motion.simTimeMs - publishedAtRef.current, 0), TICK_MS);
    for (let f = 0; f < HAZARD_FAMILIES.length; f += 1) {
      const family = HAZARD_FAMILIES[f];
      const target = buffers[family];
      const edge = edgeRefs.current[family];
      if (edge && target.closing) {
        for (let index = 0; index < target.edgeCount; index += 1) {
          const slot = index * EDGE_STRIDE;
          const remaining = target.edge[slot + 3];
          if (remaining > 0) {
            const scale = telegraphClosingScale(remaining - elapsed, target.edge[slot + 4]);
            writeMatrix(
              edge,
              index,
              target.edge[slot],
              target.edge[slot + 1],
              target.edge[slot + 2],
              scale,
              alongScale(family, scale),
              EDGE_Y
            );
          }
        }
        edge.instanceMatrix.addUpdateRange(0, target.edgeCount * 16);
        edge.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {HAZARD_FAMILIES.map((family) => (
        <React.Fragment key={family}>
          <instancedMesh
            ref={setRefs[family].fill}
            args={[TELEGRAPH_GEOMETRY[family].fill, TELEGRAPH_FILL_MATERIAL, TELEGRAPH_CAPACITY]}
            count={0}
            frustumCulled={false}
            userData={LAYER_TAGS[family].fill}
          />
          <instancedMesh
            ref={setRefs[family].edge}
            args={[TELEGRAPH_GEOMETRY[family].edge, TELEGRAPH_EDGE_MATERIAL, TELEGRAPH_CAPACITY]}
            count={0}
            frustumCulled={false}
            userData={LAYER_TAGS[family].edge}
          />
        </React.Fragment>
      ))}
    </>
  );
}

// Versus without hazards re-renders nothing here: the empty hazard list
// keeps its identity from tick to tick.
export const HazardTelegraphs = React.memo(HazardTelegraphsBase);
