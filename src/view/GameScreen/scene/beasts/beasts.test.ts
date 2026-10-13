import * as THREE from 'three';
import { BossId } from '../../../../content/types';
import {
  BOSS_FIGURE_LOOKS,
  bossTailCount,
  getBossFaceGeometry,
  getBossFigureGeometries,
  getBossInkHullGeometry,
  getBossTailGeometry,
  getBossTailInkGeometry,
  getBossToneGeometry,
} from '../BossFigure';
import { relativeLuminance } from '../highContrast';

// Each tailed beast must read as the anime's at a glance: its animal, its
// colours and its tell-tale features where the play camera (looking down at
// about 54°) sees them, all inside the figure's bounds.

const box = (geometry: THREE.BufferGeometry | null) => {
  if (!geometry) throw new Error('missing geometry');
  geometry.computeBoundingBox();
  return geometry.boundingBox!.clone();
};
const hue = (hex: string) => {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
  return hsl;
};

/** The highest vertices of a geometry (the top `share` of its height). */
function topPoints(geometry: THREE.BufferGeometry, share = 0.04): THREE.Vector3[] {
  const positions = geometry.getAttribute('position');
  const all: THREE.Vector3[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    all.push(new THREE.Vector3().fromBufferAttribute(positions, index));
  }
  const top = all.reduce((most, point) => Math.max(most, point.y), -Infinity);
  const bottom = all.reduce((least, point) => Math.min(least, point.y), Infinity);
  return all.filter((point) => point.y >= top - (top - bottom) * share);
}

/** Everything a beast draws in one geometry: its tones merged for the silhouette. */
function silhouette(id: BossId): THREE.Box3 {
  const geometries = getBossFigureGeometries(id);
  const result = new THREE.Box3();
  Object.values(geometries).forEach((geometry) => result.union(box(geometry!)));
  return result;
}

