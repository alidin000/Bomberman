import * as THREE from 'three';
import {
  CAST, CastId, CastLook, CastMember,
} from '../../../../content/animeCast';
import { VILLAGE_SYMBOLS, VillageSymbolId } from '../../../../content/villageSymbols';

/**
 * The cast's painted detail, drawn once by the game into one canvas: every
 * cast member's face (eyes, brows, marks, masks), the headband plates with
 * their village symbols (plain and slashed), and the cloth prints (the
 * Akatsuki cloud, the Uzumaki spiral, Minato's flames, the Haruno circle).
 * Figures sample it through UVs, so all of it costs one texture and no draw
 * call. Nothing here is copied art: it is canvas paths in our own hand.
 *
 * Layout: an 8x8 grid of 128 px cells. The top-left 2x2 block is white, for
 * every plain vertex-coloured part (colour x white = colour, at every mip
 * level a figure is drawn at). Each painted cell keeps a 10% margin in its
 * own background colour, so mip filtering never bleeds a neighbour in.
 */

export const ATLAS_GRID = 8;
const CELL_PX = 128;
const ATLAS_PX = ATLAS_GRID * CELL_PX;
/** The painted area inside a cell, as a fraction of the cell. */
const MARGIN = 0.1;

export type PrintId = 'cloud' | 'spiral' | 'flames' | 'circle';
export type CastCellName =
  | `face:${CastId}`
  | `plate:${VillageSymbolId}`
  | `plate:${VillageSymbolId}:slashed`
  | `print:${PrintId}`;

const PRINTS: PrintId[] = ['cloud', 'spiral', 'flames', 'circle'];
const SYMBOL_IDS = Object.keys(VILLAGE_SYMBOLS) as VillageSymbolId[];
const CAST_IDS = Object.keys(CAST) as CastId[];

/** Fixed cell order: faces, then plates, then prints. */
const CELL_NAMES: CastCellName[] = [
  ...CAST_IDS.map((id) => `face:${id}` as CastCellName),
  ...SYMBOL_IDS.flatMap((symbol) => [
    `plate:${symbol}` as CastCellName, `plate:${symbol}:slashed` as CastCellName,
  ]),
  ...PRINTS.map((print) => `print:${print}` as CastCellName),
];

const WHITE_BLOCK = new Set([0, 1, ATLAS_GRID, ATLAS_GRID + 1]);
const CELL_INDEX = new Map<CastCellName, number>();
{
  let index = 0;
  CELL_NAMES.forEach((name) => {
    while (WHITE_BLOCK.has(index)) index += 1;
    CELL_INDEX.set(name, index);
    index += 1;
  });
  if (index > ATLAS_GRID * ATLAS_GRID) throw new Error('cast atlas is full');
}

export type UvRect = { u0: number; v0: number; u1: number; v1: number };

/** The UV of the white block's centre, for every unpainted part. */
export const WHITE_UV: readonly [number, number] = [1 / ATLAS_GRID, 1 - 1 / ATLAS_GRID];

function cellOrigin(index: number): { cx: number; cy: number } {
  return { cx: index % ATLAS_GRID, cy: Math.floor(index / ATLAS_GRID) };
}

/** The painted (inner) UV rectangle of a cell; the canvas is drawn with flipY. */
export function castCellRect(name: CastCellName): UvRect {
  const index = CELL_INDEX.get(name);
  if (index === undefined) throw new Error(`no atlas cell ${name}`);
  const { cx, cy } = cellOrigin(index);
  const size = 1 / ATLAS_GRID;
  return {
    u0: (cx + MARGIN) * size,
    u1: (cx + 1 - MARGIN) * size,
    v0: 1 - (cy + 1 - MARGIN) * size,
    v1: 1 - (cy + MARGIN) * size,
  };
}

/** Whether a UV falls inside a cell's painted rectangle (tests, debugging). */
export function uvInCell(u: number, v: number, name: CastCellName): boolean {
  const rect = castCellRect(name);
  const eps = 1e-5;
  return u >= rect.u0 - eps && u <= rect.u1 + eps && v >= rect.v0 - eps && v <= rect.v1 + eps;
}

// --- Painting ------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

