import * as THREE from 'three';
import { CAST, CastId, SQUARE_CAST } from '../../../../content/animeCast';
import { ENEMY_ARCHETYPE_DEFINITIONS, EnemyArchetype } from '../../../../content/enemies';
import { STAGE_DEFINITIONS } from '../../../../content/stages';
import { StageId } from '../../../../content/types';
import { CastCellName, uvInCell } from './castAtlas';
import { castFigureMesh, enemyFigureMesh } from './castGeometry';
import { MAX_MONSTER_LIFT } from '../monsterLooks';
import {
  MONSTER_FEET_Y, MONSTER_FIGURE_SCALE, guardFigureMesh, monsterFigureMesh,
} from '../MonsterFigure';
import { GUARD_CAST, GUARD_FIGURE_SCALE, GUARD_NAMEPLATE_Y } from '../guardLooks';

// The anime cast as 3D figures (content/animeCast.ts): every member is one
// merged, painted body plus one ink hull, built once per look; the paint
// (face, headband plate, cloak prints) is sampled from atlas cells chosen by
// the look's data, and each figure fits the cell and the labels over it.

const IDS = Object.keys(CAST) as CastId[];
const FIGHTERS: CastId[] = ['naruto', 'sasuke', 'gaara', 'minato', 'itachi', 'deidara'];
const ARCHETYPES = Object.keys(ENEMY_ARCHETYPE_DEFINITIONS) as EnemyArchetype[];
const STAGES = STAGE_DEFINITIONS.map((stage) => stage.id as StageId);

function cellsUsed(geometry: THREE.BufferGeometry, cells: CastCellName[]): Set<CastCellName> {
  const uv = geometry.getAttribute('uv');
  const used = new Set<CastCellName>();
  for (let i = 0; i < uv.count; i += 1) {
    cells.forEach((cell) => { if (uvInCell(uv.getX(i), uv.getY(i), cell)) used.add(cell); });
  }
  return used;
}

const PLATES = (['leaf', 'sand', 'mist', 'cloud', 'stone', 'akatsukiCloud', 'alliance'] as const)
  .flatMap((symbol) => [`plate:${symbol}`, `plate:${symbol}:slashed`] as CastCellName[]);

function reach(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position');
  let farthest = 0;
  for (let i = 0; i < positions.count; i += 1) {
    farthest = Math.max(farthest, Math.hypot(positions.getX(i), positions.getZ(i)));
  }
  return farthest;
}