describe('tailed beasts', () => {
  it('draws each beast as its animal in its anime colours', () => {
    const outlines = Object.entries(BOSS_FIGURE_LOOKS).map(([id, look]) => [id, look.outline]);
    expect(Object.fromEntries(outlines))
      .toEqual({
        shukaku: 'tanuki',
        matatabi: 'cat',
        isobu: 'turtle',
        sonGoku: 'ape',
        kokuo: 'horse',
        saiken: 'slug',
        chomei: 'beetle',
        gyuki: 'ox',
        kurama: 'fox',
      });
    // Kurama orange, Shukaku sand, Matatabi blue, Son Goku red, Kokuo and
    // Saiken white, Chomei blue, Gyuki grey-purple.
    expect(hue(BOSS_FIGURE_LOOKS.kurama.body).h * 360).toBeGreaterThan(12);
    expect(hue(BOSS_FIGURE_LOOKS.kurama.body).h * 360).toBeLessThan(32);
    expect(hue(BOSS_FIGURE_LOOKS.shukaku.body).h * 360).toBeGreaterThan(30);
    expect(hue(BOSS_FIGURE_LOOKS.shukaku.body).h * 360).toBeLessThan(50);
    expect(hue(BOSS_FIGURE_LOOKS.matatabi.body).h * 360).toBeGreaterThan(200);
    expect(hue(BOSS_FIGURE_LOOKS.matatabi.body).h * 360).toBeLessThan(240);
    expect(hue(BOSS_FIGURE_LOOKS.sonGoku.body).h * 360).toBeLessThan(12);
    expect(relativeLuminance(BOSS_FIGURE_LOOKS.kokuo.body)).toBeGreaterThan(0.8);
    expect(relativeLuminance(BOSS_FIGURE_LOOKS.saiken.body)).toBeGreaterThan(0.75);
    expect(hue(BOSS_FIGURE_LOOKS.chomei.body).h * 360).toBeGreaterThan(195);
    expect(hue(BOSS_FIGURE_LOOKS.gyuki.body).h * 360).toBeGreaterThan(260);
    // Kurama's eyes red against black markings; Shukaku's gold against indigo.
    expect((hue(BOSS_FIGURE_LOOKS.kurama.core).h * 360) % 360).toBeLessThan(8);
    expect(relativeLuminance(BOSS_FIGURE_LOOKS.kurama.trim)).toBeLessThan(0.02);
    expect(hue(BOSS_FIGURE_LOOKS.shukaku.core).h * 360).toBeGreaterThan(40);
    expect(hue(BOSS_FIGURE_LOOKS.shukaku.trim).h * 360).toBeGreaterThan(220);
  });

  it('crowns Kurama with two tall ears and Gyuki with two wide horns', () => {
    // The highest points are a left and a right ear (or horn), not one crest.
    const ears = topPoints(getBossToneGeometry('kurama', 'body')!);
    expect(ears.some((point) => point.x < -0.2)).toBe(true);
    expect(ears.some((point) => point.x > 0.2)).toBe(true);
    expect(ears.every((point) => Math.abs(point.x) > 0.2)).toBe(true);
    // The ears rise well above the head (which tops out near 0.56).
    expect(box(getBossToneGeometry('kurama', 'body')).max.y).toBeGreaterThan(0.8);

    const horns = getBossToneGeometry('gyuki', 'mark')!;
    expect(box(horns).max.y).toBeGreaterThanOrEqual(silhouette('gyuki').max.y - 1e-6);
    const tips = topPoints(horns);
    expect(tips.every((point) => Math.abs(point.x) > 0.3)).toBe(true);
  });

  it('gives Chomei its horn, Isobu one open eye and Matatabi odd eyes', () => {
    // Chomei: a horn rising from the front of its head.
    const beetle = topPoints(getBossToneGeometry('chomei', 'body')!);
    expect(beetle.every((point) => Math.abs(point.x) < 0.06 && point.z > 0.35)).toBe(true);
    // Isobu: its right eye stays shut, so its one glowing eye is its left
    // (on the viewer's right).
    const turtle = box(getBossFaceGeometry('isobu'));
    expect(turtle.min.x).toBeGreaterThan(0);
    // Matatabi: gold right eye (viewer's left) and green left eye.
    const cat = box(getBossFaceGeometry('matatabi'));
    const green = box(getBossToneGeometry('matatabi', 'mark'));
    expect(cat.max.x).toBeLessThan(0);
    expect(green.min.x).toBeGreaterThan(0);
    expect(hue(BOSS_FIGURE_LOOKS.matatabi.core).h * 360).toBeLessThan(60);
    expect(hue(BOSS_FIGURE_LOOKS.matatabi.mark).h * 360).toBeGreaterThan(100);
  });

  it('gives Shukaku its one huge tail and Kurama nine', () => {
    const width = (id: BossId) => {
      const size = box(getBossTailGeometry(id)).getSize(new THREE.Vector3());
      return Math.max(size.x, size.z);
    };
    expect(bossTailCount('shukaku')).toBe(1);
    expect(bossTailCount('kurama')).toBe(9);
    const others = (Object.keys(BOSS_FIGURE_LOOKS) as BossId[]).filter((id) => id !== 'shukaku');
    others.forEach((id) => expect({ id, thinner: width(id) < width('shukaku') }).toEqual({ id, thinner: true }));
  });

  it('inks every beast like the fighters: one line round the body and one per tail', () => {
    (Object.keys(BOSS_FIGURE_LOOKS) as BossId[]).forEach((id) => {
      const hull = box(getBossInkHullGeometry(id));
      const body = box(getBossFigureGeometries(id).body!);
      // The line's shell wraps the body (bar the parts too small for a line:
      // a claw, a horn's tip)...
      const wraps = hull.containsBox(body.clone().expandByScalar(-0.035));
      expect({ id, wraps }).toEqual({ id, wraps: true });
      // ...with smoothed normals, so the pushed-out shell stays closed.
      const hullGeometry = getBossInkHullGeometry(id);
      expect(hullGeometry.index).not.toBeNull();
      expect(hullGeometry.getAttribute('normal')).toBeDefined();
      const tail = box(getBossTailGeometry(id)).expandByScalar(-0.001);
      expect(box(getBossTailInkGeometry(id)).containsBox(tail)).toBe(true);
    });
  });
});
