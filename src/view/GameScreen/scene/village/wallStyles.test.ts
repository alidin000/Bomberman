import { STAGE_DEFINITIONS } from '../../../../content/stages';
import { highContrastPalette } from '../highContrast';
import { STAGE_WALL_STYLE, wallStyleForPalette } from '../staticTiles';
import { wallShape } from '../StaticTiles';
import { VILLAGE_SYMBOLS, VillageSymbolId } from '../../../../content/villageSymbols';
import { parsePathData, symbolMarks } from './glyphs';

// Each village builds its walls its own way (staticTiles.ts WallStyle), on
// the walls' one material, inside the same footprint so a wall still reads
// as a wall; and the village marks drawn on banners parse from the shared
// symbol data whatever path commands it uses.

describe('village walls', () => {
  it('gives every village its own wall shape, in high contrast too', () => {
    const shapes = new Set<unknown>();
    STAGE_DEFINITIONS.forEach((stage) => {
      const style = STAGE_WALL_STYLE[stage.id];
      expect(wallStyleForPalette(stage.palette)).toBe(style);
      expect(wallStyleForPalette(highContrastPalette(stage.palette))).toBe(style);
      shapes.add(wallShape(style).geometry);
    });
    expect(shapes.size).toBe(STAGE_DEFINITIONS.length);
    expect(wallStyleForPalette({
      groundA: '#000000', groundB: '#000000', wall: '#000000', crate: '#000000', accent: '#000000',
    })).toBe('masonry');
  });

  it('keeps every wall shape inside a cell and a wall\'s height, ready for one draw', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const { geometry, vertexColors } = wallShape(STAGE_WALL_STYLE[stage.id]);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(vertexColors).toBe(true);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.5);
      expect(box.max.y).toBeGreaterThan(0.85);
      expect(box.max.y).toBeLessThanOrEqual(1.05);
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    });
  });
});

describe('village marks', () => {
  it('reads curves, arcs and relative commands into polylines', () => {
    const [arc] = parsePathData('M10 50 A40 40 0 0 1 90 50');
    // A half circle through the top: sampled, ends where the path does.
    expect(arc.points.length).toBeGreaterThan(8);
    expect(arc.points[arc.points.length - 1]).toEqual([90, 50]);
    expect(Math.min(...arc.points.map(([, y]) => y))).toBeCloseTo(10, 0);
    const [curve, line] = parsePathData('m10 10 c10 0 20 10 20 20 s10 20 20 20 M0 0 h10 v10 z');
    expect(curve.points[curve.points.length - 1]).toEqual([50, 50]);
    expect(line).toEqual({ points: [[0, 0], [10, 0], [10, 10]], closed: true });
  });

  it('draws every village symbol as marks', () => {
    (Object.keys(VILLAGE_SYMBOLS) as VillageSymbolId[]).forEach((id) => {
      const { strokes, fills } = symbolMarks(id);
      expect({ id, marks: strokes.length + fills.length > 0 }).toEqual({ id, marks: true });
    });
  });
});