describe('cast figures', () => {
  it('builds every cast member once as one painted body and one ink line', () => {
    IDS.forEach((id) => {
      const figure = castFigureMesh(id);
      expect(castFigureMesh(id)).toBe(figure);
      ['position', 'normal', 'color', 'uv'].forEach((name) => (
        expect({ id, name, has: !!figure.body.getAttribute(name) }).toEqual({ id, name, has: true })
      ));
      expect(figure.ink?.getAttribute('position').count ?? 0).toBeGreaterThan(0);
      // The face is painted from this member's own cell, no one else's.
      const faces = cellsUsed(figure.body, IDS.map((other) => `face:${other}` as CastCellName));
      expect({ id, faces: [...faces] }).toEqual({ id, faces: [`face:${id}`] });
    });
  });

  it('wears each headband\'s village mark on its plate, slashed for the missing-nin', () => {
    IDS.forEach((id) => {
      const { headband } = CAST[id].look;
      const plates = [...cellsUsed(castFigureMesh(id).body, PLATES)];
      let expected: CastCellName[] = [];
      if (headband) {
        expected = [`plate:${headband.symbol}${headband.wear === 'slashed' ? ':slashed' : ''}` as CastCellName];
      }
      expect({ id, plates }).toEqual({ id, plates: expected });
    });
    expect([...cellsUsed(castFigureMesh('itachi').body, PLATES)]).toEqual(['plate:leaf:slashed']);
    expect([...cellsUsed(castFigureMesh('deidara').body, PLATES)]).toEqual(['plate:stone:slashed']);
  });

  it('prints red clouds on every Akatsuki cloak and nowhere else', () => {
    IDS.forEach((id) => {
      const cloak = CAST[id].look.outfit.style === 'akatsukiCloak';
      const clouds = cellsUsed(castFigureMesh(id).body, ['print:cloud']).size > 0;
      expect({ id, clouds }).toEqual({ id, clouds: cloak });
    });
    // Naruto's spiral and Minato's flames are their own prints.
    expect(cellsUsed(castFigureMesh('naruto').body, ['print:spiral']).size).toBe(1);
    expect(cellsUsed(castFigureMesh('minato').body, ['print:flames']).size).toBe(1);
  });

  it('gives every member a silhouette of their own', () => {
    const people = IDS.filter((id) => !(id in ENEMY_ARCHETYPE_DEFINITIONS));
    const shapes = new Set(people.map((id) => {
      const { body } = castFigureMesh(id);
      const size = (body.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
      return `${body.getAttribute('position').count}:${size.toArray().map((v) => v.toFixed(3))}`;
    }));
    expect(shapes.size).toBe(people.length);
    // Enemy kinds keep the head and hand shapes they are told apart by.
    const enemies = new Set(ARCHETYPES.map((archetype) => (
      enemyFigureMesh(archetype).body.getAttribute('position').count
    )));
    expect(enemies.size).toBe(ARCHETYPES.length);
  });

  it('keeps fighters under their tag and inside their cell', () => {
    // The tag chip hangs 0.98 over the body origin (0.55 over the feet) and is 0.39 tall.
    const tagBottom = 0.55 + 0.98 - 0.39 / 2;
    FIGHTERS.forEach((id) => {
      const { body } = castFigureMesh(id);
      const box = body.boundingBox as THREE.Box3;
      expect({ id, under: box.max.y < tagBottom }).toEqual({ id, under: true });
      expect({ id, feet: Math.abs(box.min.y) < 0.01 }).toEqual({ id, feet: true });
      expect({ id, inCell: reach(body) < 0.5 }).toEqual({ id, inCell: true });
    });
  });

  it('keeps enemies and gate guards under their nameplates and inside their cell', () => {
    // MonsterNameplate hangs at 0.95 (guards: GUARD_NAMEPLATE_Y); its bar reaches 0.1 below.
    ARCHETYPES.forEach((archetype) => {
      const box = monsterFigureMesh(archetype).body.boundingBox as THREE.Box3;
      const top = (box.max.y + MONSTER_FEET_Y) * MONSTER_FIGURE_SCALE + MAX_MONSTER_LIFT;
      expect({ archetype, under: top < 0.95 - 0.1 }).toEqual({ archetype, under: true });
      const inCell = reach(monsterFigureMesh(archetype).body) * MONSTER_FIGURE_SCALE < 0.62;
      expect({ archetype, inCell })
        .toEqual({ archetype, inCell: true });
    });
    STAGES.forEach((stage) => {
      const figure = guardFigureMesh(stage);
      const box = figure.body.boundingBox as THREE.Box3;
      const scale = MONSTER_FIGURE_SCALE * GUARD_FIGURE_SCALE;
      const top = (box.max.y + MONSTER_FEET_Y) * scale + MAX_MONSTER_LIFT;
      const under = top < GUARD_NAMEPLATE_Y - 0.1;
      expect({ stage, under })
        .toEqual({ stage, under: true });
      expect({ stage, inCell: reach(figure.body) * scale < 0.7 }).toEqual({ stage, inCell: true });
    });
  });

  it('draws each stage\'s gate guard as its own canon mini-boss, unlike any patrol', () => {
    const guards = STAGES.map((stage) => GUARD_CAST[stage]);
    expect(new Set(guards).size).toBe(STAGES.length);
    const patrols = new Set(ARCHETYPES.map((archetype) => monsterFigureMesh(archetype).body));
    STAGES.forEach((stage) => {
      const { body } = guardFigureMesh(stage);
      expect(patrols.has(body)).toBe(false);
      const faces = cellsUsed(body, IDS.map((id) => `face:${id}` as CastCellName));
      expect([...faces]).toEqual([`face:${GUARD_CAST[stage]}`]);
    });
    // The square's people are cast members too, two per village.
    Object.values(SQUARE_CAST).flat().forEach((id) => expect(CAST[id]).toBeDefined());
  });
});
