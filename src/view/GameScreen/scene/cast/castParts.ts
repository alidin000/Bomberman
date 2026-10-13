/* eslint-disable max-len -- part recipes read best one part per line */
import * as THREE from 'three';
import type {
  Accessory, CastId, CastLook, CastMember, HairStyle,
} from '../../../../content/animeCast';
import { CastCellName } from './castAtlas';
import {
  CastPart, aimAlong, insideOut, limb, tube, v3,
} from './castMesh';

/**
 * Recipes for the anime cast, one per preset in content/animeCast.ts: the
 * body and outfit, the head and its painted face, the hair, the headband
 * with its village plate, and the accessories. Units: a figure stands on
 * y = 0, faces +z and is about 1.25 tall at scale 1 (a big head, long legs:
 * the anime's look kept readable from the arena camera). Its own left is +x,
 * which is the viewer's right.
 */

export const HEAD_Y = 0.99;
export const HEAD_R = 0.18;
const HEAD_Z = 0.94;
const SHOULDER_Y = 0.755;
const SANDAL = '#2c3a63';
const BANDAGE = '#ece6d6';
const STEEL = '#c7ced8';
const DARK_STEEL = '#64748b';

type Side = -1 | 1;
type ArmPose = 'hang' | 'hold' | 'raise';
type SleeveStyle = 'long' | 'short' | 'none' | 'wide';
type Sleeve = { style: SleeveStyle; color: string; upper?: string; guard?: string };

type BodySpec = {
  torso: string;
  legs: string;
  shins?: string;
  boots?: string;
  shoes: string;
  /** [the figure's right (-x), its left (+x)] */
  sleeves: [Sleeve, Sleeve];
  hands: string;
  neck: string;
  wraps?: string;
  bulk: number;
  extra: CastPart[];
};

const part = (
  geometry: THREE.BufferGeometry,
  color: string,
  at?: [number, number, number],
  rotate?: [number, number, number],
  scale?: [number, number, number],
  ink?: boolean
): CastPart => ({
  geometry, color, at, rotate, scale, ink,
});
const flat = (entry: CastPart): CastPart => ({ ...entry, ink: false });
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cyl = (top: number, bottom: number, h: number, radial = 10, open = false) => (
  new THREE.CylinderGeometry(top, bottom, h, radial, 1, open)
);

// --- Torso and cloth profiles -----------------------------------------------------

type Profile = readonly (readonly [number, number])[]; // [y, radius], bottom to top

const TORSO: Profile = [
  [0.44, 0.06], [0.46, 0.118], [0.5, 0.13], [0.56, 0.124], [0.64, 0.14],
  [0.72, 0.156], [0.77, 0.152], [0.8, 0.11], [0.82, 0.05],
];
const TORSO_Z = 0.7;

function radiusAt(profile: Profile, y: number): number {
  if (y <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i += 1) {
    const [y1, r1] = profile[i];
    const [y0, r0] = profile[i - 1];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return profile[profile.length - 1][1];
}

/** A lathe over part of a profile, grown out by `grow` (cloth over cloth). */
function lathe(
  profile: Profile,
  y0: number,
  y1: number,
  grow: number,
  options: { segments?: number; phiStart?: number; phiLength?: number; steps?: number } = {}
): THREE.LatheGeometry {
  const steps = options.steps ?? 6;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = y0 + ((y1 - y0) * i) / steps;
    points.push(new THREE.Vector2(radiusAt(profile, y) * grow, y));
  }
  return new THREE.LatheGeometry(
    points,
    options.segments ?? 14,
    options.phiStart ?? 0,
    options.phiLength ?? Math.PI * 2
  );
}

/** A flared skirt, coat or cloak from y0 (top) to y1 (hem). */
function flare(y0: number, y1: number, rTop: number, rHem: number): Profile {
  return [[y1, rHem], [(y0 + y1) / 2, rTop + (rHem - rTop) * 0.4], [y0, rTop]];
}

function clothLathe(
  profile: Profile,
  y0: number,
  y1: number,
  color: string,
  options: { open?: number; lining?: string; zScale?: number; grow?: number; segments?: number } = {}
): CastPart[] {
  const open = options.open ?? 0;
  const zScale = options.zScale ?? 0.82;
  const settings = {
    segments: options.segments ?? 16,
    phiStart: open,
    phiLength: Math.PI * 2 - 2 * open,
  };
  const grow = options.grow ?? 1;
  const parts = [part(lathe(profile, y0, y1, grow, settings), color, undefined, undefined, [1, 1, zScale])];
  if (options.lining) {
    parts.push(flat(part(
      insideOut(lathe(profile, y0, y1, grow, settings)),
      options.lining,
      undefined,
      undefined,
      [1, 1, zScale]
    )));
  }
  return parts;
}

/**
 * A painted patch on a lathe surface (prints on cloaks and backs): the same
 * profile pushed out a hair, spanning `width` radians about `phi`.
 */
function printPatch(
  profile: Profile,
  y0: number,
  y1: number,
  phi: number,
  width: number,
  cell: CastCellName,
  zScale: number,
  grow = 1.012
): CastPart {
  return {
    geometry: lathe(profile, y0, y1, grow, {
      segments: 4, phiStart: phi - width / 2, phiLength: width, steps: 3,
    }),
    color: '#ffffff',
    scale: [1, 1, zScale],
    ink: false,
    decal: { cell, mode: 'native' },
  };
}

// --- Head and face -----------------------------------------------------------------

/** The head's outline at polar angle `a` (0 = crown): round, with a soft chin. */
function headPoint(a: number, grow = 1): THREE.Vector2 {
  const lower = Math.max(0, (a - Math.PI * 0.55) / (Math.PI * 0.45));
  const taper = 1 - 0.4 * lower ** 1.6;
  const stretch = a > Math.PI / 2 ? 1 + 0.14 * ((a - Math.PI / 2) / (Math.PI / 2)) : 1;
  return new THREE.Vector2(
    Math.max(1e-4, HEAD_R * Math.sin(a) * taper * grow),
    HEAD_R * Math.cos(a) * stretch * grow
  );
}

function headLathe(a0: number, a1: number, grow: number, segments: number, phi?: [number, number]) {
  const points: THREE.Vector2[] = [];
  const steps = 12;
  // Bottom to top, so the faces point out.
  for (let i = steps; i >= 0; i -= 1) points.push(headPoint(a0 + ((a1 - a0) * i) / steps, grow));
  return new THREE.LatheGeometry(points, segments, phi?.[0] ?? 0, phi?.[1] ?? Math.PI * 2);
}

function headParts(member: CastMember, look: CastLook): CastPart[] {
  const at: [number, number, number] = [0, HEAD_Y, 0];
  const scale: [number, number, number] = [1, 1, HEAD_Z];
  const parts: CastPart[] = [
    part(headLathe(0, Math.PI, 1, 16), look.skin, at, undefined, scale),
    {
      geometry: headLathe(Math.PI * 0.16, Math.PI * 0.8, 1.004, 12, [-1.2, 2.4]),
      color: '#ffffff',
      at,
      scale,
      ink: false,
      decal: { cell: `face:${member.id}` as CastCellName, mode: 'planar', radius: HEAD_R },
    },
  ];
  if (look.hair.style !== 'hooded' && look.outfit.style !== 'plant') {
    [-1, 1].forEach((side) => parts.push(part(
      ball(0.036, 6, 5),
      look.skin,
      [side * 0.172, HEAD_Y - 0.02, -0.005],
      undefined,
      [0.55, 1, 0.8]
    )));
  }
  return parts;
}

// --- Hair ----------------------------------------------------------------------------

const DEG = Math.PI / 180;

function outwardAt(theta: number, phi: number): THREE.Vector3 {
  return v3(Math.sin(theta * DEG) * Math.sin(phi * DEG), Math.cos(theta * DEG), Math.sin(theta * DEG) * Math.cos(phi * DEG));
}

