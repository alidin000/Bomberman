// Shapes for the 2D cast portraits (CastPortrait.tsx): an anime-style bust
// in a 120x140 box, head centred on x 60 (crown y 24, chin y 97, eyes on
// y 63). Each CastLook preset (animeCast.ts) maps to path data here. All of
// it is drawn by the game; nothing is traced from the show's art.
import type { HairStyle, OutfitStyle } from '../../content/animeCast';

export const PORTRAIT_BOX = { width: 120, height: 140 } as const;

/** Mirrors a path across the portrait's centre line (x -> 120 - x). */
export function mirror(d: string): string {
  // Absolute commands only (M L C Q Z); every other number is x then y.
  let index = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (value) => {
    const isX = index % 2 === 0;
    index += 1;
    return isX ? String(120 - Number(value)) : value;
  });
}

function point(cx: number, cy: number, radius: number, degrees: number): string {
  const radians = (degrees * Math.PI) / 180;
  return `${(cx + Math.cos(radians) * radius).toFixed(1)} ${(cy + Math.sin(radians) * radius).toFixed(1)}`;
}

/**
 * A fan of hair spikes round (cx, cy): tips at the given angles (degrees,
 * 0 = right, -90 = up) and radii, valleys between them at `valley`.
 */
export function spikes(
  cx: number,
  cy: number,
  valley: number,
  tips: readonly (readonly [number, number])[]
): string {
  const parts: string[] = [];
  tips.forEach(([angle, radius], index) => {
    const prev = index === 0 ? angle - (tips[1][0] - angle) / 2 : (tips[index - 1][0] + angle) / 2;
    parts.push(`${index === 0 ? 'M' : 'L'}${point(cx, cy, valley, prev)}`);
    parts.push(`L${point(cx, cy, radius, angle)}`);
  });
  const last = tips[tips.length - 1][0];
  const next = last + (last - tips[tips.length - 2][0]) / 2;
  parts.push(`L${point(cx, cy, valley, next)}`, 'Z');
  return parts.join(' ');
}

/** Evenly spread tips from `from` to `to` degrees, all at `radius`. */
export function fan(
  from: number,
  to: number,
  count: number,
  radius: number | ((i: number) => number)
) {
  return Array.from({ length: count }, (_, i) => {
    const angle = from + ((to - from) * i) / (count - 1);
    return [angle, typeof radius === 'number' ? radius : radius(i)] as const;
  });
}

export const FACE = 'M36 54 C36 34 46 24 60 24 C74 24 84 34 84 54 C84 66 81 77 74 86 C69 92 64 96 60 97 C56 96 51 92 46 86 C39 77 36 66 36 54 Z';
// The cel shadow on the face's right side and under the chin.
export const FACE_SHADE = 'M84 54 C84 66 81 77 74 86 C69 92 64 96 60 97 C66 90 72 80 75 66 C77 58 80 54 84 54 Z';
export const NECK = 'M51 86 L51 112 L69 112 L69 86 Z';
export const NECK_SHADE = 'M51 90 Q60 101 69 90 L69 98 Q60 106 51 98 Z';
export const SHOULDERS = 'M6 140 C8 122 22 112 44 108 L76 108 C98 112 112 122 114 140 Z';

// Left eye (the viewer's left); the right one is its mirror.
export const EYE_WHITE = 'M41 63 Q44 57.5 50 58 Q55 58.5 57.5 62 Q54.5 67.6 49 67.6 Q44 67.2 41 63 Z';
export const EYE_LASH = 'M39.6 62.6 Q43.6 56.4 50 56.8 Q56 57.2 58.6 61.6';
export const EYE_LOWER = 'M43.5 66.4 Q49.5 68.8 55.5 66';
export const BROW = 'M41 53.6 Q48.5 50.6 56.5 53.2';
export const EYE_CENTRE = { x: 49.4, y: 62.8 } as const;
export const NOSE = 'M60.4 71.5 L58.6 77 L61 77.6';
export const MOUTH = 'M55.5 85.2 Q60 87.4 64.5 85.2';

