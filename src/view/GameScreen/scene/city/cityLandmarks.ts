import * as THREE from 'three';
import type { CityLandmarkKind } from '../../../../content/stageLooks';
import type { LandmarkPart, Tone } from '../landmarkGeometry';

/**
 * The city arenas' skyline places, built like the villages' famous places
 * (landmarkGeometry.ts bakes and merges them onto LANDMARK_MATERIAL). Each is
 * stylised massing only: terraces, blocks, columns, towers and roofs. No
 * sculpture, statues, signs, screens or lighting effects.
 *
 * Origin is the footprint centre at ground level, the front faces +z (the
 * camera), and nothing reaches past LANDMARK_EXTENTS.
 */

type Vec3 = [number, number, number];

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cylinder = (top: number, bottom: number, h: number, segments: number) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const halfDome = (r: number, segments: number, rings: number) => (
  new THREE.SphereGeometry(r, segments, rings, 0, Math.PI * 2, 0, Math.PI / 2)
);

function at(
  geometry: THREE.BufferGeometry,
  tone: Tone,
  position: Vec3,
  rotate?: Vec3,
  color?: string
): LandmarkPart {
  return {
    geometry, tone, at: position, rotate, color,
  };
}

/** A part whose bottom sits at `y` (boxes, cones and cylinders are centred). */
function standing(
  geometry: THREE.BufferGeometry,
  tone: Tone,
  height: number,
  x: number,
  y: number,
  z: number,
  rotate?: Vec3,
  color?: string
): LandmarkPart {
  return at(geometry, tone, [x, y + height / 2, z], rotate, color);
}

/** A ridge roof along x whose eaves sit at `y`: a triangular prism. */
function ridgeRoof(width: number, depth: number, height: number, y: number): LandmarkPart {
  const roof = new THREE.CylinderGeometry(1, 1, width, 3, 1);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(-Math.PI / 2);
  roof.scale(1, height / 1.5, depth / 1.732);
  return at(roof, 'trim', [0, y + height / 3, 0]);
}

const RECESS = '#7a7266';

// --- Rome ------------------------------------------------------------------------

/**
 * The Vittoriano: two marble terraces, a stair up to the central altar
 * block, a long colonnade under a flat entablature, and a pavilion at each
 * end. Its statues and quadrigae are left out.
 */
function vittorianoParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(7.6, 0.45, 2.5), 'body', 0.45, 0, 0, 0),
    standing(box(6.4, 0.45, 2.1), 'body', 0.45, 0, 0.45, -0.1),
    standing(box(2.4, 0.2, 0.5), 'trim', 0.2, 0, 0.45, 0.8),
    standing(box(2.2, 0.2, 0.5), 'trim', 0.2, 0, 0.65, 0.55),
    standing(box(2.0, 0.2, 0.5), 'trim', 0.2, 0, 0.85, 0.3),
    standing(box(1.5, 0.7, 0.6), 'body', 0.7, 0, 0.9, 0.0),
    standing(box(5.6, 0.3, 1.2), 'body', 0.3, 0, 0.9, -0.45),
    // The portico's shaded back wall, then the columns in front of it.
    standing(box(5.4, 1.3, 0.2), 'trim', 1.3, 0, 1.2, -0.8, undefined, RECESS),
    standing(box(5.8, 0.24, 1.1), 'body', 0.24, 0, 2.5, -0.4),
    standing(box(5.6, 0.16, 0.9), 'trim', 0.16, 0, 2.74, -0.45),
  ];
  for (let index = 0; index < 12; index += 1) {
    const x = -2.5 + (5 * index) / 11;
    parts.push(standing(cylinder(0.07, 0.08, 1.3, 6), 'body', 1.3, x, 1.2, -0.1));
  }
  [-1, 1].forEach((side) => {
    parts.push(
      standing(box(1.0, 2.2, 1.3), 'body', 2.2, side * 3.0, 0.9, -0.35),
      standing(box(1.12, 0.2, 1.42), 'trim', 0.2, side * 3.0, 3.1, -0.35),
      standing(box(0.46, 1.2, 0.04), 'trim', 1.2, side * 3.0, 1.2, 0.32, undefined, RECESS)
    );
  });
  return parts;
}

