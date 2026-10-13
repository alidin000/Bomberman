import * as THREE from 'three';
import {
  FigurePart, Vec3, mergeFigureParts, part
} from '../figureGeometry';
import {
  ball, box, chain, cone, drum, limb, spike,
} from '../beasts/beastKit';

/**
 * The jutsu's shapes, each built once and shared: the blast layers instance
 * them (ExplosionField), the bombs and enemy attacks mount them. All are
 * plain merged primitives or flat shapes, drawn with the scene's existing
 * material programs.
 */

const polar = (r: number, angle: number): [number, number] => (
  [Math.cos(angle) * r, Math.sin(angle) * r]
);

function flat(shape: THREE.Shape, segments = 6): THREE.BufferGeometry {
  // Shapes are drawn in x/y; lay them on the floor facing up.
  return new THREE.ShapeGeometry(shape, segments).rotateX(-Math.PI / 2);
}

function cached(build: () => THREE.BufferGeometry): () => THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry | null = null;
  return () => {
    if (!geometry) geometry = build();
    return geometry;
  };
}

/** A forked lightning bolt, 1.2 tall from its foot at the origin. */
export const boltGeometry = cached(() => {
  const path: Vec3[] = [
    [0.03, 1.2, 0], [0.13, 0.96, 0.03], [-0.07, 0.73, -0.02],
    [0.11, 0.49, 0.02], [-0.05, 0.25, 0], [0.02, 0, 0],
  ];
  return mergeFigureParts([
    ...chain(path, 0.034, 0.024, 4),
    limb(path[3], [0.28, 0.36, 0.05], 0.022, 0.012, 4),
    limb(path[2], [-0.24, 0.62, 0.02], 0.022, 0.012, 4),
    limb([0.28, 0.36, 0.05], [0.33, 0.22, 0.02], 0.012, 0.008, 4),
  ]);
});

/** A cloud of smoke: lumps clustered round the origin. */
export const puffGeometry = cached(() => mergeFigureParts([
  part(new THREE.IcosahedronGeometry(0.2, 1)),
  part(new THREE.IcosahedronGeometry(0.15, 1), [0.17, -0.04, 0.06]),
  part(new THREE.IcosahedronGeometry(0.15, 1), [-0.16, -0.03, -0.05]),
  part(new THREE.IcosahedronGeometry(0.13, 1), [0.03, 0.12, -0.09]),
  part(new THREE.IcosahedronGeometry(0.12, 1), [-0.05, -0.02, 0.17]),
]));

/**
 * The Rasenshuriken's four wind blades, a pinwheel lying flat, radius 0.56:
 * a convex leading edge out to each tip and a curved trailing edge back.
 */
export const rasenshurikenGeometry = cached(() => {
  const shape = new THREE.Shape();
  for (let blade = 0; blade < 4; blade += 1) {
    const a = (blade * Math.PI) / 2;
    const start = polar(0.15, a - 0.55);
    if (blade === 0) shape.moveTo(...start);
    else shape.lineTo(...start);
    shape.quadraticCurveTo(...polar(0.44, a - 0.3), ...polar(0.56, a));
    shape.quadraticCurveTo(...polar(0.25, a + 0.1), ...polar(0.15, a + 0.62));
  }
  shape.closePath();
  return flat(shape, 8);
});

/** A bird with spread wings, beak toward +z: Itachi's crows, Deidara's clay birds. */
export const birdGeometry = cached(() => mergeFigureParts([
  part(ball(0.1, 8, 6), [0, 0, 0], undefined, [0.8, 0.7, 1.5]),
  part(ball(0.07, 8, 6), [0, 0.04, 0.15]),
  spike([0, 0.03, 0.2], [0, 0.02, 0.29], 0.025, 4),
  part(box(0.3, 0.02, 0.13), [0.17, 0.05, -0.01], [0, 0.25, 0.35]),
  part(box(0.3, 0.02, 0.13), [-0.17, 0.05, -0.01], [0, -0.25, -0.35]),
  part(box(0.1, 0.015, 0.12), [0, 0, -0.18], [0.2, 0, 0]),
]));

/** One tomoe: a round head and a tapering tail curving round the ring. */
function tomoeShape(angle: number, radius: number): THREE.Shape {
  const centre = polar(radius, angle);
  const tangent = [-Math.sin(angle), Math.cos(angle)];
  const out = [Math.cos(angle), Math.sin(angle)];
  const at = (t: number, o: number): [number, number] => [
    centre[0] + tangent[0] * t + out[0] * o,
    centre[1] + tangent[1] * t + out[1] * o,
  ];
  const shape = new THREE.Shape();
  shape.moveTo(...at(0, 0.075));
  shape.quadraticCurveTo(...at(0.13, 0.09), ...at(0.21, 0.03));
  shape.quadraticCurveTo(...at(0.1, 0.0), ...at(0, -0.075));
  shape.absarc(centre[0], centre[1], 0.075, angle + Math.PI, angle + Math.PI * 2, false);
  return shape;
}