/**
 * A flat cone spike rooted on the scalp at (theta, phi) degrees (theta from
 * the crown, phi from the front toward the figure's left), leaning by `bend`.
 */
function spike(
  theta: number,
  phi: number,
  length: number,
  radius: number,
  color: string,
  bend: [number, number, number] = [0, 0, 0],
  thin = 0.5
): CastPart {
  const out = outwardAt(theta, phi);
  const dir = out.clone().add(v3(...bend)).normalize();
  const base = v3(0, HEAD_Y, 0).addScaledVector(out, HEAD_R * 0.95);
  const geometry = new THREE.ConeGeometry(radius, length, 5);
  geometry.scale(1, 1, thin);
  return {
    geometry: aimAlong(geometry, base.addScaledVector(dir, length / 2), dir, out),
    color,
  };
}

/** The hair's cap: a shell over the scalp, its pole tipped back so it reaches the nape. */
function cap(color: string, theta = 1.62, tilt = -0.62, grow = 1.075): CastPart {
  return part(
    new THREE.SphereGeometry(HEAD_R * grow, 18, 10, 0, Math.PI * 2, 0, theta),
    color,
    [0, HEAD_Y, -0.005],
    [tilt, 0, 0],
    [1, 1, 0.98]
  );
}

/** Bangs: `count` short locks hanging over the forehead. */
function bangs(color: string, count: number, spread: number, length: number, theta = 40, radius = 0.05) {
  return Array.from({ length: count }, (_, index) => {
    const phi = count === 1 ? 0 : -spread + (2 * spread * index) / (count - 1);
    return spike(theta, phi, length, radius, color, [phi * 0.004, -1.4, 0.45]);
  });
}

function ring(count: number, from: number, to: number) {
  return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / Math.max(1, count - 1));
}

function hairParts(id: CastId, style: HairStyle, color: string): CastPart[] {
  const parts: CastPart[] = [];
  switch (style) {
    case 'spikyShort':
      parts.push(cap(color));
      ring(9, 0, 320).forEach((phi, i) => parts.push(spike(28 + (i % 2) * 14, phi, 0.17, 0.07, color, [0, 0.55, -0.15])));
      [-80, 80, -118, 118].forEach((phi) => parts.push(spike(74, phi, 0.12, 0.065, color, [0, -0.5, -0.5])));
      ring(5, 145, 215).forEach((phi) => parts.push(spike(88, phi, 0.15, 0.065, color, [0, -0.3, -0.2])));
      parts.push(...bangs(color, 4, 36, 0.15, 42, 0.055));
      break;
    case 'spikyLongBangs':
      parts.push(cap(color));
      ring(9, 0, 320).forEach((phi, i) => parts.push(spike(28 + (i % 2) * 16, phi, 0.18, 0.07, color, [0, 0.4, -0.35])));
      ring(5, 140, 220).forEach((phi) => parts.push(spike(86, phi, 0.19, 0.07, color, [0, -0.4, -0.3])));
      // The long jaw-length bangs that frame his face.
      [-1, 1].forEach((side) => parts.push(spike(48, side * 50, 0.3, 0.055, color, [side * 0.1, -2.4, 0.3])));
      parts.push(...bangs(color, 3, 22, 0.16, 38, 0.055));
      break;
    case 'spikyBack':
      parts.push(cap(color));
      ring(7, 135, 225).forEach((phi, i) => parts.push(spike(50 + (i % 3) * 16, phi, 0.22, 0.075, color, [0, 0.6, -0.7])));
      ring(3, -40, 40).forEach((phi) => parts.push(spike(22, phi + 180, 0.2, 0.07, color, [0, 0.9, -0.6])));
      [-1, 1].forEach((side) => parts.push(spike(50, side * 44, 0.3, 0.05, color, [side * 0.1, -2.6, 0.35])));
      parts.push(...bangs(color, 2, 14, 0.15, 34, 0.05));
      break;
    case 'messyShort':
      parts.push(cap(color, 1.45));
      ring(11, 0, 330).forEach((phi, i) => parts.push(spike(24 + (i % 3) * 18, phi, 0.12, 0.065, color, [0, 0.25, 0])));
      ring(5, 130, 230).forEach((phi) => parts.push(spike(84, phi, 0.11, 0.06, color, [0, -0.4, 0])));
      // Short tufts that leave his forehead mark (viewer's right) clear.
      [-30, -8, 58].forEach((phi) => parts.push(spike(42, phi, 0.11, 0.05, color, [0, -1.5, 0.4])));
      break;
    case 'lowPonytail':
      parts.push(cap(color, 1.55, -0.4, 1.06));
      // Centre-parted bangs falling at the sides of the face.
      [-1, 1].forEach((side) => {
        parts.push(spike(48, side * 56, 0.3, 0.05, color, [side * 0.05, -3, 0.2], 0.45));
        parts.push(spike(30, side * 22, 0.14, 0.045, color, [side * 0.4, -1.6, 0.3]));
      });
      parts.push(part(cyl(0.035, 0.035, 0.03, 8), '#7f1d1d', [0, HEAD_Y - 0.12, -0.165], [0.5, 0, 0]));
      parts.push(limb(v3(0, HEAD_Y - 0.13, -0.17), v3(0, HEAD_Y - 0.38, -0.2), 0.034, color));
      break;
    case 'halfUpLongBang':
      parts.push(cap(color, 1.55, -0.45));
      parts.push(part(ball(0.07, 8, 6), color, [0, HEAD_Y + 0.12, -0.14]));
      parts.push(spike(70, 180, 0.24, 0.06, color, [0, -2.2, -0.4]));
      // Long hair down the back.
      parts.push(part(cyl(0.09, 0.05, 0.4, 8), color, [0, HEAD_Y - 0.24, -0.14], [0.12, 0, 0], [1, 1, 0.5]));
      // The long bang over his left eye (the viewer's right), where the scope is.
      parts.push(spike(34, 22, 0.32, 0.075, color, [0.25, -2.6, 0.55], 0.4));
      parts.push(spike(44, -48, 0.2, 0.05, color, [-0.1, -2.4, 0.3]));
      break;
    case 'gravitySilver':
      parts.push(cap(color, 1.45));
      ring(8, -60, 260).forEach((phi, i) => parts.push(spike(14 + (i % 3) * 16, phi, 0.26, 0.08, color, [0.55, 0.9, -0.2])));
      ring(4, 140, 220).forEach((phi) => parts.push(spike(70, phi, 0.18, 0.07, color, [0.4, 0, -0.3])));
      parts.push(...bangs(color, 2, 26, 0.12, 40, 0.05));
      break;
    case 'shortBob': {
      parts.push(cap(color, 1.5, -0.35, 1.07));
      parts.push(part(
        new THREE.SphereGeometry(HEAD_R * 1.1, 16, 6, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0.95, 1.05),
        color,
        [0, HEAD_Y, -0.01],
        undefined,
        [1, 1, 0.98]
      ));
      parts.push(...bangs(color, 3, 26, 0.13, 36, 0.055));
      [-1, 1].forEach((side) => parts.push(spike(70, side * 58, 0.18, 0.05, color, [0, -2.6, 0.1])));
      break;
    }
    case 'fourPonytails':
      parts.push(cap(color, 1.5, -0.4));
      [[-1, 100], [1, 100], [-1, 130], [1, 130]].forEach(([side, theta]) => {
        [-12, 0, 12].forEach((spread) => parts.push(spike(
          theta,
          side * (125 + spread),
          0.14,
          0.055,
          color,
          [side * 0.3, -0.2, -0.4]
        )));
      });
      parts.push(...bangs(color, 3, 24, 0.12, 38));
      [-1, 1].forEach((side) => parts.push(spike(56, side * 52, 0.2, 0.045, color, [0, -2.6, 0.2])));
      break;
    case 'bun':
      parts.push(cap(color, 1.55, -0.4, 1.06));
      parts.push(part(ball(0.08, 9, 7), color, id === 'konan' ? [0.02, HEAD_Y + 0.1, -0.16] : [0, HEAD_Y + 0.17, -0.05]));
      [-1, 1].forEach((side) => parts.push(spike(50, side * 50, 0.2, 0.045, color, [0, -2.5, 0.3])));
      if (id === 'konan') parts.push(...bangs(color, 2, 18, 0.13, 36));
      break;
    case 'longFlowing':
      parts.push(cap(color, 1.55, -0.4));
      parts.push(part(cyl(0.15, 0.22, 0.7, 10), color, [0, HEAD_Y - 0.42, -0.12], [0.1, 0, 0], [1, 1, 0.45]));
      parts.push(part(ball(0.065, 8, 6), color, [0, HEAD_Y + 0.2, -0.03]));
      parts.push(spike(8, 0, 0.1, 0.05, color, [0, 1, -0.3]));
      // The bang over her right eye (the viewer's left).
      parts.push(spike(34, -20, 0.3, 0.08, color, [-0.3, -2.6, 0.55], 0.4));
      [-1, 1].forEach((side) => parts.push(spike(60, side * 56, 0.42, 0.045, color, [side * -0.15, -3, 0.35])));
      break;
    case 'shortSpiky':
      parts.push(cap(color, 1.45));
      ring(9, 0, 320).forEach((phi, i) => parts.push(spike(26 + (i % 2) * 18, phi, 0.12, 0.06, color, [0, 0.4, -0.1])));
      ring(4, 145, 215).forEach((phi) => parts.push(spike(82, phi, 0.1, 0.055, color, [0, -0.5, -0.1])));
      parts.push(...bangs(color, 3, 24, 0.1, 40, 0.05));
      break;
    case 'shortCrop':
      parts.push(cap(color, 1.45, -0.45, 1.06));
      parts.push(...bangs(color, id === 'sai' ? 4 : 3, 28, 0.09, 40, 0.05));
      if (id === 'karui') {
        [-1, 1].forEach((side) => parts.push(spike(62, side * 70, 0.17, 0.05, color, [0, -2.5, 0])));
      }
      break;
    case 'sweptBack':
      parts.push(cap(color, 1.45));
      ring(7, -50, 50).forEach((phi, i) => parts.push(spike(24 + (i % 2) * 14, phi, 0.22, 0.07, color, [0, 0.3, -1.6])));
      ring(4, 130, 230).forEach((phi) => parts.push(spike(70, phi, 0.15, 0.06, color, [0, -0.4, -0.6])));
      parts.push(spike(36, -22, 0.24, 0.06, color, [-0.2, -2.6, 0.5], 0.4));
      break;
    case 'bald':
      if (id === 'onoki') {
        [-1, 1].forEach((side) => parts.push(part(ball(0.05, 7, 5), color, [side * 0.15, HEAD_Y + 0.01, -0.07])));
        parts.push(part(ball(0.045, 7, 5), color, [0, HEAD_Y + 0.05, -0.18]));
      }
      break;
    case 'highPonytail':
      parts.push(cap(color, 1.5, -0.45, 1.06));
      parts.push(part(cyl(0.04, 0.045, 0.04, 8), '#1f2937', [0, HEAD_Y + 0.15, -0.12], [-0.6, 0, 0]));
      ring(5, -50, 50).forEach((spread) => parts.push(spike(
        42,
        180 + spread,
        0.17,
        0.05,
        color,
        [spread * 0.006, 1.6, -0.6]
      )));
      break;
    case 'twinTails':
      parts.push(cap(color, 1.55, -0.4));
      [-1, 1].forEach((side) => {
        parts.push(spike(52, side * 46, 0.28, 0.05, color, [side * 0.1, -2.6, 0.25]));
        parts.push(part(cyl(0.035, 0.035, 0.03, 8), '#1f2937', [side * 0.11, HEAD_Y - 0.1, -0.15]));
        parts.push(limb(v3(side * 0.12, HEAD_Y - 0.12, -0.16), v3(side * 0.16, HEAD_Y - 0.48, -0.17), 0.04, color));
      });
      parts.push(...bangs(color, 2, 12, 0.12, 34));
      break;
    case 'longWild':
      parts.push(cap(color, 1.5, -0.5, 1.09));
      ring(7, 135, 225).forEach((phi, i) => parts.push(spike(
        60 + (i % 3) * 18,
        phi,
        0.34 + (i % 2) * 0.06,
        0.09,
        color,
        [0, -2.4, -0.3]
      )));
      ring(5, -40, 40).forEach((phi) => parts.push(spike(24, phi, 0.13, 0.08, color, [0, 0.3, -1.2])));
      [-1, 1].forEach((side) => parts.push(spike(56, side * 54, 0.4, 0.05, color, [side * 0.1, -3, 0.3])));
      break;
    case 'hooded':
      // Kankuro's black hood with its two points, open at the face.
      parts.push(part(
        new THREE.SphereGeometry(HEAD_R * 1.12, 16, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.3),
        color,
        [0, HEAD_Y, -0.005]
      ));
      parts.push(cap(color, 1.05, -0.2, 1.12));
      [-1, 1].forEach((side) => parts.push(spike(28, side * 52, 0.12, 0.05, color, [side * 0.1, 0.9, 0], 0.7)));
      break;
    case 'longStraight':
      parts.push(cap(color, 1.55, -0.4));
      parts.push(part(cyl(0.13, 0.16, 0.5, 10), color, [0, HEAD_Y - 0.28, -0.12], [0.08, 0, 0], [1, 1, 0.45]));
      [-1, 1].forEach((side) => parts.push(spike(52, side * 54, 0.3, 0.05, color, [side * 0.05, -3, 0.25])));
      parts.push(...bangs(color, 3, 20, 0.12, 36));
      break;
    case 'none':
    default:
      break;
  }
  return parts;
}