// --- Barcelona ---------------------------------------------------------------------

/**
 * The Sagrada Família as massing: the nave, four bell towers along the
 * front, four towers round a taller central one, and the apse. The facades'
 * sculpture is left out; the finials are plain points in the accent.
 */
function sagradaFamiliaParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(2.4, 1.5, 1.7), 'body', 1.5, 0, 0, -0.1),
    standing(box(1.9, 0.6, 0.3), 'body', 0.6, 0, 1.5, 0.55),
    standing(cylinder(0.55, 0.6, 1.2, 10), 'body', 1.2, 0, 0, -0.75),
    // The central tower, the tallest, and the one behind it.
    standing(cylinder(0.3, 0.42, 3.6, 10), 'body', 3.6, 0, 1.5, -0.35),
    standing(cone(0.34, 1.6, 10), 'trim', 1.6, 0, 5.1, -0.35),
    standing(cylinder(0.2, 0.28, 2.9, 8), 'body', 2.9, 0, 1.2, -0.85),
    standing(cone(0.24, 1.0, 8), 'trim', 1.0, 0, 4.1, -0.85),
  ];
  // Four bell towers along the front: the outer pair a little lower.
  [-0.9, -0.3, 0.3, 0.9].forEach((x) => {
    const height = Math.abs(x) > 0.5 ? 3.6 : 4.2;
    parts.push(
      standing(cylinder(0.17, 0.22, height, 8), 'body', height, x, 0, 0.55),
      standing(cone(0.2, 1.0, 8), 'trim', 1.0, x, height, 0.55),
      at(new THREE.OctahedronGeometry(0.09, 0), 'accent', [x, height + 1.05, 0.55])
    );
  });
  // Four towers round the central one.
  [[-0.65, -0.05], [0.65, -0.05], [-0.65, -0.7], [0.65, -0.7]].forEach(([x, z]) => {
    parts.push(
      standing(cylinder(0.16, 0.22, 2.6, 8), 'body', 2.6, x, 1.5, z),
      standing(cone(0.18, 0.9, 8), 'trim', 0.9, x, 4.1, z)
    );
  });
  return parts;
}

// --- Budapest ----------------------------------------------------------------------

/**
 * The Parliament on the Pest bank: a long riverside block under a red ridge
 * roof, the domed centre and its spire, two slender towers, pavilions with
 * hip roofs at each end, and pinnacles along the front.
 */
function parliamentParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(8.2, 1.3, 1.5), 'body', 1.3, 0, 0, 0),
    ridgeRoof(8.0, 1.4, 0.5, 1.3),
    standing(box(7.6, 0.4, 0.03), 'trim', 0.4, 0, 0.5, 0.76, undefined, RECESS),
    standing(cylinder(0.75, 0.8, 0.7, 12), 'body', 0.7, 0, 1.3, 0),
    at(halfDome(0.75, 12, 4).scale(1, 1.35, 1), 'trim', [0, 2.0, 0]),
    standing(cone(0.16, 1.1, 8), 'trim', 1.1, 0, 2.95, 0),
  ];
  [-1, 1].forEach((side) => {
    parts.push(
      standing(cylinder(0.13, 0.16, 1.5, 6), 'body', 1.5, side * 1.6, 1.3, 0.35),
      standing(cone(0.17, 0.95, 6), 'trim', 0.95, side * 1.6, 2.8, 0.35),
      standing(box(1.3, 1.75, 1.7), 'body', 1.75, side * 3.45, 0, 0),
      standing(cone(1.05, 0.6, 4), 'trim', 0.6, side * 3.45, 1.75, 0, [0, Math.PI / 4, 0])
    );
  });
  [-2.8, -2.3, -1.0, -0.6, 0.6, 1.0, 2.3, 2.8].forEach((x) => {
    parts.push(standing(cone(0.06, 0.45, 4), 'trim', 0.45, x, 1.3, 0.7));
  });
  return parts;
}

export const CITY_LANDMARK_PARTS: Record<CityLandmarkKind, () => LandmarkPart[]> = {
  vittoriano: vittorianoParts,
  sagradaFamilia: sagradaFamiliaParts,
  parliament: parliamentParts,
};
