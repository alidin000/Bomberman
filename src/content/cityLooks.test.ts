import * as THREE from 'three';
import { STAGE_DEFINITIONS } from './stages';
import {
  CITY_LOOKS, CityLookId, StageLook, getLook, getStageLook, stageSkyBackground,
} from './stageLooks';

// The lights every stage used before stage looks (stageLooks.test.ts).
const BASELINE: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'> = {
  ambient: { color: '#ffffff', intensity: 0.55 },
  hemisphere: { sky: '#fff3da', ground: '#526773', intensity: 0.85 },
  directional: { color: '#fff0d3', intensity: 1.7 },
};
const KEY_LIGHT = new THREE.Vector3(-8, 15, 9).normalize();
const MASONRY_TOP = 1.22;

function topIrradiance(look: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'>) {
  const ambient = new THREE.Color(look.ambient.color).multiplyScalar(look.ambient.intensity);
  const hemi = new THREE.Color(look.hemisphere.sky).multiplyScalar(look.hemisphere.intensity);
  const sun = new THREE.Color(look.directional.color)
    .multiplyScalar(look.directional.intensity * Math.max(0, KEY_LIGHT.y));
  return ambient.add(hemi).add(sun);
}

const luminance = (color: THREE.Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function boardContrast(look: StageLook, lights: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'>) {
  const light = topIrradiance(lights);
  const ground = luminance(new THREE.Color(look.palette.groundA).multiply(light));
  const wall = luminance(new THREE.Color(look.palette.wall).multiply(light)) * MASONRY_TOP;
  const crate = luminance(new THREE.Color(look.palette.crate).multiply(light)) * MASONRY_TOP;
  return { wall: contrast(wall, ground), crate: contrast(crate, ground), light: luminance(light) };
}

const CITY_IDS = Object.keys(CITY_LOOKS) as CityLookId[];
const signature = (look: StageLook) => [
  look.sky.top, look.fog.color, look.hemisphere.sky, look.hemisphere.ground, look.directional.color,
].join('|');

describe('city looks', () => {
  it('gives Rome, Barcelona and Budapest their own sky, fog, lights, palette and skyline', () => {
    const villages = STAGE_DEFINITIONS.map((stage) => getStageLook(stage.id));
    const cities = CITY_IDS.map((id) => getLook(id));
    cities.forEach((look, index) => {
      expect(look.lookId).toBe(CITY_IDS[index]);
      // A city is no stage.
      expect(look.stageId).toBeUndefined();
      expect(look.accent).toBe(look.palette.accent);
      expect(look.mask).toBeDefined();
      expect(look.fog.range).toBeGreaterThan(0);
      // One famous place; the city's outskirts replace the filler props.
      expect(look.landmarks.filter((set) => set.anchor)).toHaveLength(1);
      expect(look.landmarks.filter((set) => (
        ['terraceBlock', 'quarryStep', 'dockPier'].includes(set.kind)
      ))).toEqual([]);
    });
    const all = [...villages, ...cities];
    expect(new Set(all.map(signature)).size).toBe(all.length);
    expect(new Set(all.map(stageSkyBackground)).size).toBe(all.length);
    expect(new Set(all.map((look) => JSON.stringify(look.palette))).size).toBe(all.length);
  });

  it('lights a city without dimming the board or flattening its contrast', () => {
    CITY_IDS.forEach((id) => {
      const look = getLook(id);
      const before = boardContrast(look, BASELINE);
      const after = boardContrast(look, look);
      expect(after.light / before.light).toBeGreaterThan(0.85);
      expect(after.light / before.light).toBeLessThan(1.12);
      expect(after.wall).toBeGreaterThanOrEqual(before.wall * 0.97);
      expect(after.crate).toBeGreaterThanOrEqual(before.crate * 0.97);
    });
  });
});

describe('village looks under look ids', () => {
  it('keys each village look by its stage id and shares its stage palette, so nothing redraws', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const look = getStageLook(stage.id);
      expect(look.lookId).toBe(stage.id);
      expect(look.stageId).toBe(stage.id);
      // The very same palette object: high contrast's cache and the wall
      // styles keyed on it see what they always saw.
      expect(look.palette).toBe(stage.palette);
      expect(look.mask).toBeUndefined();
      expect(getLook(stage.id)).toBe(look);
    });
  });
});