const FEMININE = new Set<CastId>([
  'sakura', 'temari', 'chiyo', 'mei', 'karui', 'kurotsuchi', 'tsunade', 'konan', 'haku',
]);
type Mood = 'grin' | 'smile' | 'flat' | 'smirk' | 'grim';
const MOOD: Partial<Record<CastId, Mood>> = {
  naruto: 'grin',
  minato: 'smile',
  sakura: 'smile',
  sai: 'smile',
  jiraiya: 'grin',
  deidara: 'smirk',
  temari: 'smirk',
  mei: 'smile',
  sasuke: 'grim',
  itachi: 'flat',
  gaara: 'flat',
  obito: 'flat',
  darui: 'flat',
  omoi: 'flat',
};
const STERN = new Set<CastId>(['sasuke', 'itachi', 'gaara', 'darui', 'kankuro', 'onoki', 'obito', 'rogueGenin']);

/** `hex` lightened or darkened in sRGB, the way it looks. */
function shade(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(
    THREE.MathUtils.clamp((Math.floor(value / 2 ** shift) % 256) * factor, 0, 255)
  );
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/** Runs `draw` in the cell's painted square, units of half its side, y up. */
function inCell(ctx: Ctx, index: number, background: string, draw: () => void): void {
  const { cx, cy } = cellOrigin(index);
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(cx * CELL_PX, cy * CELL_PX, CELL_PX, CELL_PX);
  const half = (CELL_PX * (1 - 2 * MARGIN)) / 2;
  ctx.translate(cx * CELL_PX + CELL_PX / 2, cy * CELL_PX + CELL_PX / 2);
  ctx.scale(half, -half);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.restore();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function stroke(ctx: Ctx, color: string, width: number, path: () => void): void {
  ctx.beginPath();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

const EYE_Y = -0.12;
const EYE_X = 0.37;
const INK = '#1b1640';

function drawIris(ctx: Ctx, look: CastLook, big: boolean): void {
  const rx = big ? 0.095 : 0.085;
  const ry = big ? 0.13 : 0.12;
  const { mark } = look.eyes;
  if (mark === 'sharingan') {
    ellipse(ctx, 0, -0.02, rx, ry, '#c4161c');
    stroke(ctx, '#3b0507', 0.012, () => ctx.ellipse(0, -0.02, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2));
    ellipse(ctx, 0, -0.02, 0.026, 0.034, '#0b0b0b');
    for (let k = 0; k < 3; k += 1) {
      const angle = Math.PI / 2 + (k * Math.PI * 2) / 3;
      const tx = Math.cos(angle) * rx * 0.62;
      const ty = -0.02 + Math.sin(angle) * ry * 0.62;
      ellipse(ctx, tx, ty, 0.02, 0.022, '#0b0b0b');
      stroke(ctx, '#0b0b0b', 0.012, () => {
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(
          tx + Math.cos(angle + 1.4) * 0.03,
          ty + Math.sin(angle + 1.4) * 0.03,
          tx + Math.cos(angle + 2.1) * 0.045,
          ty + Math.sin(angle + 2.1) * 0.045
        );
      });
    }
    return;
  }
  if (mark === 'rinnegan') {
    ellipse(ctx, 0, -0.02, rx, ry, '#b9a6d8');
    [0.75, 0.5, 0.25].forEach((k) => stroke(ctx, '#4b3a6b', 0.012, () => (
      ctx.ellipse(0, -0.02, rx * k, ry * k, 0, 0, Math.PI * 2)
    )));
    ellipse(ctx, 0, -0.02, 0.016, 0.02, '#2a1f3d');
    return;
  }
  if (mark === 'byakugan') {
    ellipse(ctx, 0, -0.02, rx, ry, '#e8e4f2');
    return;
  }
  ellipse(ctx, 0, -0.02, rx, ry, look.eyes.color);
  // Anime irises: darker crown under the lid, a pupil and a lighter rim below.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -0.02, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, 0, 0.09, rx * 1.2, ry * 0.7, shade(look.eyes.color, 0.55));
  ellipse(ctx, 0, -0.1, rx * 0.7, ry * 0.35, shade(look.eyes.color, 1.35));
  ctx.restore();
  ellipse(ctx, 0, -0.01, rx * 0.42, ry * 0.45, '#0e0e14');
}

/** One eye at the origin; `side` is +1 for the viewer's right. */
function drawEye(ctx: Ctx, id: CastId, look: CastLook, side: number): void {
  const female = FEMININE.has(id);
  const stern = STERN.has(id);
  const lazy = id === 'kakashi';
  const small = id === 'onoki' || id === 'chiyo';
  ctx.save();
  ctx.scale(side * 1.16, 1.16);
  if (small) ctx.scale(0.7, 0.55);
  // The white of the eye: rounder for the women, narrower when stern.
  const height = stern ? 0.105 : 0.14;
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.01);
  ctx.quadraticCurveTo(-0.02, height + 0.04, 0.15, stern ? 0.06 : 0.07);
  ctx.quadraticCurveTo(0.12, -0.17, -0.02, -0.16);
  ctx.quadraticCurveTo(-0.13, -0.13, -0.14, 0.01);
  ctx.fillStyle = '#fbfbff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  drawIris(ctx, look, female);
  if (lazy) {
    // Kakashi's heavy lid.
    ctx.fillStyle = look.skin;
    ctx.fillRect(-0.2, -0.02, 0.4, 0.3);
  }
  if (!look.eyes.mark || look.eyes.mark === 'sharingan') {
    ellipse(ctx, -0.035, 0.035, 0.03, 0.03, '#ffffff');
    ellipse(ctx, 0.04, -0.07, 0.014, 0.014, '#ffffff');
  }
  ctx.restore();
  // Upper lash line: the thick stroke that makes the eye read at a distance.
  stroke(ctx, INK, female ? 0.05 : 0.042, () => {
    ctx.moveTo(-0.15, lazy ? -0.02 : 0.0);
    ctx.quadraticCurveTo(-0.02, lazy ? 0.06 : height + 0.045, 0.16, lazy ? 0.02 : 0.07);
    if (female) ctx.lineTo(0.2, 0.1);
  });
  stroke(ctx, INK, 0.018, () => {
    ctx.moveTo(-0.05, -0.155);
    ctx.quadraticCurveTo(0.06, -0.15, 0.12, -0.09);
  });
  ctx.restore();
}

function drawBrow(ctx: Ctx, id: CastId, look: CastLook, side: number): void {
  if (id === 'gaara' || id === 'whiteZetsu' || id === 'blackZetsu') return;
  const stern = STERN.has(id);
  const color = id === 'onoki' || id === 'jiraiya' ? '#f8fafc' : shade(look.hair.color, 0.55);
  ctx.save();
  ctx.scale(side, 1);
  stroke(ctx, color, id === 'onoki' ? 0.07 : 0.035, () => {
    ctx.moveTo(-0.13, stern ? 0.11 : 0.15);
    ctx.quadraticCurveTo(0.02, 0.22, 0.17, stern ? 0.2 : 0.17);
  });
  ctx.restore();
}

function drawMouth(ctx: Ctx, id: CastId): void {
  const mood = MOOD[id] ?? 'flat';
  const lip = '#7a2e2a';
  if (mood === 'grin') {
    ctx.beginPath();
    ctx.moveTo(-0.16, -0.52);
    ctx.quadraticCurveTo(0, -0.74, 0.16, -0.52);
    ctx.closePath();
    ctx.fillStyle = '#5a1a1a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-0.12, -0.56, 0.24, 0.04);
    return;
  }
  stroke(ctx, lip, 0.03, () => {
    if (mood === 'smile') {
      ctx.moveTo(-0.1, -0.53);
      ctx.quadraticCurveTo(0, -0.6, 0.1, -0.53);
    } else if (mood === 'smirk') {
      ctx.moveTo(-0.08, -0.56);
      ctx.quadraticCurveTo(0.04, -0.58, 0.11, -0.51);
    } else if (mood === 'grim') {
      ctx.moveTo(-0.07, -0.55);
      ctx.lineTo(0.07, -0.56);
    } else {
      ctx.moveTo(-0.07, -0.55);
      ctx.quadraticCurveTo(0, -0.57, 0.07, -0.55);
    }
  });
}

// Gaara's forehead mark, brushed as a few strokes (the canvas has no CJK font
// to rely on): a roof, a heart and the walking legs of the character for love.
function drawLoveMark(ctx: Ctx): void {
  ctx.save();
  ctx.translate(0.33, 0.42);
  ctx.scale(0.17, 0.17);
  const red = '#b3201f';
  stroke(ctx, red, 0.16, () => {
    ctx.moveTo(-0.6, 0.9); ctx.lineTo(0.6, 1.0);
    ctx.moveTo(-0.5, 0.65); ctx.lineTo(-0.35, 0.45);
    ctx.moveTo(0, 0.7); ctx.lineTo(0, 0.45);
    ctx.moveTo(0.5, 0.65); ctx.lineTo(0.35, 0.45);
    ctx.moveTo(-0.8, 0.3); ctx.lineTo(-0.8, 0.1); ctx.lineTo(0.8, 0.1); ctx.lineTo(0.8, 0.3);
    ctx.moveTo(-0.5, -0.15); ctx.quadraticCurveTo(-0.3, -0.45, 0.1, -0.4);
    ctx.moveTo(0, -0.05); ctx.lineTo(0.2, -0.25);
    ctx.moveTo(0.5, -0.1); ctx.lineTo(0.65, -0.3);
    ctx.moveTo(-0.6, -0.6); ctx.lineTo(0.7, -0.6);
    ctx.moveTo(0.1, -0.6); ctx.lineTo(-0.5, -1.0);
    ctx.moveTo(0.1, -0.7); ctx.lineTo(0.7, -1.0);
  });
  ctx.restore();
}

function drawMask(ctx: Ctx, base: string, draw: () => void): void {
  ctx.beginPath();
  ctx.ellipse(0, -0.05, 0.84, 0.86, 0, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();
  draw();
}

function drawMaskEyeHole(ctx: Ctx, x: number): void {
  ctx.beginPath();
  ctx.ellipse(x, EYE_Y, 0.11, 0.06, x > 0 ? -0.25 : 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d12';
  ctx.fill();
}

function drawFaceMarks(ctx: Ctx, member: CastMember): boolean {
  const { id, look } = member;
  const marks = look.face ?? [];
  let masked = false;
  marks.forEach((mark) => {
    switch (mark) {
      case 'whiskers':
        [-1, 1].forEach((side) => [0, 1, 2].forEach((row) => stroke(ctx, '#3a2a22', 0.022, () => {
          const y = -0.28 - row * 0.09;
          ctx.moveTo(side * 0.48, y);
          ctx.lineTo(side * 0.74, y + 0.02 - row * 0.03);
        })));
        break;
      case 'loveKanji':
        drawLoveMark(ctx);
        break;
      case 'tearTroughs':
        [-1, 1].forEach((side) => stroke(ctx, id === 'gaara' ? '#2a2033' : '#6b4a46', id === 'gaara' ? 0.03 : 0.02, () => {
          ctx.moveTo(side * 0.27, EYE_Y - 0.17);
          ctx.quadraticCurveTo(side * 0.3, EYE_Y - 0.27, side * 0.34, EYE_Y - 0.33);
        }));
        if (id === 'gaara') {
          // The insomniac's dark rings, all round each eye.
          [-1, 1].forEach((side) => stroke(ctx, '#1a1420', 0.045, () => (
            ctx.ellipse(side * EYE_X, EYE_Y - 0.005, 0.165, 0.15, 0, 0, Math.PI * 2)
          )));
        }
        break;
      case 'mask':
        // Kakashi's cloth mask, from the bridge of the nose down.
        ctx.beginPath();
        ctx.moveTo(-1, -0.27);
        ctx.quadraticCurveTo(-0.3, -0.2, 0, -0.22);
        ctx.quadraticCurveTo(0.3, -0.2, 1, -0.27);
        ctx.lineTo(1, -1);
        ctx.lineTo(-1, -1);
        ctx.closePath();
        ctx.fillStyle = '#2b3554';
        ctx.fill();
        stroke(ctx, '#1d2540', 0.02, () => {
          ctx.moveTo(0, -0.22);
          ctx.lineTo(0.03, -0.4);
        });
        break;
      case 'eyeScar':
        stroke(ctx, '#8a4b44', 0.025, () => {
          ctx.moveTo(EYE_X - 0.02, 0.12);
          ctx.lineTo(EYE_X + 0.03, -0.32);
        });
        break;
      case 'noseScar':
        stroke(ctx, '#9a5b4a', 0.03, () => {
          ctx.moveTo(-0.3, -0.3);
          ctx.lineTo(0.3, -0.3);
        });
        break;
      case 'kabuki':
        ctx.fillStyle = '#6b3fa0';
        [-1, 1].forEach((side) => {
          ctx.beginPath();
          ctx.moveTo(side * 0.1, 0.2);
          ctx.lineTo(side * 0.6, 0.0);
          ctx.lineTo(side * 0.62, -0.08);
          ctx.lineTo(side * 0.12, 0.1);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(side * 0.5, -0.25);
          ctx.lineTo(side * 0.25, -0.65);
          ctx.lineTo(side * 0.32, -0.66);
          ctx.lineTo(side * 0.58, -0.3);
          ctx.closePath();
          ctx.fill();
        });
        ctx.fillRect(-0.05, -0.75, 0.1, 0.12);
        break;
      case 'diamondSeal':
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(0.06, 0.4);
        ctx.lineTo(0, 0.3);
        ctx.lineTo(-0.06, 0.4);
        ctx.closePath();
        ctx.fillStyle = '#7c3aed';
        ctx.fill();
        break;
      case 'redLines':
        [-1, 1].forEach((side) => stroke(ctx, '#c4161c', 0.035, () => {
          ctx.moveTo(side * 0.27, EYE_Y - 0.15);
          ctx.quadraticCurveTo(side * 0.33, -0.45, side * 0.3, -0.72);
        }));
        break;
      case 'beard':
        ctx.beginPath();
        ctx.moveTo(-0.45, -0.42);
        ctx.quadraticCurveTo(0, -0.3, 0.45, -0.42);
        ctx.quadraticCurveTo(0.3, -1.0, 0, -1.05);
        ctx.quadraticCurveTo(-0.3, -1.0, -0.45, -0.42);
        ctx.fillStyle = '#f2f2f2';
        ctx.fill();
        // A broad nose over the moustache.
        ellipse(ctx, 0, -0.3, 0.13, 0.1, '#e09a7a');
        break;
      case 'porcelainMask':
        masked = true;
        drawMask(ctx, '#f4f1ea', () => {
          [-EYE_X, EYE_X].forEach((x) => drawMaskEyeHole(ctx, x));
          if (id === 'haku') {
            // The hunter-nin mask: a mist mark over two thin red lines.
            stroke(ctx, '#7a8a9a', 0.03, () => {
              [-0.12, 0, 0.12].forEach((x) => {
                ctx.moveTo(x - 0.06, 0.48);
                ctx.lineTo(x + 0.06, 0.56);
              });
            });
            [-1, 1].forEach((side) => stroke(ctx, '#c4161c', 0.025, () => {
              ctx.moveTo(side * EYE_X, EYE_Y + 0.1);
              ctx.lineTo(side * EYE_X, EYE_Y + 0.3);
            }));
          } else {
            // ANBU: an animal mask with red stripes.
            [-1, 1].forEach((side) => {
              stroke(ctx, '#c4161c', 0.045, () => {
                ctx.moveTo(side * 0.2, 0.45);
                ctx.quadraticCurveTo(side * 0.45, 0.25, side * 0.55, 0.05);
              });
              stroke(ctx, '#c4161c', 0.03, () => {
                ctx.moveTo(side * 0.5, -0.3);
                ctx.lineTo(side * 0.2, -0.5);
              });
            });
            ellipse(ctx, 0, -0.42, 0.05, 0.04, '#2b2b2b');
          }
        });
        break;
      case 'spiralMask':
        masked = true;
        drawMask(ctx, '#f0ede6', () => {
          // The war mask: ripples round both eye holes.
          [-EYE_X, EYE_X].forEach((x) => [0.18, 0.28, 0.38].forEach((r) => stroke(ctx, '#8d8a96', 0.025, () => (
            ctx.ellipse(x, EYE_Y, r, r * 0.9, 0, 0, Math.PI * 2)
          ))));
          [-EYE_X, EYE_X].forEach((x, index) => {
            drawMaskEyeHole(ctx, x);
            ellipse(ctx, x, EYE_Y, 0.045, 0.045, index === 0 ? '#c4161c' : '#b9a6d8');
          });
        });
        break;
      case 'halfBlack':
      default:
        break;
    }
  });
  return masked;
}

function drawFace(ctx: Ctx, member: CastMember): void {
  const { id, look } = member;
  if (id === 'whiteZetsu' || id === 'blackZetsu') {
    // Zetsu: round eyes without whites, and the white one's wide grin.
    [-1, 1].forEach((side) => ellipse(ctx, side * 0.3, EYE_Y, 0.1, 0.12, look.eyes.color));
    [-1, 1].forEach((side) => ellipse(ctx, side * 0.3, EYE_Y, 0.04, 0.05, '#0b0b0b'));
    if (id === 'whiteZetsu') {
      stroke(ctx, '#3a3a34', 0.035, () => {
        ctx.moveTo(-0.3, -0.48);
        ctx.quadraticCurveTo(0, -0.66, 0.3, -0.48);
      });
    }
    return;
  }
  // Soft cheek blush and a small nose, under everything else.
  [-1, 1].forEach((side) => ellipse(ctx, side * 0.5, -0.36, 0.14, 0.07, shade(look.skin, 0.93)));
  stroke(ctx, shade(look.skin, 0.72), 0.025, () => {
    ctx.moveTo(0.015, -0.27);
    ctx.lineTo(-0.025, -0.34);
  });
  drawMouth(ctx, id);
  const masked = drawFaceMarks(ctx, member);
  if (masked) return;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * EYE_X, EYE_Y);
    // Kakashi's left eye (the viewer's right) is under his headband.
    if (!(id === 'kakashi' && side > 0)) drawEye(ctx, id, look, side);
    ctx.restore();
    ctx.save();
    ctx.translate(side * EYE_X, EYE_Y);
    drawBrow(ctx, id, look, side);
    ctx.restore();
  });
  if (look.accessories?.includes('glasses')) {
    [-1, 1].forEach((side) => stroke(ctx, '#2b2b2b', 0.03, () => (
      ctx.ellipse(side * EYE_X, EYE_Y, 0.2, 0.17, 0, 0, Math.PI * 2)
    )));
    stroke(ctx, '#2b2b2b', 0.03, () => { ctx.moveTo(-0.17, EYE_Y + 0.04); ctx.lineTo(0.17, EYE_Y + 0.04); });
  }
}

/** Plates are about 2.6 times wider than tall on the head: paint squeezed to match. */
export const PLATE_ASPECT = 2.6;

function drawPlate(ctx: Ctx, symbolId: VillageSymbolId, slashed: boolean): void {
  const symbol = VILLAGE_SYMBOLS[symbolId];
  // Brushed steel, a darker rim and the four rivets.
  const gradient = ctx.createLinearGradient(0, 1, 0, -1);
  gradient.addColorStop(0, '#f1f5f9');
  gradient.addColorStop(0.55, '#cbd5e1');
  gradient.addColorStop(1, '#94a3b8');
  ctx.fillStyle = gradient;
  ctx.fillRect(-1.25, -1.25, 2.5, 2.5);
  stroke(ctx, '#64748b', 0.08, () => ctx.rect(-0.97, -0.94, 1.94, 1.88));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => (
    ellipse(ctx, sx * 0.84, sy * 0.68, 0.05, 0.13, '#475569')
  )));
  ctx.save();
  // The symbol's 0-100 box, squeezed across so the plate's stretch undoes it.
  const size = 1.6;
  ctx.scale(1 / PLATE_ASPECT, 1);
  ctx.translate(-size / 2, size / 2);
  ctx.scale(size / 100, -size / 100);
  const engrave = '#334155';
  if (symbol.mode === 'glyph' && symbol.glyph) {
    ctx.fillStyle = engrave;
    ctx.font = '700 80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol.glyph, 50, 54);
  } else if (symbol.d && typeof Path2D !== 'undefined') {
    const path = new Path2D(symbol.d);
    if (symbol.mode === 'fill') {
      ctx.fillStyle = symbol.color;
      ctx.fill(path);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.stroke(path);
    } else {
      // Engraved: a light edge under the dark cut.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 9;
      ctx.translate(1.5, 2);
      ctx.stroke(path);
      ctx.translate(-1.5, -2);
      ctx.strokeStyle = engrave;
      ctx.lineWidth = 7.5;
      ctx.stroke(path);
    }
  }
  ctx.restore();
  if (slashed) {
    // A missing-nin's cut, straight through the mark.
    stroke(ctx, '#f8fafc', 0.12, () => { ctx.moveTo(-0.95, 0.12); ctx.lineTo(0.95, -0.02); });
    stroke(ctx, '#111827', 0.08, () => { ctx.moveTo(-0.95, 0.08); ctx.lineTo(0.95, -0.06); });
  }
}