// --- Headbands -------------------------------------------------------------------------

function plateCell(look: CastLook): CastCellName | null {
  if (!look.headband) return null;
  const slashed = look.headband.wear === 'slashed';
  return `plate:${look.headband.symbol}${slashed ? ':slashed' : ''}` as CastCellName;
}

function headbandRing(
  look: CastLook,
  y: number,
  tilt: [number, number, number],
  radius: number
): CastPart[] {
  const band = look.headband;
  const cell = plateCell(look);
  if (!band || !cell) return [];
  const at: [number, number, number] = [0, y, 0];
  return [
    part(cyl(radius, radius, 0.058, 18, true), band.cloth, at, tilt, [1, 1, HEAD_Z]),
    {
      // The plate: a curved steel patch carrying the village mark.
      geometry: new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.066, 6, 1, true, -0.52, 1.04),
      color: '#ffffff',
      at,
      rotate: tilt,
      scale: [1, 1, HEAD_Z],
      decal: { cell, mode: 'native' },
    },
    // Two cloth tails knotted at the back.
    part(box(0.04, 0.15, 0.012), band.cloth, [0.03, y - 0.07, -radius * HEAD_Z - 0.01], [0.25, 0, -0.2]),
    part(box(0.04, 0.13, 0.012), band.cloth, [-0.035, y - 0.06, -radius * HEAD_Z - 0.01], [0.3, 0, 0.25]),
  ];
}