// Smooth hair over the skull, with the hairline at y 35-42.
const CAP = 'M33 60 C30 34 42 18 60 18 C78 18 90 34 87 60 C85 52 83 46 80 42 C72 36 66 35 60 35 C54 35 48 36 40 42 C37 46 35 52 33 60 Z';
const CROP = 'M34 56 C32 34 44 20 60 20 C76 20 88 34 86 56 C84 48 82 44 78 41 C72 38 66 37 60 37 C54 37 48 38 42 41 C38 44 36 48 34 56 Z';
const HOOD_RIM = 'M33 64 C31 36 44 22 60 22 C76 22 89 36 87 64 C85 50 80 41 74 37 C68 33 52 33 46 37 C40 41 35 50 33 64 Z';
const SIDE_LOCK = 'M36 42 C33 58 35 76 40 90 L44 70 L42 46 Z';
const LONG_SIDE_LOCK = 'M35 44 C33 60 35 76 40 88 L42 70 L44 50 Z';

// Kanji marks drawn as strokes in a 10x10 box (so no font is needed):
// Gaara's 愛, the Tsuchikage's 土, Jiraiya's 油.
export const KANJI = {
  love: 'M3 1 L4 2 M5 0.6 L5 2 M7 1 L6 2 M1.5 3.6 L1.5 2.8 L8.5 2.8 L8.5 3.6 M3 4.6 L2.2 6 M4.4 4.4 L5.4 6.4 M7 4.6 L7.8 5.6 M3.2 7 L7.6 7 L4 9.6 M4.6 7.8 L8.6 9.6',
  earth: 'M2 4.5 L8 4.5 M5 1 L5 9 M1 9 L9 9',
  oil: 'M1.5 2 L2.5 3 M1 5 L2 6 M1 9.5 L2.5 7.5 M4 3 L9 3 L9 9.5 L4 9.5 Z M4 6.2 L9 6.2 M6.5 0.6 L6.5 9.5',
} as const;

export interface HairShapes {
  // Behind the head and shoulders.
  back?: string[];
  // Over the skull.
  cap?: string;
  // Bangs over the forehead and locks framing the face.
  front?: string[];
  // Thin lines in the hair colour's shade (parts, ties).
  lines?: string[];
}

const both = (d: string) => [d, mirror(d)];