const CLOAK_BLACK = CAST.itachi.look.outfit.primary;

function drawCloud(ctx: Ctx): void {
  const symbol = VILLAGE_SYMBOLS.akatsukiCloud;
  if (!symbol.d || typeof Path2D === 'undefined') return;
  ctx.save();
  ctx.scale(0.0225, -0.0225);
  ctx.translate(-50, -52);
  const path = new Path2D(symbol.d);
  ctx.strokeStyle = CAST.itachi.look.outfit.trim ?? '#f8fafc';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.fillStyle = CAST.itachi.look.outfit.secondary;
  ctx.fill(path);
  ctx.restore();
}

function drawSpiral(ctx: Ctx): void {
  stroke(ctx, '#c4161c', 0.13, () => {
    for (let step = 0; step <= 60; step += 1) {
      const angle = (step / 60) * Math.PI * 4.2;
      const radius = 0.08 + (step / 60) * 0.72;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  });
}

function drawFlames(ctx: Ctx): void {
  ctx.fillStyle = CAST.minato.look.outfit.trim ?? '#d92d20';
  ctx.fillRect(-1.25, -1.25, 2.5, 0.55);
  [-0.75, -0.25, 0.25, 0.75].forEach((x, index) => {
    const top = index % 2 === 0 ? 0.55 : 0.2;
    ctx.beginPath();
    ctx.moveTo(x - 0.3, -0.75);
    ctx.quadraticCurveTo(x - 0.28, top - 0.4, x + 0.05, top);
    ctx.quadraticCurveTo(x - 0.02, top - 0.45, x + 0.3, -0.75);
    ctx.closePath();
    ctx.fill();
  });
}

function drawCircle(ctx: Ctx): void {
  stroke(ctx, CAST.sakura.look.outfit.trim ?? '#f8fafc', 0.24, () => ctx.arc(0, 0, 0.62, 0, Math.PI * 2));
}

const PRINT_BACKGROUND: Record<PrintId, string> = {
  cloud: CLOAK_BLACK,
  spiral: CAST.naruto.look.outfit.primary,
  flames: CAST.minato.look.outfit.primary,
  circle: CAST.sakura.look.outfit.primary,
};

function paintAtlas(ctx: Ctx): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ATLAS_PX, ATLAS_PX);
  CELL_NAMES.forEach((name) => {
    const index = CELL_INDEX.get(name) as number;
    const [kind, key, variant] = name.split(':');
    if (kind === 'face') {
      const member = CAST[key as CastId];
      inCell(ctx, index, member.look.skin, () => drawFace(ctx, member));
    } else if (kind === 'plate') {
      inCell(ctx, index, '#cbd5e1', () => drawPlate(ctx, key as VillageSymbolId, variant === 'slashed'));
    } else {
      const print = key as PrintId;
      inCell(ctx, index, PRINT_BACKGROUND[print], () => {
        if (print === 'cloud') drawCloud(ctx);
        else if (print === 'spiral') drawSpiral(ctx);
        else if (print === 'flames') drawFlames(ctx);
        else drawCircle(ctx);
      });
    }
  });
}

let atlas: THREE.CanvasTexture | null = null;

/**
 * The atlas texture, painted on first use (the countdown) and kept for the
 * session. Without a 2D canvas (tests) it stays blank white, which still
 * shades every part in its vertex colour.
 */
export function castAtlasTexture(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const context = canvas.getContext('2d');
  try {
    if (context) paintAtlas(context);
  } catch {
    // A partial or stubbed 2D canvas (tests): paint is cosmetic, the
    // figures still shade in their vertex colours.
  }
  atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 2;
  atlas.needsUpdate = true;
  return atlas;
}

/** Background colour of a print cell (decals blend into the cloth they sit on). */
export function printBackground(print: PrintId): string {
  return PRINT_BACKGROUND[print];
}