function headbandParts(look: CastLook, arm: { shoulder: THREE.Vector3; elbow: THREE.Vector3 }): CastPart[] {
  const band = look.headband;
  const cell = plateCell(look);
  if (!band || !cell) return [];
  const forehead = HEAD_Y + HEAD_R * 0.36;
  switch (band.wear) {
    case 'forehead':
    case 'slashed':
      return headbandRing(look, forehead, [-0.06, 0, 0], HEAD_R * 1.1);
    case 'hairband':
      return headbandRing(look, HEAD_Y + HEAD_R * 0.62, [-0.42, 0, 0], HEAD_R * 1.08);
    case 'overEye':
      return headbandRing(look, HEAD_Y + HEAD_R * 0.18, [-0.04, 0, -0.32], HEAD_R * 1.1);
    case 'neck':
      return [
        part(cyl(0.062, 0.066, 0.045, 14, true), band.cloth, [0, 0.83, 0]),
        {
          geometry: new THREE.CylinderGeometry(0.069, 0.069, 0.048, 4, 1, true, -0.62, 1.24),
          color: '#ffffff',
          at: [0, 0.83, 0],
          decal: { cell, mode: 'native' },
        },
      ];
    case 'arm': {
      // Round the left upper arm, the plate facing out.
      const mid = arm.shoulder.clone().lerp(arm.elbow, 0.45);
      const dir = arm.elbow.clone().sub(arm.shoulder);
      const bandGeometry = aimAlong(cyl(0.05, 0.05, 0.045, 12, true), mid, dir);
      const plate = aimAlong(
        new THREE.CylinderGeometry(0.053, 0.053, 0.05, 4, 1, true, Math.PI / 2 - 0.62, 1.24),
        mid,
        dir,
        v3(0, 0, 1)
      );
      return [
        { geometry: bandGeometry, color: band.cloth },
        {
          geometry: plate, color: '#ffffff', ink: false, decal: { cell, mode: 'native' },
        },
      ];
    }
    case 'strap':
    default:
      // On the gourd strap across the chest (Gaara).
      return [{
        geometry: new THREE.PlaneGeometry(0.12, 0.05),
        color: '#ffffff',
        at: [0.01, 0.665, 0.123],
        rotate: [-0.12, 0, 0.62],
        ink: false,
        decal: { cell, mode: 'native' },
      }];
  }
}

// --- Body ----------------------------------------------------------------------------------

const long = (color: string, extra: Partial<Sleeve> = {}): Sleeve => ({ style: 'long', color, ...extra });

const LEAF_VEST = '#4f6b3a';
const LEAF_SUIT = '#23304a';

/** A Leaf-style flak jacket: high collar, scroll pouches; Cloud's has one strap. */
function flakVest(vest: string, oneStrap: boolean): CastPart[] {
  const pouch = vest;
  const parts: CastPart[] = [];
  if (oneStrap) {
    parts.push(...clothLathe(TORSO, 0.5, 0.7, vest, { grow: 1.12, zScale: TORSO_Z }));
    parts.push(part(box(0.07, 0.3, 0.2), vest, [0.08, 0.72, 0], [0, 0, -0.45]));
    return parts;
  }
  parts.push(...clothLathe(TORSO, 0.5, 0.79, vest, { grow: 1.13, zScale: TORSO_Z }));
  parts.push(part(cyl(0.098, 0.115, 0.075, 14, true), vest, [0, 0.815, 0], undefined, [1, 1, 0.85]));
  [-1, 1].forEach((side) => [0.6, 0.67].forEach((y) => parts.push(part(
    box(0.07, 0.055, 0.03),
    pouch,
    [side * 0.065, y, 0.105],
    [-0.05, side * 0.25, 0]
  ))));
  return parts;
}

const ARM_POSES: Record<ArmPose, { elbow: [number, number, number]; wrist: [number, number, number] }> = {
  hang: { elbow: [0.215, 0.6, -0.012], wrist: [0.238, 0.46, 0.022] },
  hold: { elbow: [0.215, 0.6, 0.0], wrist: [0.16, 0.57, 0.16] },
  raise: { elbow: [0.22, 0.63, 0.04], wrist: [0.13, 0.74, 0.17] },
};

function armPoseFor(look: CastLook, side: Side, holdRight: boolean): ArmPose {
  const has = (accessory: Accessory) => look.accessories?.includes(accessory) ?? false;
  if (side === 1 && has('book')) return 'raise';
  if (has('chakraThreads')) return 'hold';
  if (side === -1 && (holdRight || has('threeProngKunai') || has('senbon') || has('scrollBrush'))) return 'hold';
  return 'hang';
}

export type Joints = { shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3; hand: THREE.Vector3 };

function armJoints(side: Side, pose: ArmPose, bulk: number): Joints {
  const { elbow, wrist } = ARM_POSES[pose];
  const shoulder = v3(side * 0.165 * bulk, SHOULDER_Y, 0);
  const e = v3(side * elbow[0] * bulk, elbow[1], elbow[2]);
  const w = v3(side * wrist[0] * (pose === 'hang' ? bulk : 1), wrist[1], wrist[2]);
  const hand = w.clone().add(w.clone().sub(e).normalize().multiplyScalar(0.035));
  return {
    shoulder, elbow: e, wrist: w, hand,
  };
}

function armParts(spec: BodySpec, side: Side, joints: Joints, skin: string): CastPart[] {
  const sleeve = spec.sleeves[side === -1 ? 0 : 1];
  const r = 0.041 * spec.bulk;
  const upperColor = sleeve.style === 'none' ? skin : sleeve.upper ?? sleeve.color;
  const foreColor = sleeve.style === 'long' || sleeve.style === 'wide' ? sleeve.color : skin;
  const parts: CastPart[] = [
    limb(joints.shoulder, joints.elbow, r, upperColor),
    limb(joints.elbow, joints.wrist, r * 0.9, foreColor),
    part(ball(0.043 * spec.bulk, 8, 6), spec.hands, joints.hand.toArray() as [number, number, number]),
  ];
  if (sleeve.style === 'wide') {
    parts.push(tube(joints.elbow, joints.wrist.clone().lerp(joints.elbow, -0.08), 0.052 * spec.bulk, 0.082 * spec.bulk, sleeve.color, 10));
    parts.push(tube(joints.shoulder, joints.elbow, 0.058 * spec.bulk, 0.062 * spec.bulk, sleeve.color, 10));
  }
  if (sleeve.style === 'short') {
    parts.push(tube(joints.shoulder, joints.shoulder.clone().lerp(joints.elbow, 0.8), 0.058 * spec.bulk, 0.07 * spec.bulk, sleeve.color, 10));
  }
  if (sleeve.guard) {
    parts.push(tube(joints.elbow.clone().lerp(joints.wrist, 0.25), joints.wrist, 0.047, 0.046, sleeve.guard, 8));
  }
  return parts;
}

function legParts(spec: BodySpec): CastPart[] {
  const parts: CastPart[] = [];
  const r = 0.052 * Math.min(spec.bulk, 1.2);
  [-1, 1].forEach((side) => {
    const hip = v3(side * 0.07 * spec.bulk, 0.47, 0);
    const knee = v3(side * 0.077 * spec.bulk, 0.27, 0.01);
    const ankle = v3(side * 0.08 * spec.bulk, 0.075, 0.0);
    if (spec.shins) {
      parts.push(limb(hip, knee, r, spec.legs), limb(knee, ankle, r * 0.92, spec.shins));
    } else {
      parts.push(limb(hip, ankle, r, spec.legs));
    }
    if (spec.boots) parts.push(tube(v3(ankle.x, 0.05, 0), v3(knee.x, 0.27, 0.01), 0.058, 0.06, spec.boots, 10));
    if (spec.wraps) parts.push(part(cyl(0.057, 0.057, 0.06, 10), spec.wraps, [ankle.x, 0.12, 0.003]));
    parts.push(part(box(0.085, 0.045, 0.16), spec.shoes, [ankle.x, 0.024, 0.035]));
    parts.push(flat(part(box(0.065, 0.025, 0.04), spec.shoes === '#8a5a3c' ? spec.shoes : '#e6b896', [ankle.x, 0.058, 0.09])));
  });
  return parts;
}

function torsoParts(spec: BodySpec): CastPart[] {
  return [
    part(lathe(TORSO, 0.44, 0.82, spec.bulk, { steps: 10 }), spec.torso, undefined, undefined, [1, 1, TORSO_Z]),
    part(cyl(0.043, 0.047, 0.1, 10), spec.neck, [0, 0.84, 0]),
  ];
}

