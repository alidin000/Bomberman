import * as THREE from 'three';
import { STAGE_DEFINITIONS } from './stages';
import { StageLook, getStageLook, stageSkyBackground } from './stageLooks';

// The lights every stage used before stage looks, and where the key light sits.
const BASELINE: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'> = {
  ambient: { color: '#ffffff', intensity: 0.55 },
  hemisphere: { sky: '#fff3da', ground: '#526773', intensity: 0.85 },
  directional: { color: '#fff0d3', intensity: 1.7 },
};
const KEY_LIGHT = new THREE.Vector3(-8, 15, 9).normalize();
const UP = new THREE.Vector3(0, 1, 0);
// StaticTiles brightens wall and crate tops by this vertex shade.
const MASONRY_TOP = 1.22;

// Light reaching an upward face from the three scene lights (linear RGB).
function topIrradiance(look: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'>) {
  const ambient = new THREE.Color(look.ambient.color).multiplyScalar(look.ambient.intensity);
  const hemi = new THREE.Color(look.hemisphere.sky).multiplyScalar(look.hemisphere.intensity);
  const sun = new THREE.Color(look.directional.color)
    .multiplyScalar(look.directional.intensity * Math.max(0, UP.dot(KEY_LIGHT)));
  return ambient.add(hemi).add(sun);
}

const luminance = (color: THREE.Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function boardContrast(
  palette: (typeof STAGE_DEFINITIONS)[number]['palette'],
  lights: Pick<StageLook, 'ambient' | 'hemisphere' | 'directional'>
) {
  const light = topIrradiance(lights);
  const ground = luminance(new THREE.Color(palette.groundA).multiply(light));
  const wall = luminance(new THREE.Color(palette.wall).multiply(light)) * MASONRY_TOP;
  const crate = luminance(new THREE.Color(palette.crate).multiply(light)) * MASONRY_TOP;
  return { wall: contrast(wall, ground), crate: contrast(crate, ground), light: luminance(light) };
}

describe('stage looks', () => {
  it('gives every stage its own sky, fog, light colours and landmarks', () => {
    const looks = STAGE_DEFINITIONS.map((stage) => getStageLook(stage.id));
    looks.forEach((look, index) => {
      const stage = STAGE_DEFINITIONS[index];
      expect(look.stageId).toBe(stage.id);
      // The palette accent finally reaches the scene, through the landmarks.
      expect(look.accent).toBe(stage.palette.accent);
      expect(look.landmarks.some((set) => set.sector === 'far')).toBe(true);
      expect(look.landmarks.some((set) => set.sector === 'side')).toBe(true);
      expect(look.fog.range).toBeGreaterThan(0);
    });
    const signature = (look: StageLook) => [
      look.sky.top,
      look.fog.color,
      look.hemisphere.sky,
      look.hemisphere.ground,
      look.directional.color,
    ].join('|');
    expect(new Set(looks.map(signature)).size).toBe(STAGE_DEFINITIONS.length);
    expect(new Set(looks.map(stageSkyBackground)).size).toBe(STAGE_DEFINITIONS.length);
    expect(new Set(looks.flatMap((look) => look.landmarks.map((set) => set.kind))).size)
      .toBe(looks.reduce((total, look) => total + look.landmarks.length, 0));
  });

  it('recolours the lights without dimming the board or flattening its contrast', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const look = getStageLook(stage.id);
      const before = boardContrast(stage.palette, BASELINE);
      const after = boardContrast(stage.palette, look);
      expect(after.light / before.light).toBeGreaterThan(0.85);
      expect(after.light / before.light).toBeLessThan(1.12);
      expect(after.wall).toBeGreaterThanOrEqual(before.wall * 0.97);
      expect(after.crate).toBeGreaterThanOrEqual(before.crate * 0.97);
    });
  });

  it('falls back to the default stage for unknown ids', () => {
    expect(getStageLook('nowhere').stageId).toBe(STAGE_DEFINITIONS[0].id);
  });
});