export const HAIR_SHAPES: Record<HairStyle, HairShapes> = {
  spikyShort: {
    back: [spikes(60, 47, 30, fan(-205, 25, 11, (i) => (i % 2 ? 43 : 47)))],
    cap: CAP,
    front: ['M37 46 L41 57 L46 44 L51 58 L56 45 L61 59 L66 45 L71 57 L76 44 L80 55 L84 46 L82 38 L38 38 Z'],
  },
  spikyBack: {
    back: [spikes(63, 45, 28, [
      [-165, 38], [-140, 44], [-115, 47], [-90, 47], [-64, 50], [-40, 52], [-18, 50], [4, 42],
    ])],
    cap: CAP,
    front: [...both(SIDE_LOCK), 'M43 39 L47 55 L53 42 L58 57 L62 42 L67 54 L74 40 Z'],
  },
  messyShort: {
    back: [spikes(60, 47, 28, fan(-200, 20, 12, (i) => (i % 2 ? 36 : 40)))],
    cap: CAP,
    front: ['M37 44 L40 57 L45 44 L49 56 L53 43 L57 53 L61 41 L66 47 L73 39 L82 45 L82 38 L38 38 Z'],
  },
  spikyLongBangs: {
    back: [spikes(60, 48, 30, fan(-212, 32, 12, (i) => (i % 2 ? 44 : 49)))],
    cap: CAP,
    front: [...both(LONG_SIDE_LOCK), 'M41 40 L45 54 L51 42 L56 56 L61 42 L66 55 L72 41 L77 52 L80 40 Z'],
  },
  lowPonytail: {
    back: ['M72 90 Q88 100 84 128 L77 126 Q79 106 68 96 Z'],
    cap: CAP,
    front: [...both(SIDE_LOCK), 'M60 35 Q50 39 43 48 L41 41 Q50 35 60 34 Z', mirror('M60 35 Q50 39 43 48 L41 41 Q50 35 60 34 Z')],
    lines: ['M60 19 L60 35'],
  },
  halfUpLongBang: {
    back: [
      'M34 50 C27 80 25 110 29 134 L50 130 L46 92 Z',
      'M86 50 C93 80 95 110 91 134 L70 130 L74 92 Z',
      'M54 19 Q42 2 30 8 Q44 10 50 22 Z',
    ],
    cap: CAP,
    front: [
      'M57 34 C68 35 82 41 86 57 C88 70 85 82 80 92 C77 80 72 73 63 70 C66 60 62 48 57 40 Z',
      'M38 41 L42 53 L48 41 L53 50 L57 38 Z',
    ],
    lines: ['M52 20 Q56 15 60 20'],
  },
  gravitySilver: {
    back: [spikes(64, 42, 26, [
      [-160, 34], [-140, 41], [-118, 47], [-96, 52], [-74, 56], [-52, 58], [-30, 54], [-10, 44],
      [10, 34],
    ])],
    cap: CAP,
    front: ['M39 43 L44 52 L50 43 L56 52 L62 42 L68 50 L75 41 L81 47 L82 38 L38 38 Z'],
  },
  shortBob: {
    back: ['M32 52 C30 30 44 18 60 18 C76 18 90 30 88 52 C88 70 89 84 85 94 L75 94 L76 60 L44 60 L45 94 L35 94 C31 84 32 70 32 52 Z'],
    cap: CAP,
    front: [
      ...both('M35 46 C33 62 35 78 40 90 L43 68 L41 48 Z'),
      'M39 43 C46 39 56 40 63 45 C55 46 48 51 44 59 C42 52 40 48 39 43 Z',
    ],
  },
  fourPonytails: {
    back: [
      spikes(35, 31, 7, fan(-235, -125, 5, (i) => (i % 2 ? 13 : 17))),
      spikes(85, 31, 7, fan(55, -55, 5, (i) => (i % 2 ? 13 : 17))),
      spikes(31, 62, 7, fan(130, 230, 5, (i) => (i % 2 ? 12 : 16))),
      spikes(89, 62, 7, fan(-50, 50, 5, (i) => (i % 2 ? 12 : 16))),
    ],
    cap: CAP,
    front: ['M37 45 L41 55 L47 42 L52 51 L56 40 L62 49 L66 40 L72 51 L78 42 L83 53 L83 38 L37 38 Z'],
  },
  bun: {
    back: ['M50 17 A10 10 0 1 1 70 17 A10 10 0 1 1 50 17 Z'],
    cap: CAP,
    front: both('M35 46 C33 56 35 66 38 72 L41 52 Z'),
    lines: ['M51 24 Q60 20 69 24'],
  },
  longFlowing: {
    back: [
      'M32 48 C24 80 22 116 26 140 L52 140 L46 96 Z',
      'M88 48 C96 80 98 116 94 140 L68 140 L74 96 Z',
      'M50 19 C40 5 54 -1 58 14 Z',
      'M70 19 C80 5 66 -1 62 14 Z',
    ],
    cap: CAP,
    front: [
      'M63 34 C52 36 40 42 36 58 C34 70 38 82 42 92 C44 79 50 72 57 70 C54 60 58 46 63 40 Z',
      'M62 36 Q71 46 77 61 L80 59 Q73 44 65 34 Z',
    ],
  },
  shortSpiky: {
    back: [spikes(60, 46, 29, fan(-185, 5, 9, (i) => (i % 2 ? 36 : 39)))],
    cap: CAP,
    front: ['M38 43 L43 53 L49 42 L55 52 L61 41 L67 51 L73 42 L79 50 L83 41 L82 38 L38 38 Z'],
  },
  shortCrop: {
    cap: CROP,
    front: ['M42 39 C48 44 54 44 59 40 C63 44 71 46 78 39 L78 36 L42 36 Z'],
  },
  sweptBack: {
    cap: CROP,
    front: ['M46 30 C62 29 81 36 86 52 C88 62 85 70 80 75 C76 67 70 62 62 60 C66 50 58 40 46 36 Z'],
  },
  bald: {
    front: [
      ...both('M33.5 55 C30.5 48 34 43 38.5 45.5 C36.5 49.5 36.5 54 36.5 59 Z'),
      'M56 25 A4 4 0 1 1 64 25 A4 4 0 1 1 56 25 Z',
    ],
  },
  highPonytail: {
    back: [spikes(60, 17, 6, fan(-170, -10, 9, (i) => (i % 2 ? 15 : 20)))],
    cap: CROP,
    lines: ['M55 20 L65 20'],
  },
  twinTails: {
    back: both('M36 78 C25 96 23 120 29 140 L42 140 C38 120 40 100 45 86 Z'),
    cap: CAP,
    front: both('M60 34 C52 38 44 45 40 57 L38 82 L44 73 C44 59 52 47 60 40 Z'),
    lines: ['M60 19 L60 34'],
  },
  longWild: {
    back: [
      spikes(60, 58, 34, fan(-215, 35, 13, (i) => (i % 2 ? 47 : 54))),
      ...both('M34 70 L16 104 L28 99 L20 128 L36 114 L32 140 L50 122 Z'),
    ],
    cap: CAP,
    front: both(SIDE_LOCK),
  },
  hooded: {
    back: [
      'M29 64 C27 32 42 13 60 13 C78 13 93 32 91 64 L93 100 L27 100 Z',
      'M35 28 L39 1 L52 17 Z',
      'M85 28 L81 1 L68 17 Z',
    ],
    cap: HOOD_RIM,
  },
  longStraight: {
    back: both('M32 50 C28 80 28 110 30 136 L50 136 L46 90 Z'),
    cap: CAP,
    front: [...both(SIDE_LOCK), ...both('M60 35 Q50 40 44 51 L43 40 Q51 35 60 34 Z')],
    lines: ['M60 19 L60 35'],
  },
  none: {},
};