function cloudPrints(profile: Profile, zScale: number, sleeves: Joints[]): CastPart[] {
  const parts: CastPart[] = [
    // Front: high on the left chest, low on the right; back: two big ones.
    printPatch(profile, 0.6, 0.74, 0.5, 0.95, 'print:cloud', zScale),
    printPatch(profile, 0.16, 0.32, -0.55, 0.9, 'print:cloud', zScale),
    printPatch(profile, 0.52, 0.72, Math.PI + 0.2, 1.1, 'print:cloud', zScale),
    printPatch(profile, 0.14, 0.32, Math.PI - 0.7, 1.0, 'print:cloud', zScale),
  ];
  sleeves.forEach((joints) => {
    const mid = joints.elbow.clone().lerp(joints.wrist, 0.45);
    const dir = joints.wrist.clone().sub(joints.elbow);
    const patch = aimAlong(
      new THREE.CylinderGeometry(0.075, 0.068, 0.09, 3, 1, true, Math.PI / 2 - 0.75, 1.5),
      mid,
      dir,
      v3(Math.sign(joints.elbow.x), 0, 0)
    );
    parts.push({
      geometry: patch, color: '#ffffff', ink: false, decal: { cell: 'print:cloud', mode: 'native' },
    });
  });
  return parts;
}

const CLOAK: Profile = [[0.05, 0.25], [0.3, 0.215], [0.5, 0.185], [0.66, 0.178], [0.76, 0.17], [0.81, 0.12]];

function bodySpec(member: CastMember, joints: [Joints, Joints]): BodySpec {
  const { look } = member;
  const o = look.outfit;
  const has = (accessory: Accessory) => look.accessories?.includes(accessory) ?? false;
  const { skin } = look;
  const spec: BodySpec = {
    torso: o.primary,
    legs: o.secondary,
    shoes: SANDAL,
    sleeves: [long(o.primary), long(o.primary)],
    hands: has('gloves') ? '#1f1f24' : skin,
    neck: look.face?.includes('mask') ? '#2b3554' : skin,
    bulk: member.id === 'akatsuchi' ? 1.18 : 1,
    extra: [],
  };
  const { extra } = spec;
  switch (o.style) {
    case 'tracksuit':
      spec.legs = o.primary;
      spec.shoes = '#1f2328';
      spec.sleeves = [long(o.primary, { upper: o.secondary }), long(o.primary, { upper: o.secondary })];
      extra.push(...clothLathe(TORSO, 0.66, 0.8, o.secondary, { grow: 1.05, zScale: TORSO_Z }));
      extra.push(part(cyl(0.082, 0.09, 0.07, 14, true), o.secondary, [0, 0.82, 0], undefined, [1, 1, 0.85]));
      extra.push(flat(part(new THREE.TorusGeometry(0.018, 0.005, 4, 10), '#f8fafc', [0, 0.69, 0.112])));
      extra.push(flat(part(box(0.008, 0.2, 0.006), '#1f2328', [0, 0.57, 0.093])));
      extra.push(printPatch(TORSO, 0.55, 0.7, Math.PI, 1.2, 'print:spiral', TORSO_Z, 1.02));
      break;
    case 'openShirt':
      spec.shoes = '#232b3d';
      extra.push(flat(part(new THREE.ConeGeometry(0.07, 0.22, 3), skin, [0, 0.69, 0.103], [Math.PI, 0, 0], [1, 1, 0.2])));
      extra.push(part(new THREE.TorusGeometry(0.136, 0.026, 6, 16), o.trim ?? '#6b3fa0', [0, 0.53, 0], [Math.PI / 2, 0, 0], [1, TORSO_Z, 1]));
      [-1, 1].forEach((side) => extra.push(part(new THREE.TorusGeometry(0.035, 0.014, 5, 10), o.trim ?? '#6b3fa0', [side * 0.04, 0.52, -0.11], [0, 0, side * 0.6])));
      extra.push(...clothLathe(flare(0.52, 0.34, 0.142, 0.17), 0.34, 0.52, o.secondary, { zScale: 0.8 }));
      break;
    case 'longCoat':
      spec.legs = '#5c1f1f';
      spec.shoes = '#3b2412';
      extra.push(...clothLathe(TORSO, 0.6, 0.8, o.secondary, { grow: 1.08, zScale: TORSO_Z }));
      extra.push(...clothLathe(flare(0.55, 0.22, 0.14, 0.22), 0.22, 0.55, o.primary, { lining: '#3f1515', open: 0.25 }));
      extra.push(part(box(0.04, 0.46, 0.02), o.trim ?? '#3b2412', [0.0, 0.64, 0.113], [-0.12, 0, 0.62]));
      extra.push(part(box(0.04, 0.4, 0.02), o.trim ?? '#3b2412', [0.0, 0.64, -0.113], [0.12, 0, -0.62]));
      break;
    case 'flakJacket': {
      const cloud = look.headband?.symbol === 'cloud';
      spec.torso = o.secondary;
      spec.sleeves = [long(o.secondary), long(o.secondary)];
      spec.wraps = BANDAGE;
      extra.push(...flakVest(o.primary, cloud));
      break;
    }
    case 'akatsukiCloak':
      spec.torso = o.primary;
      spec.legs = '#3a3a44';
      spec.shoes = '#2b2b33';
      spec.sleeves = [{ style: 'wide', color: o.primary }, { style: 'wide', color: o.primary }];
      extra.push(...clothLathe(CLOAK, 0.05, 0.81, o.primary, { zScale: 0.8, segments: 18 }));
      extra.push(part(cyl(0.118, 0.11, 0.13, 14, true), o.primary, [0, 0.85, 0], undefined, [1, 1, 0.9]));
      extra.push(flat(part(insideOut(cyl(0.118, 0.11, 0.13, 14, true)), o.secondary, [0, 0.85, 0], undefined, [1, 1, 0.9])));
      extra.push(...cloudPrints(CLOAK, 0.8, joints));
      break;
    case 'qipao':
      spec.sleeves = [{ style: 'none', color: skin }, { style: 'none', color: skin }];
      spec.legs = '#1f1f24';
      spec.shins = skin;
      spec.boots = '#1f1f24';
      spec.shoes = '#1f1f24';
      extra.push(...clothLathe(flare(0.53, 0.36, 0.135, 0.18), 0.36, 0.53, o.secondary, { zScale: 0.82 }));
      extra.push(printPatch(TORSO, 0.6, 0.73, Math.PI, 1.1, 'print:circle', TORSO_Z, 1.02));
      if (has('gloves')) {
        spec.sleeves = [{ style: 'none', color: skin, guard: '#1f1f24' }, { style: 'none', color: skin, guard: '#1f1f24' }];
      }
      break;
    case 'kimonoDress':
      spec.legs = '#2a2633';
      spec.shoes = '#232b3d';
      extra.push(...clothLathe(flare(0.53, 0.15, 0.135, 0.21), 0.15, 0.53, o.primary, { zScale: 0.82 }));
      extra.push(...clothLathe(TORSO, 0.5, 0.58, o.secondary, { grow: 1.08, zScale: TORSO_Z }));
      [-1, 1].forEach((side) => extra.push(part(ball(0.045, 7, 5), o.secondary, [side * 0.05, 0.55, -0.11], undefined, [1.3, 0.8, 0.6])));
      break;
    case 'robe':
      spec.shoes = '#3a2a1e';
      spec.sleeves = [{ style: 'wide', color: o.primary }, { style: 'wide', color: o.primary }];
      extra.push(...clothLathe(flare(0.53, 0.05, 0.135, 0.22), 0.05, 0.53, o.primary, { zScale: 0.82 }));
      extra.push(...clothLathe(TORSO, 0.5, 0.57, o.secondary, { grow: 1.08, zScale: TORSO_Z }));
      [-1, 1].forEach((side) => extra.push(part(box(0.035, 0.22, 0.012), o.secondary, [side * 0.045, 0.69, 0.103], [-0.1, 0, side * 0.42])));
      break;
    case 'longDress':
      spec.legs = '#2a2a33';
      spec.shoes = o.secondary;
      extra.push(...clothLathe(flare(0.53, 0.05, 0.13, 0.2), 0.05, 0.53, o.primary, { zScale: 0.82 }));
      extra.push(part(cyl(0.07, 0.08, 0.07, 12, true), o.secondary, [0, 0.83, 0]));
      break;
    case 'tunic':
      extra.push(...clothLathe(flare(0.53, 0.38, 0.135, 0.16), 0.38, 0.53, o.primary, { zScale: 0.82 }));
      extra.push(...clothLathe(TORSO, 0.505, 0.545, o.secondary, { grow: 1.1, zScale: TORSO_Z }));
      break;
    case 'cropTop':
      spec.torso = skin;
      spec.legs = '#2b2b2b';
      spec.shoes = '#1f1f24';
      spec.sleeves = [long(o.primary), { style: 'none', color: skin, guard: o.primary }];
      extra.push(...clothLathe(TORSO, 0.64, 0.81, o.primary, { grow: 1.05, zScale: TORSO_Z }));
      extra.push(...clothLathe(TORSO, 0.635, 0.655, o.trim ?? '#c4161c', { grow: 1.07, zScale: TORSO_Z }));
      extra.push(part(cyl(0.075, 0.085, 0.07, 12, true), o.primary, [0, 0.83, 0]));
      extra.push(...clothLathe(TORSO, 0.44, 0.5, '#2b2b2b', { grow: 1.04, zScale: TORSO_Z }));
      break;
    case 'haori': {
      const minato = has('flameHaori');
      if (minato) {
        spec.torso = o.secondary;
        spec.legs = o.secondary;
        spec.wraps = BANDAGE;
        extra.push(...flakVest(LEAF_VEST, false));
      } else {
        spec.torso = o.secondary;
        spec.legs = '#2b3550';
        spec.shoes = '#2b2b2b';
        extra.push(...clothLathe(TORSO, 0.5, 0.57, '#2b3550', { grow: 1.08, zScale: TORSO_Z }));
      }
      const coat = flare(0.8, 0.28, 0.168, 0.235);
      extra.push(...clothLathe(coat, 0.28, 0.8, o.primary, {
        open: 0.42, lining: o.primary, grow: minato ? 1.12 : 1.06,
      }));
      spec.sleeves = [{ style: 'wide', color: o.primary }, { style: 'wide', color: o.primary }];
      if (minato) {
        // Short white sleeves over the jonin suit.
        spec.sleeves = [long(LEAF_SUIT), long(LEAF_SUIT)];
        joints.forEach((arm) => extra.push(tube(arm.shoulder, arm.shoulder.clone().lerp(arm.elbow, 0.85), 0.06, 0.074, o.primary, 10)));
        // The red flames along the hem, all round but the open front.
        [-2.45, -1.35, 1.35, 2.45, Math.PI].forEach((phi) => extra.push(
          printPatch(coat, 0.28, 0.44, phi, 1.05, 'print:flames', 0.82, 1.12 * 1.012)
        ));
      }
      break;
    }
    case 'sageVest':
      spec.torso = o.secondary;
      spec.legs = '#4b5b3c';
      spec.shoes = '#8a5a3c';
      spec.sleeves = [{ style: 'short', color: o.secondary, guard: STEEL }, { style: 'short', color: o.secondary, guard: STEEL }];
      extra.push(...clothLathe(flare(0.53, 0.3, 0.135, 0.18), 0.3, 0.53, o.secondary, { zScale: 0.82 }));
      extra.push(...clothLathe(flare(0.8, 0.36, 0.168, 0.2), 0.36, 0.8, o.primary, { open: 0.38, lining: o.primary, grow: 1.08 }));
      [-1, 1].forEach((side) => extra.push(flat(part(cyl(0.03, 0.03, 0.01, 10), '#f2c94c', [side * 0.11, 0.6, 0.15], [Math.PI / 2, 0, side * 0.6]))));
      break;
    case 'bodysuit':
      spec.legs = o.primary;
      spec.shoes = '#1f1f24';
      if (look.face?.includes('porcelainMask')) {
        spec.sleeves = [long(o.primary, { guard: o.secondary }), long(o.primary, { guard: o.secondary })];
        extra.push(...clothLathe(TORSO, 0.58, 0.79, o.secondary, { grow: 1.1, zScale: TORSO_Z }));
      } else {
        extra.push(...clothLathe(TORSO, 0.5, 0.55, o.secondary, { grow: 1.08, zScale: TORSO_Z }));
        extra.push(part(box(0.035, 0.42, 0.02), o.secondary, [0, 0.64, 0.105], [-0.1, 0, -0.62]));
      }
      break;
    case 'plant':
    default:
      spec.legs = o.primary;
      spec.shoes = o.primary;
      spec.neck = o.primary;
      spec.hands = o.primary;
      break;
  }
  return spec;
}