/** The Sharingan's three tomoe on their ring, lying flat, radius about 0.3. */
export const tomoeGeometry = cached(() => {
  const ring = new THREE.RingGeometry(0.255, 0.285, 36).rotateX(-Math.PI / 2);
  const parts: FigurePart[] = [part(ring)];
  for (let index = 0; index < 3; index += 1) {
    parts.push(part(flat(tomoeShape((index * Math.PI * 2) / 3, 0.27))));
    parts.push(part(new THREE.CircleGeometry(0.075, 12).rotateX(-Math.PI / 2), [
      Math.cos((index * Math.PI * 2) / 3) * 0.27,
      0.001,
      -Math.sin((index * Math.PI * 2) / 3) * 0.27,
    ]));
  }
  return mergeFigureParts(parts);
});

/**
 * Minato's three-pronged kunai, blade down (toward -y) from a ring pommel at
 * about +0.2: a diamond blade between two curved prongs.
 */
export const kunaiGeometry = cached(() => mergeFigureParts([
  part(new THREE.OctahedronGeometry(0.1, 0), [0, -0.2, 0], undefined, [0.55, 1.9, 0.16]),
  ...chain([[0.025, -0.06, 0], [0.09, -0.11, 0], [0.12, -0.2, 0]], 0.016, 0.006, 4),
  ...chain([[-0.025, -0.06, 0], [-0.09, -0.11, 0], [-0.12, -0.2, 0]], 0.016, 0.006, 4),
  part(box(0.1, 0.022, 0.03), [0, -0.05, 0]),
  part(drum(0.018, 0.018, 0.2, 6), [0, 0.06, 0]),
  part(new THREE.TorusGeometry(0.038, 0.011, 4, 10), [0, 0.2, 0]),
]));

/** A plain kunai (the rogue genin's), blade down. */
export const plainKunaiGeometry = cached(() => mergeFigureParts([
  part(new THREE.OctahedronGeometry(0.1, 0), [0, -0.19, 0], undefined, [0.5, 1.8, 0.16]),
  part(drum(0.016, 0.016, 0.18, 6), [0, 0.03, 0]),
  part(new THREE.TorusGeometry(0.034, 0.01, 4, 10), [0, 0.15, 0]),
]));

/** The paper seal tag wrapped round a kunai's grip, with its ink formula. */
export const sealTagGeometry = cached(() => mergeFigureParts([
  part(box(0.065, 0.15, 0.006), [0, 0.03, 0.022]),
]));
export const sealInkGeometry = cached(() => mergeFigureParts([
  part(box(0.012, 0.11, 0.004), [0, 0.03, 0.027]),
  part(box(0.04, 0.008, 0.004), [0, 0.07, 0.027]),
  part(box(0.04, 0.008, 0.004), [0, 0.0, 0.027]),
]));

/** Jagged sand spikes erupting from the floor, about 0.6 tall. */
export const sandSpikesGeometry = cached(() => mergeFigureParts([
  spike([0, 0, 0], [0.02, 0.62, 0.03], 0.09, 5),
  spike([0.17, 0, 0.06], [0.3, 0.44, 0.1], 0.07, 5),
  spike([-0.15, 0, 0.1], [-0.28, 0.4, 0.16], 0.065, 5),
  spike([0.04, 0, -0.17], [0.07, 0.38, -0.32], 0.06, 5),
  spike([-0.1, 0, -0.1], [-0.2, 0.3, -0.22], 0.05, 5),
  part(cone(0.3, 0.08, 7), [0, 0.03, 0]),
]));

/** A water clone's puddle: a flat ripple ring and a few droplets. */
export const splashRingGeometry = cached(() => (
  new THREE.RingGeometry(0.26, 0.34, 20).rotateX(-Math.PI / 2)
));
export const splashDropGeometry = cached(() => mergeFigureParts([
  part(ball(0.035, 6, 4), [0.22, 0.08, 0.1], undefined, [1, 1.5, 1]),
  part(ball(0.03, 6, 4), [-0.2, 0.12, 0.05], undefined, [1, 1.5, 1]),
  part(ball(0.028, 6, 4), [0.04, 0.1, -0.24], undefined, [1, 1.5, 1]),
]));