export interface OutfitShapes {
  // The torso's base colour: 'primary', 'secondary' or 'skin' (sleeveless).
  base: 'primary' | 'secondary' | 'skin';
  // Filled parts, each in a named colour.
  parts: { d: string; fill: 'primary' | 'secondary' | 'trim' | 'skin' | 'shade' }[];
  // Ink lines in the trim colour (else dark ink).
  lines?: { d: string; trim?: boolean; width?: number }[];
  // Hides the neck (high collars).
  highCollar?: boolean;
}

const V_NECK = 'M48 106 L60 128 L72 106 Z';
const ROLL_COLLAR = 'M39 105 Q60 117 81 105 Q84 112 79 117 Q60 127 41 117 Q36 112 39 105 Z';

export const OUTFIT_SHAPES: Record<OutfitStyle, OutfitShapes> = {
  tracksuit: {
    base: 'primary',
    parts: [
      { d: 'M12 128 C16 116 28 110 44 108 L76 108 C92 110 104 116 108 128 C92 122 78 120 60 120 C42 120 28 122 12 128 Z', fill: 'secondary' },
      { d: 'M44 99 Q60 106 76 99 L80 115 Q60 122 40 115 Z', fill: 'secondary' },
    ],
    lines: [{ d: 'M60 117 L60 140', width: 1.2, trim: false }],
  },
  openShirt: {
    base: 'primary',
    parts: [
      { d: 'M47 105 L60 132 L73 105 Z', fill: 'skin' },
      { d: 'M41 103 Q60 96 79 103 L77 110 Q60 103 43 110 Z', fill: 'primary' },
    ],
    lines: [{ d: 'M47 105 L60 132 L73 105' }, { d: 'M54 140 Q60 136 66 140', trim: true, width: 3 }],
  },
  longCoat: {
    base: 'primary',
    parts: [
      { d: 'M28 140 L38 114 L55 111 L57 140 Z', fill: 'secondary' },
      { d: 'M92 140 L82 114 L65 111 L63 140 Z', fill: 'secondary' },
      { d: 'M43 98 Q60 107 77 98 L81 114 Q60 122 39 114 Z', fill: 'primary' },
    ],
    highCollar: false,
  },
  flakJacket: {
    base: 'secondary',
    parts: [
      { d: 'M49 95 L71 95 L73 109 L47 109 Z', fill: 'secondary' },
      { d: 'M20 140 C20 126 29 115 42 111 L53 116 L55 140 Z', fill: 'primary' },
      { d: 'M100 140 C100 126 91 115 78 111 L67 116 L65 140 Z', fill: 'primary' },
      { d: ROLL_COLLAR, fill: 'primary' },
    ],
    lines: [
      { d: 'M27 126 L38 126 L38 138 L27 138 Z', width: 1 },
      { d: 'M93 126 L82 126 L82 138 L93 138 Z', width: 1 },
    ],
  },
  akatsukiCloak: {
    base: 'primary',
    parts: [
      { d: 'M36 98 Q38 84 47 82 L48 104 L60 114 L72 104 L73 82 Q82 84 84 98 L88 118 Q60 129 32 118 Z', fill: 'primary' },
      { d: 'M48 86 L48 104 L60 114 L72 104 L72 86 L67 97 L60 103 L53 97 Z', fill: 'secondary' },
    ],
    highCollar: true,
  },
  qipao: {
    base: 'skin',
    parts: [
      { d: 'M28 140 C30 124 38 114 47 110 L73 110 C82 114 90 124 92 140 Z', fill: 'primary' },
      { d: 'M46 102 Q60 107 74 102 L75 111 Q60 116 45 111 Z', fill: 'primary' },
    ],
    lines: [{ d: 'M46 102 Q60 107 74 102', trim: true, width: 1.6 }, { d: 'M60 113 L60 140', trim: true, width: 1.6 }],
  },
  kimonoDress: {
    base: 'primary',
    parts: [{ d: V_NECK, fill: 'skin' }, { d: 'M20 134 L100 134 L102 140 L18 140 Z', fill: 'secondary' }],
    lines: [{ d: 'M46 104 L60 130 L74 104', trim: true, width: 4 }],
  },
  robe: {
    base: 'primary',
    parts: [{ d: V_NECK, fill: 'skin' }],
    lines: [{ d: 'M44 103 L60 132 L76 103', trim: true, width: 6 }],
  },
  longDress: {
    base: 'primary',
    parts: [{ d: 'M49 105 L60 124 L71 105 Z', fill: 'secondary' }],
    lines: [
      { d: 'M52 108 L60 116 L68 108 M54 113 L60 119 L66 113', trim: false, width: 0.7 },
      { d: 'M47 104 L60 126 L73 104', width: 1.4 },
    ],
  },
  tunic: {
    base: 'primary',
    parts: [{ d: 'M47 105 Q60 116 73 105 L72 108 Q60 119 48 108 Z', fill: 'secondary' }],
  },
  cropTop: {
    base: 'primary',
    parts: [{ d: 'M45 99 Q60 105 75 99 L77 112 Q60 118 43 112 Z', fill: 'primary' }],
    lines: [{ d: 'M45 99 Q60 105 75 99 M43 112 Q60 118 77 112', trim: true, width: 1.4 }],
  },
  haori: {
    base: 'secondary',
    parts: [
      { d: V_NECK, fill: 'skin' },
      { d: 'M6 140 C8 122 22 112 44 108 L50 108 L45 140 Z', fill: 'primary' },
      { d: 'M114 140 C112 122 98 112 76 108 L70 108 L75 140 Z', fill: 'primary' },
    ],
  },
  sageVest: {
    base: 'secondary',
    parts: [
      { d: V_NECK, fill: 'skin' },
      { d: 'M14 140 C16 124 26 114 42 110 L52 112 L50 140 Z', fill: 'primary' },
      { d: 'M106 140 C104 124 94 114 78 110 L68 112 L70 140 Z', fill: 'primary' },
    ],
  },
  bodysuit: {
    base: 'primary',
    parts: [
      { d: 'M48 96 L72 96 L74 110 L46 110 Z', fill: 'primary' },
      { d: 'M78 108 L88 112 L42 140 L30 140 Z', fill: 'secondary' },
    ],
  },
  plant: {
    base: 'primary',
    parts: [],
  },
};