// --- Accessories -------------------------------------------------------------------------

function swordParts(
  from: THREE.Vector3,
  to: THREE.Vector3,
  blade: string,
  hilt: string,
  width = 0.03
): CastPart[] {
  const dir = to.clone().sub(from);
  const length = dir.length();
  const hiltEnd = from.clone().lerp(to, 0.28);
  const parts: CastPart[] = [
    { geometry: aimAlong(box(width, length * 0.72, 0.012), hiltEnd.clone().lerp(to, 0.5), dir, v3(0, 0, 1)), color: blade },
    { geometry: aimAlong(cyl(0.016, 0.016, length * 0.28, 6), from.clone().lerp(hiltEnd, 0.5), dir), color: hilt },
    flat({ geometry: aimAlong(cyl(0.032, 0.032, 0.012, 8), hiltEnd, dir), color: DARK_STEEL }),
  ];
  return parts;
}

function accessoryParts(member: CastMember, joints: [Joints, Joints]): CastPart[] {
  const { look } = member;
  const parts: CastPart[] = [];
  const [right, left] = joints;
  (look.accessories ?? []).forEach((accessory) => {
    switch (accessory) {
      case 'gourd':
        parts.push(part(ball(0.15, 12, 10), '#b07a4a', [0.05, 0.6, -0.23], undefined, [1, 1, 0.85]));
        parts.push(part(ball(0.1, 10, 8), '#b07a4a', [0.11, 0.83, -0.22]));
        parts.push(part(new THREE.TorusGeometry(0.06, 0.018, 5, 12), '#7a4f2c', [0.09, 0.73, -0.225], [Math.PI / 2, 0, -0.3]));
        parts.push(part(cyl(0.035, 0.04, 0.05, 8), '#5a3b1f', [0.13, 0.94, -0.22], [0, 0, -0.3]));
        break;
      case 'swordBack':
        if (look.outfit.style === 'openShirt') {
          // Sasuke's sword rides the back of his rope belt.
          parts.push(...swordParts(v3(-0.25, 0.58, -0.12), v3(0.32, 0.46, -0.16), '#d8dde6', '#2a2a2a', 0.026));
        } else {
          parts.push(...swordParts(v3(-0.2, 0.98, -0.16), v3(0.2, 0.42, -0.17), '#d8dde6', '#2a2a2a'));
        }
        break;
      case 'cleaver':
        parts.push({ geometry: aimAlong(box(0.16, 0.6, 0.02), v3(0.04, 0.66, -0.17), v3(0.45, -1, 0), v3(0, 0, 1)), color: '#d8dde6' });
        parts.push(flat({ geometry: aimAlong(cyl(0.035, 0.035, 0.025, 10), v3(0.13, 0.46, -0.17), v3(0, 0, 1)), color: '#1f2937' }));
        parts.push(limb(v3(-0.1, 0.95, -0.16), v3(-0.04, 0.84, -0.16), 0.02, '#7c2d12'));
        break;
      case 'wrappedSword':
        parts.push(limb(v3(0.12, 0.3, -0.17), v3(-0.08, 0.92, -0.16), 0.06, BANDAGE));
        [0.42, 0.58, 0.74].forEach((y) => parts.push(flat(part(
          new THREE.TorusGeometry(0.062, 0.008, 4, 12),
          '#9a8f78',
          [0.12 - ((y - 0.3) / 0.62) * 0.2, y, -0.165],
          [Math.PI / 2 - 0.3, 0, 0.32]
        ))));
        [-1, 1].forEach((side) => parts.push(limb(v3(-0.09 + side * 0.03, 0.94, -0.16), v3(-0.11 + side * 0.04, 1.05, -0.16), 0.016, '#3a5d8f')));
        break;
      case 'giantFan':
        parts.push({ geometry: aimAlong(box(0.11, 0.86, 0.07), v3(0.0, 0.58, -0.18), v3(-0.32, 1, 0), v3(0, 0, -1)), color: '#4a3426' });
        [0.25, 0.92].forEach((t) => parts.push(part(
          cyl(0.065, 0.065, 0.04, 8),
          STEEL,
          [0.14 - t * 0.28, 0.17 + t * 0.82, -0.18],
          [0, 0, 0.31]
        )));
        break;
      case 'puppetBundle':
        parts.push(limb(v3(0.0, 0.42, -0.24), v3(0.04, 0.86, -0.23), 0.13, '#d6c7a1'));
        [0.52, 0.68].forEach((y) => parts.push(part(new THREE.TorusGeometry(0.13, 0.014, 4, 14), '#6b5d4f', [0.02, y, -0.235], [Math.PI / 2, 0, 0])));
        parts.push(part(ball(0.07, 8, 6), '#d6c7a1', [0.05, 0.98, -0.22]));
        break;
      case 'kunaiPouch':
        parts.push(part(box(0.06, 0.08, 0.05), '#2a2f3a', [-0.12, 0.34, 0.03]));
        parts.push(part(cyl(0.058, 0.058, 0.025, 10, true), '#2a2f3a', [-0.078, 0.37, 0.01]));
        break;
      case 'threeProngKunai': {
        const hand = right.hand.clone();
        parts.push(limb(hand.clone().add(v3(0, -0.06, 0)), hand.clone().add(v3(0, 0.03, 0)), 0.012, '#2a2a2a'));
        [-1, 0, 1].forEach((prong) => parts.push(flat({
          geometry: aimAlong(
            new THREE.ConeGeometry(0.014, prong === 0 ? 0.14 : 0.08, 4),
            hand.clone().add(v3(prong * 0.03, 0.1 - Math.abs(prong) * 0.03, 0.01)),
            v3(prong * 0.5, 1, 0)
          ),
          color: STEEL,
        })));
        break;
      }
      case 'book': {
        const hand = left.hand.clone();
        parts.push(part(box(0.085, 0.115, 0.03), '#f08a24', [hand.x - 0.03, hand.y + 0.02, hand.z + 0.02], [-0.3, -0.3, 0]));
        break;
      }
      case 'bigScroll':
        parts.push(part(cyl(0.085, 0.085, 0.56, 12), '#c0392b', [0, 0.52, -0.22], [0, 0, Math.PI / 2]));
        [-1, 1].forEach((side) => parts.push(part(cyl(0.095, 0.095, 0.04, 12), '#e8d9b0', [side * 0.29, 0.52, -0.22], [0, 0, Math.PI / 2])));
        break;
      case 'scrollBrush': {
        parts.push(part(cyl(0.04, 0.04, 0.24, 10), '#e8e0c8', [0.0, 0.52, -0.16], [0, 0, Math.PI / 2]));
        const hand = right.hand.clone();
        parts.push(flat(limb(hand.clone().add(v3(0, -0.05, 0)), hand.clone().add(v3(0.03, 0.1, 0.02)), 0.008, '#5b3a1f')));
        parts.push(swordParts(v3(-0.16, 0.96, -0.15), v3(0.14, 0.62, -0.16), '#d8dde6', '#1f1f1f', 0.022)[0]);
        break;
      }
      case 'lollipop':
        parts.push(flat(limb(v3(0.03, HEAD_Y - 0.105, 0.15), v3(0.07, HEAD_Y - 0.12, 0.2), 0.005, '#f8fafc')));
        parts.push(flat(part(ball(0.02, 6, 5), '#e11d48', [0.075, HEAD_Y - 0.122, 0.205])));
        break;
      case 'paperFlower':
        [0, 1, 2, 3, 4].forEach((petal) => {
          const angle = (petal / 5) * Math.PI * 2;
          parts.push(flat(part(
            ball(0.03, 6, 4),
            '#f8fafc',
            [0.13 + Math.cos(angle) * 0.03, HEAD_Y + 0.1 + Math.sin(angle) * 0.03, -0.08],
            [0, 0.9, 0],
            [1, 1, 0.35]
          )));
        });
        break;
      case 'gunbai':
        parts.push(part(cyl(0.2, 0.2, 0.02, 14), '#ece4d0', [0.02, 0.66, -0.22], [Math.PI / 2, 0, 0.2]));
        parts.push(flat(part(new THREE.TorusGeometry(0.2, 0.012, 4, 18), '#6b3a2a', [0.02, 0.66, -0.232], [0, 0, 0.2])));
        parts.push(limb(v3(0.08, 0.48, -0.22), v3(0.2, 0.18, -0.21), 0.018, '#5b3a1f'));
        break;
      case 'senbon': {
        const hand = right.hand.clone();
        [-1, 0, 1].forEach((needle) => parts.push(flat(limb(
          hand.clone().add(v3(needle * 0.015, 0.0, 0.02)),
          hand.clone().add(v3(needle * 0.03, 0.09, 0.05)),
          0.003,
          STEEL
        ))));
        break;
      }
      case 'scopeEye':
        parts.push(flat({ geometry: aimAlong(cyl(0.024, 0.026, 0.05, 8), v3(0.068, HEAD_Y - 0.022, 0.17), v3(0, 0, 1)), color: '#9aa3ad' }));
        parts.push(flat({ geometry: aimAlong(cyl(0.017, 0.017, 0.006, 8), v3(0.068, HEAD_Y - 0.022, 0.197), v3(0, 0, 1)), color: '#3b82f6' }));
        break;
      case 'chakraThreads':
        joints.forEach((arm) => [-1, 0, 1].forEach((thread) => parts.push(flat(limb(
          arm.hand.clone(),
          arm.hand.clone().add(v3(thread * 0.05, 0.02, 0.22)),
          0.003,
          '#7dd3fc'
        )))));
        break;
      case 'earrings':
        [-1, 1].forEach((side) => parts.push(flat(part(ball(0.012, 5, 4), STEEL, [side * 0.178, HEAD_Y - 0.06, 0.0]))));
        break;
      case 'kageHat':
        parts.push(part(new THREE.ConeGeometry(0.32, 0.17, 16, 1), '#f1ece0', [0, HEAD_Y + 0.2, 0]));
        parts.push(part(new THREE.ConeGeometry(0.1, 0.06, 12, 1), '#8a5a2b', [0, HEAD_Y + 0.27, 0]));
        parts.push(flat(part(box(0.09, 0.07, 0.01), '#8a5a2b', [0, HEAD_Y + 0.17, 0.2], [-0.48, 0, Math.PI / 4])));
        break;
      case 'helmet':
        parts.push(cap(STEEL, 1.15, -0.3, 1.12));
        [-1, 1].forEach((side) => parts.push(part(box(0.025, 0.16, 0.09), STEEL, [side * 0.18, HEAD_Y - 0.05, 0.03], [0, 0, side * 0.08])));
        break;
      case 'zetsuLeaves':
        [-1, 1].forEach((side) => {
          // Two leaves, hinged at the back and opened at the front.
          parts.push(part(
            new THREE.SphereGeometry(0.3, 10, 8, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0.3, 1.5),
            look.outfit.secondary,
            [side * 0.05, HEAD_Y - 0.16, -0.05],
            [0, side * 0.75, side * 0.12],
            [0.7, 1.15, 0.8]
          ));
          ring(4, 0.45, 1.6).forEach((theta) => parts.push(flat(part(
            new THREE.ConeGeometry(0.018, 0.08, 4),
            '#e8e2c4',
            [side * (0.14 + Math.sin(theta) * 0.17), HEAD_Y - 0.16 + Math.cos(theta) * 0.34, 0.1],
            [0.6, 0, side * 0.3]
          ))));
        });
        break;
      case 'flameHaori':
      case 'clayPouch':
      case 'ring':
      case 'glasses':
      case 'gloves':
      default:
        // Painted (glasses), part of the outfit (gloves, flames) or too small
        // to read at the arena's distance (rings, clay pouches under the cloak).
        break;
    }
  });
  return parts;
}

function faceGear(look: CastLook): CastPart[] {
  const parts: CastPart[] = [];
  (look.face ?? []).forEach((mark) => {
    if (mark === 'beard') {
      parts.push(part(new THREE.ConeGeometry(0.06, 0.14, 7), '#f2f2f2', [0, HEAD_Y - 0.19, 0.11], [Math.PI + 0.35, 0, 0]));
      parts.push(flat(part(ball(0.032, 7, 5), '#e09a7a', [0, HEAD_Y - 0.05, 0.17])));
    }
  });
  return parts;
}

// --- Enemy gear ------------------------------------------------------------------------------

/** What an enemy carries and wears on top of its cast look (monsterLooks.ts shapes). */
export type EnemyGear = {
  head: 'topknot' | 'peakHood' | 'brimHat' | 'squareCowl' | 'twinStalks' | 'lowDome' | 'finCrest';
  carry: 'shortBlade' | 'backBlade' | 'hookRod' | 'spadeStaff' | 'foldedFan' | 'clawSets' | 'hookClaws';
  trim: string;
  carried: string;
};

export function enemyGearParts(look: CastLook, gear: EnemyGear, joints: [Joints, Joints]): CastPart[] {
  const parts: CastPart[] = [];
  const [right, left] = joints;
  const hair = look.hair.color;
  switch (gear.head) {
    case 'topknot':
      parts.push(part(cyl(0.03, 0.035, 0.03, 8), gear.trim, [0, HEAD_Y + 0.19, -0.03]));
      parts.push(spike(4, 0, 0.12, 0.045, hair, [0, 1, -0.2]));
      break;
    case 'peakHood':
      // A hood pulled back over the shoulders.
      parts.push(part(new THREE.ConeGeometry(0.15, 0.28, 6), gear.trim, [0, 0.9, -0.17], [-1.2, 0, 0]));
      break;
    case 'brimHat':
      parts.push(part(new THREE.ConeGeometry(0.31, 0.12, 14), gear.trim, [0, HEAD_Y + 0.2, 0]));
      parts.push(part(cyl(0.12, 0.13, 0.04, 12), '#3b3324', [0, HEAD_Y + 0.15, 0]));
      break;
    case 'squareCowl':
      // The Sand's head cloth, falling to the shoulders under the band.
      parts.push(part(
        new THREE.SphereGeometry(HEAD_R * 1.16, 6, 5, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, 2.2),
        gear.trim,
        [0, HEAD_Y + 0.01, -0.01],
        undefined,
        [1.05, 1, 1]
      ));
      parts.push(part(box(0.3, 0.2, 0.05), gear.trim, [0, 0.82, -0.15], [0.35, 0, 0]));
      break;
    case 'twinStalks':
      [-1, 1].forEach((side) => parts.push(spike(20, side * 40, 0.2, 0.04, hair, [side * 0.3, 1.2, 0], 0.8)));
      break;
    case 'finCrest':
      [0.12, 0.02, -0.08].forEach((z, index) => parts.push(part(
        new THREE.ConeGeometry(0.03, 0.18 - index * 0.03, 4),
        gear.trim,
        [0, HEAD_Y + 0.17 - index * 0.02, z],
        undefined,
        [0.5, 1, 1.4]
      )));
      break;
    case 'lowDome':
    default:
      break;
  }
  switch (gear.carry) {
    case 'shortBlade': {
      const hand = right.hand.clone();
      parts.push(flat({ geometry: aimAlong(new THREE.TorusGeometry(0.018, 0.005, 4, 8), hand.clone().add(v3(0, -0.05, 0)), v3(0, 0, 1)), color: gear.carried }));
      parts.push({ geometry: aimAlong(new THREE.ConeGeometry(0.022, 0.16, 4), hand.clone().add(v3(0, 0.08, 0.02)), v3(0, 1, 0.3)), color: gear.carried });
      break;
    }
    case 'hookRod': {
      const hand = right.hand.clone();
      parts.push(limb(hand.clone().add(v3(0, -0.35, 0)), hand.clone().add(v3(0, 0.55, 0)), 0.014, gear.carried));
      parts.push(part(new THREE.TorusGeometry(0.05, 0.012, 4, 10, Math.PI * 1.2), gear.carried, [hand.x - 0.045, hand.y + 0.58, hand.z], [0, 0, 0]));
      break;
    }
    case 'spadeStaff': {
      const hand = right.hand.clone();
      parts.push(limb(hand.clone().add(v3(0, -0.3, 0)), hand.clone().add(v3(0, 0.5, 0)), 0.016, gear.carried));
      parts.push(part(box(0.13, 0.15, 0.02), STEEL, [hand.x, hand.y + 0.58, hand.z]));
      break;
    }
    case 'foldedFan':
      parts.push(part(
        new THREE.CylinderGeometry(0.22, 0.22, 0.02, 7, 1, false, -0.75, 1.5),
        gear.carried,
        [right.hand.x, right.hand.y + 0.05, right.hand.z + 0.02],
        [-Math.PI / 2, 0, 0]
      ));
      break;
    case 'clawSets':
    case 'hookClaws':
      [right, left].forEach((arm) => [-1, 0, 1].forEach((claw) => parts.push(flat({
        geometry: aimAlong(
          new THREE.ConeGeometry(0.014, gear.carry === 'hookClaws' ? 0.11 : 0.08, 4),
          arm.hand.clone().add(v3(claw * 0.02, -0.04, 0.05)),
          v3(0, gear.carry === 'hookClaws' ? -0.4 : -1, 1)
        ),
        color: gear.carried,
      }))));
      break;
    case 'backBlade':
    default:
      break;
  }
  return parts;
}

// --- The whole figure ---------------------------------------------------------------------

export type CastRecipe = { parts: CastPart[]; joints: [Joints, Joints] };

/** Every part of `member`'s figure at scale 1 (scale and placement are applied when merged). */
export function castFigureParts(member: CastMember, gear?: EnemyGear): CastRecipe {
  const { look } = member;
  const bulk = member.id === 'akatsuchi' ? 1.18 : 1;
  const holdRight = gear?.carry === 'shortBlade';
  const joints: [Joints, Joints] = [
    armJoints(-1, armPoseFor(look, -1, holdRight), bulk),
    armJoints(1, armPoseFor(look, 1, false), bulk),
  ];
  const spec = bodySpec(member, joints);
  const parts: CastPart[] = [
    ...torsoParts(spec),
    ...legParts(spec),
    ...armParts(spec, -1, joints[0], look.skin),
    ...armParts(spec, 1, joints[1], look.skin),
    ...spec.extra,
    ...headParts(member, look),
    ...faceGear(look),
    ...hairParts(member.id, look.hair.style, look.hair.color),
    ...headbandParts(look, { shoulder: joints[1].shoulder, elbow: joints[1].elbow }),
    ...accessoryParts(member, joints),
    ...(gear ? enemyGearParts(look, gear, joints) : []),
  ];
  return { parts, joints };
}
