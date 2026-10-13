// An anime-style SVG bust of one cast member, drawn from their CastLook
// (animeCast.ts): hair preset, eyes (Sharingan, Rinnegan, Byakugan), face
// marks, headband with its village mark, collar and the accessories that
// show above the shoulders. Used by the story scenes, the square's talk
// overlay and the hub's villager cards. Everything is drawn here.
import React, { memo } from 'react';
import {
  CAST, type Accessory, type CastId, type CastLook,
} from '../../content/animeCast';
import {
  BROW,
  EYE_CENTRE,
  EYE_LASH,
  EYE_LOWER,
  EYE_WHITE,
  FACE,
  FACE_SHADE,
  HAIR_SHAPES,
  KANJI,
  MOUTH,
  NECK,
  NECK_SHADE,
  NOSE,
  OUTFIT_SHAPES,
  PORTRAIT_BOX,
  SHOULDERS,
  mirror,
} from './portraitShapes';
import { VillageMark } from './VillageMark';

const INK = '#17171c';
const METAL = '#cfd5dd';
const MIRROR = `matrix(-1 0 0 1 ${PORTRAIT_BOX.width} 0)`;

/** A hex colour scaled toward black (factor < 1) or white (factor > 1). */
export function shade(hex: string, factor: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const channels = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  const scaled = channels.map((channel) => (factor <= 1
    ? channel * factor
    : channel + (255 - channel) * (factor - 1)));
  return `#${scaled.map((channel) => Math.round(Math.max(0, Math.min(255, channel)))
    .toString(16).padStart(2, '0')).join('')}`;
}

type FaceMarkId = NonNullable<CastLook['face']>[number];
const has = (look: CastLook, accessory: Accessory) => (
  look.accessories?.includes(accessory) ?? false
);
const marked = (look: CastLook, mark: FaceMarkId) => look.face?.includes(mark) ?? false;

// Parts only one character wears, keyed by cast id.
const OIL_HEADBAND: ReadonlySet<CastId> = new Set<CastId>(['jiraiya']);

function Eye({ look, plain }: { look: CastLook; plain: boolean }) {
  const mark = plain ? undefined : look.eyes.mark;
  let iris = look.eyes.color;
  if (mark === 'sharingan') iris = '#c4161c';
  if (mark === 'rinnegan') iris = '#a99bd6';
  if (mark === 'byakugan') iris = '#ece8f4';
  const { x, y } = EYE_CENTRE;
  return (
    <g>
      <path d={EYE_WHITE} fill="#fbfbfd" />
      <ellipse
        cx={x}
        cy={y}
        rx={4.1}
        ry={4.6}
        fill={iris}
        stroke={shade(iris, 0.45)}
        strokeWidth={0.7}
      />
      {mark !== 'rinnegan' && mark !== 'byakugan' && (
        <ellipse cx={x} cy={y + 0.3} rx={1.7} ry={2.3} fill={mark === 'sharingan' ? '#111' : shade(iris, 0.35)} />
      )}
      {mark === 'sharingan' && (
        <g fill="#111">
          <circle cx={x} cy={y} r={2.9} fill="none" stroke="#111" strokeWidth={0.45} />
          {[90, 210, 330].map((angle) => {
            const radians = (angle * Math.PI) / 180;
            const tx = x + Math.cos(radians) * 2.9;
            const ty = y + Math.sin(radians) * 2.9;
            return <circle key={angle} cx={tx} cy={ty} r={0.85} />;
          })}
        </g>
      )}
      {mark === 'rinnegan' && [1.4, 2.6, 3.7].map((radius) => (
        <circle key={radius} cx={x} cy={y} r={radius} fill="none" stroke="#3b2f63" strokeWidth={0.5} />
      ))}
      <circle cx={x - 1.4} cy={y - 1.8} r={1.25} fill="#fff" />
      <path d={EYE_LASH} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <path d={EYE_LOWER} fill="none" stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
      <path d={BROW} fill="none" stroke={shade(look.hair.color, 0.55)} strokeWidth={1.7} strokeLinecap="round" />
    </g>
  );
}

function Headband({ look }: { look: CastLook }) {
  const band = look.headband;
  if (!band || band.wear === 'arm' || band.wear === 'neck' || band.wear === 'strap') return null;
  const plate = (x: number, y: number, w: number, h: number, size: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={1.6} fill={METAL} stroke={INK} strokeWidth={1.1} />
      <VillageMark symbol={band.symbol} x={x + (w - size) / 2} y={y + (h - size) / 2} size={size} />
    </>
  );
  if (band.wear === 'hairband') {
    return (
      <g>
        <path d="M35 50 C37 31 48 25 60 25 C72 25 83 31 85 50" fill="none" stroke={band.cloth} strokeWidth={4.5} />
        {plate(51, 21.5, 18, 7.5, 6.6)}
      </g>
    );
  }
  if (band.wear === 'overEye') {
    return (
      <g>
        <path d="M34 40 Q58 33 86 49 L86 71 Q62 55 34 49 Z" fill={band.cloth} stroke={INK} strokeWidth={1.2} />
        <g transform="rotate(16 54 41)">{plate(43, 36, 22, 9.6, 8.4)}</g>
      </g>
    );
  }
  return (
    <g>
      <path d="M35 41 Q60 31 85 41 L85 49 Q60 40 35 49 Z" fill={band.cloth} stroke={INK} strokeWidth={1.2} />
      {plate(49, 34.6, 22, 9.6, 8.4)}
      {band.wear === 'slashed' && (
        <path d="M51 43.4 L69 35.6" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      )}
    </g>
  );
}

function BodyHeadband({ look }: { look: CastLook }) {
  const band = look.headband;
  if (!band) return null;
  if (band.wear === 'neck') {
    return (
      <g>
        <rect x={50} y={96} width={20} height={6} fill={band.cloth} stroke={INK} strokeWidth={1} />
        <rect
          x={53.5}
          y={95}
          width={13}
          height={8}
          rx={1.4}
          fill={METAL}
          stroke={INK}
          strokeWidth={1}
        />
        <VillageMark symbol={band.symbol} x={56.6} y={95.6} size={6.8} />
      </g>
    );
  }
  if (band.wear === 'arm') {
    return (
      <g>
        <path d="M9 126 L27 119 L30 127 L12 134 Z" fill={band.cloth} stroke={INK} strokeWidth={1} />
        <rect x={14} y={121} width={11} height={7} rx={1.2} fill={METAL} stroke={INK} strokeWidth={0.9} transform="rotate(-20 19 124)" />
        <VillageMark symbol={band.symbol} x={16} y={121} size={6} />
      </g>
    );
  }
  if (band.wear === 'strap') {
    return (
      <g>
        <path d="M86 108 L96 113 L44 140 L30 140 Z" fill={band.cloth} stroke={INK} strokeWidth={1.1} />
        <g transform="rotate(-28 62 126)">
          <rect
            x={55}
            y={122.5}
            width={14}
            height={7}
            rx={1.2}
            fill={METAL}
            stroke={INK}
            strokeWidth={1}
          />
          <VillageMark symbol={band.symbol} x={59} y={123} size={6} />
        </g>
      </g>
    );
  }
  return null;
}

function BackAccessories({ look }: { look: CastLook }) {
  return (
    <g>
      {has(look, 'zetsuLeaves') && [
        'M18 140 C4 100 14 52 44 22 C33 60 33 100 40 140 Z',
        mirror('M18 140 C4 100 14 52 44 22 C33 60 33 100 40 140 Z'),
      ].map((d) => <path key={d} d={d} fill={look.outfit.secondary} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />)}
      {has(look, 'gourd') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <ellipse cx={93} cy={102} rx={15} ry={13} fill="#c99b5e" />
          <ellipse cx={89} cy={86} rx={8} ry={7} fill="#c99b5e" />
          <rect x={85} y={75} width={7} height={5} rx={1} fill="#7a4b2a" />
        </g>
      )}
      {has(look, 'swordBack') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M22 88 L28 85 L40 108 L34 111 Z" fill="#26262c" />
          <path d="M29 104 L41 98 L43 101 L31 107 Z" fill="#9aa3ad" />
        </g>
      )}
      {has(look, 'cleaver') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M86 66 L104 60 L112 104 L94 110 Z" fill="#b9c0c8" />
          <path d="M94 108 L100 106 L104 117 L98 119 Z" fill="#6b4a2f" />
        </g>
      )}
      {has(look, 'wrappedSword') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M86 70 L100 66 L106 112 L92 116 Z" fill="#e7dcc3" />
          <path d="M88 80 L101 76 M89 90 L102 86 M90 100 L104 96" fill="none" />
        </g>
      )}
      {has(look, 'giantFan') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M12 62 L27 56 L37 116 L22 121 Z" fill="#3f3a4a" />
          <circle cx={22} cy={82} r={3.2} fill="#8b5cf6" />
          <circle cx={25.5} cy={97} r={3.2} fill="#8b5cf6" />
        </g>
      )}
      {has(look, 'puppetBundle') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M10 92 Q16 76 34 80 L38 114 L16 118 Z" fill="#e9dcc0" />
          <path d="M14 98 L36 92 M15 108 L37 103" fill="none" />
        </g>
      )}
      {has(look, 'bigScroll') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <rect x={84} y={68} width={21} height={46} rx={8} fill="#e8d6a8" />
          <rect x={84} y={85} width={21} height={8} fill="#b8322b" />
        </g>
      )}
      {has(look, 'scrollBrush') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round" transform="rotate(-18 24 104)">
          <rect x={18} y={90} width={12} height={28} rx={5} fill="#e8d6a8" />
          <path d="M24 90 L24 80" stroke="#6b4a2f" strokeWidth={2} />
        </g>
      )}
      {has(look, 'gunbai') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M92 100 L98 124" stroke="#6b4a2f" strokeWidth={4} />
          <circle cx={95} cy={80} r={19} fill="#d6c7a1" />
          <circle cx={95} cy={80} r={7} fill="none" />
          {[0, 120, 240].map((angle) => (
            <circle
              key={angle}
              cx={95 + Math.cos((angle * Math.PI) / 180) * 12}
              cy={80 + Math.sin((angle * Math.PI) / 180) * 12}
              r={2.2}
              fill={INK}
            />
          ))}
        </g>
      )}
    </g>
  );
}

function Outfit({ look }: { look: CastLook }) {
  const shapes = OUTFIT_SHAPES[look.outfit.style];
  const colour = (name: 'primary' | 'secondary' | 'trim' | 'skin' | 'shade') => {
    if (name === 'skin') return look.skin;
    if (name === 'trim') return look.outfit.trim ?? look.outfit.secondary;
    if (name === 'shade') return shade(look.outfit.primary, 0.7);
    return look.outfit[name];
  };
  const isAkatsuki = look.outfit.style === 'akatsukiCloak';
  return (
    <g strokeLinejoin="round">
      <path d={SHOULDERS} fill={colour(shapes.base)} stroke={INK} strokeWidth={1.5} />
      {shapes.parts.map((part) => (
        <path key={part.d} d={part.d} fill={colour(part.fill)} stroke={INK} strokeWidth={1.2} />
      ))}
      {shapes.lines?.map((item) => (
        <path
          key={item.d}
          d={item.d}
          fill="none"
          stroke={item.trim ? colour('trim') : INK}
          strokeWidth={item.width ?? 1.2}
          strokeLinecap="round"
        />
      ))}
      {isAkatsuki && (
        <>
          <VillageMark symbol="akatsukiCloud" x={6} y={106} size={30} />
          <VillageMark symbol="akatsukiCloud" x={82} y={104} size={30} />
        </>
      )}
      {has(look, 'flameHaori') && [
        'M7 140 L11 131 L15 136 L19 128 L23 136 L27 129 L31 136 L35 130 L39 137 L43 132 L46 140 Z',
        mirror('M7 140 L11 131 L15 136 L19 128 L23 136 L27 129 L31 136 L35 130 L39 137 L43 132 L46 140 Z'),
      ].map((d) => <path key={d} d={d} fill={colour('trim')} stroke={INK} strokeWidth={0.9} />)}
    </g>
  );
}

function FaceMarks({ look }: { look: CastLook }) {
  return (
    <g>
      {marked(look, 'whiskers') && [
        'M38.6 72 L46.6 73.6 M38.2 75.6 L46.6 76 M38.6 79.2 L46.6 78.4',
        mirror('M38.6 72 L46.6 73.6 M38.2 75.6 L46.6 76 M38.6 79.2 L46.6 78.4'),
      ].map((d) => <path key={d} d={d} stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />)}
      {marked(look, 'tearTroughs') && [
        'M45 68.6 Q46.6 72 46 75.6',
        mirror('M45 68.6 Q46.6 72 46 75.6'),
      ].map((d) => <path key={d} d={d} stroke={shade(look.skin, 0.55)} strokeWidth={1} fill="none" strokeLinecap="round" />)}
      {marked(look, 'tearTroughs') && look.headband?.wear === 'strap' && [
        'M40 62 Q42 54 50 54.6 Q57 55 59 61',
        mirror('M40 62 Q42 54 50 54.6 Q57 55 59 61'),
      ].map((d) => <path key={d} d={d} stroke="#1b1b1b" strokeWidth={1.6} opacity={0.75} fill="none" strokeLinecap="round" />)}
      {marked(look, 'loveKanji') && (
        <path d={KANJI.love} transform="translate(67 43) scale(0.8)" fill="none" stroke="#b3201f" strokeWidth={1.4} strokeLinecap="round" />
      )}
      {marked(look, 'noseScar') && <path d="M49 70 L71 70" stroke="#a86a4f" strokeWidth={1.5} fill="none" strokeLinecap="round" />}
      {marked(look, 'eyeScar') && <path d="M70 51 L72.4 77" stroke="#a86a4f" strokeWidth={1.2} fill="none" strokeLinecap="round" />}
      {marked(look, 'kabuki') && (
        <path
          d="M49 49 L49 58 M71 49 L71 58 M49 67 L45 79 M71 67 L75 79 M60 66 L60 76 M54 86.6 L66 86.6"
          stroke="#6b2b8a"
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {marked(look, 'diamondSeal') && <path d="M60 42.6 L62.6 46 L60 49.4 L57.4 46 Z" fill="#7c3aed" />}
      {marked(look, 'redLines') && (
        <path d="M45 68.6 L43.6 83 M75 68.6 L76.4 83" stroke="#c4161c" strokeWidth={1.7} fill="none" strokeLinecap="round" />
      )}
      {marked(look, 'beard') && (
        <g stroke={INK} strokeWidth={1}>
          <path d="M47 86 Q60 112 73 86 Q66 95 60 96 Q54 95 47 86 Z" fill="#f4f4f4" />
          <path d="M51 80 Q56 85 60 81.4 Q64 85 69 80" fill="none" stroke="#f4f4f4" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )}
      {marked(look, 'halfBlack') && (
        <path d="M60 24 C74 24 84 34 84 54 C84 66 81 77 74 86 C69 92 64 96 60 97 Z" fill="#111" />
      )}
    </g>
  );
}

const EYE_HOLES = 'M42 63 Q49 58 56.6 63 Q49 67.4 42 63 Z M78 63 Q71 58 63.4 63 Q71 67.4 78 63 Z';

function Masks({ look }: { look: CastLook }) {
  return (
    <g strokeLinejoin="round">
      {marked(look, 'mask') && (
        <g fill={look.outfit.secondary} stroke={INK} strokeWidth={1.2}>
          <path d="M51 90 L69 90 L70 110 L50 110 Z" />
          <path d="M37 67 C41 70.5 51 70 60 69.5 C69 70 79 70.5 83 67 C84 76 80 86 74 90 C69 95 64 98 60 98 C56 98 51 95 46 90 C40 86 36 76 37 67 Z" />
          <path d="M57 76 Q60 72.6 63 76" fill="none" stroke={shade(look.outfit.secondary, 1.5)} strokeWidth={0.9} />
        </g>
      )}
      {marked(look, 'porcelainMask') && (
        <g>
          <path
            d={`M38 47 C38 33 48 28 60 28 C72 28 82 33 82 47 L82 70 C80 84 70 94 60 96 C50 94 40 84 38 70 Z ${EYE_HOLES}`}
            fill="#f4f4f2"
            fillRule="evenodd"
            stroke={INK}
            strokeWidth={1.2}
          />
          <path d="M45 72 L49.6 80 M75 72 L70.4 80" stroke="#c4161c" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
      {marked(look, 'spiralMask') && (
        <g>
          <path
            d={`M37 50 C37 32 48 26 60 26 C72 26 83 32 83 50 L83 70 C81 84 71 95 60 97 C49 95 39 84 37 70 Z ${EYE_HOLES}`}
            fill="#f2f2ee"
            fillRule="evenodd"
            stroke={INK}
            strokeWidth={1.2}
          />
          {[8, 15, 22].map((radius) => (
            <path
              key={radius}
              d={`M${60 - radius} 78 A${radius} ${radius} 0 0 1 ${60 + radius} 78`}
              fill="none"
              stroke="#a3a8b0"
              strokeWidth={0.9}
            />
          ))}
        </g>
      )}
    </g>
  );
}

function Hair({ look, layer }: { look: CastLook; layer: 'back' | 'front' }) {
  const shapes = HAIR_SHAPES[look.hair.style];
  const fill = look.hair.color;
  if (layer === 'back') {
    return <g>{shapes.back?.map((d) => <path key={d} d={d} fill={shade(fill, 0.82)} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />)}</g>;
  }
  return (
    <g>
      {shapes.cap && <path d={shapes.cap} fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />}
      {shapes.cap && (
        <path d="M44 27 Q52 21.6 62 21.8" fill="none" stroke={shade(fill, 1.45)} strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
      )}
      {shapes.lines?.map((d) => <path key={d} d={d} fill="none" stroke={shade(fill, 0.55)} strokeWidth={1.1} />)}
      {shapes.front?.map((d) => <path key={d} d={d} fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />)}
    </g>
  );
}

function FrontAccessories({ id, look }: { id: CastId; look: CastLook }) {
  return (
    <g>
      {has(look, 'helmet') && [
        'M35 44 L33 77 L39.4 79 L41 48 Z',
        mirror('M35 44 L33 77 L39.4 79 L41 48 Z'),
      ].map((d) => <path key={d} d={d} fill="#9aa3ad" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />)}
      {has(look, 'kageHat') && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M20 42 L60 9 L100 42 Q60 51 20 42 Z" fill="#f3f4f6" />
          <path d="M60 22 L70 33 L60 44 L50 33 Z" fill={look.outfit.primary} />
          <path d={KANJI.earth} transform="translate(56 29) scale(0.8)" fill="none" stroke="#f8fafc" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
      {has(look, 'paperFlower') && (
        <g stroke={INK} strokeWidth={0.8} strokeLinejoin="round">
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx={42} cy={21} rx={2.6} ry={5} fill="#f8fafc" transform={`rotate(${angle} 42 26)`} />
          ))}
          <circle cx={42} cy={26} r={1.8} fill="#93c5fd" />
        </g>
      )}
      {has(look, 'earrings') && (
        <g fill="#d4af37" stroke={INK} strokeWidth={0.6}>
          <circle cx={35.6} cy={70.4} r={1.8} />
          <circle cx={84.4} cy={70.4} r={1.8} />
        </g>
      )}
      {has(look, 'lollipop') && <path d="M63 86.2 L72.6 93.4" stroke="#f8fafc" strokeWidth={1.8} strokeLinecap="round" />}
      {OIL_HEADBAND.has(id) && (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M47 36 L38 21 L51 33 Z" fill={METAL} />
          <path d="M73 36 L82 21 L69 33 Z" fill={METAL} />
          <rect x={46} y={32.6} width={28} height={11.6} rx={2} fill={METAL} />
          <path d={KANJI.oil} transform="translate(55.6 34.2) scale(0.88)" fill="none" stroke="#334155" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

function Eyewear({ look }: { look: CastLook }) {
  return (
    <g>
      {has(look, 'glasses') && (
        <g fill="rgba(200,230,255,0.18)" stroke="#2a2a2a" strokeWidth={1.3}>
          <circle cx={EYE_CENTRE.x} cy={EYE_CENTRE.y} r={7.4} />
          <circle cx={120 - EYE_CENTRE.x} cy={EYE_CENTRE.y} r={7.4} />
          <path d="M56.8 62 Q60 60 63.2 62" fill="none" />
        </g>
      )}
      {has(look, 'scopeEye') && (
        <g stroke={INK} strokeWidth={1.3}>
          <path d="M77 62 L85.6 59.4" />
          <circle cx={70.6} cy={62.8} r={6.4} fill="rgba(125,211,252,0.4)" />
          <circle cx={70.6} cy={62.8} r={3.4} fill="none" />
        </g>
      )}
    </g>
  );
}

export interface CastPortraitProps {
  id: CastId;
  // Rendered height in px (width follows the 120x140 box); CSS sizes it otherwise.
  // eslint-disable-next-line react/require-default-props
  size?: number;
  // Off for a portrait whose name is already said next to it.
  // eslint-disable-next-line react/require-default-props
  labelled?: boolean;
  // Mirror it (story scenes face the second speaker toward the first).
  // eslint-disable-next-line react/require-default-props
  flip?: boolean;
  // eslint-disable-next-line react/require-default-props
  className?: string;
}

/** One cast member's portrait bust (SVG), named for screen readers. */
export const CastPortrait = memo(({
  id, size, labelled = true, flip = false, className,
}: CastPortraitProps) => {
  const member = CAST[id];
  const { look } = member;
  const plainEyes = look.headband?.wear === 'overEye';
  const width = size ? (size * PORTRAIT_BOX.width) / PORTRAIT_BOX.height : undefined;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${PORTRAIT_BOX.width} ${PORTRAIT_BOX.height}`}
      // A box wider or taller than the bust keeps it standing at the bottom.
      preserveAspectRatio="xMidYMax meet"
      width={width}
      height={size}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? `Portrait of ${member.name}` : undefined}
      aria-hidden={labelled ? undefined : 'true'}
      data-cast={id}
      focusable="false"
    >
      <g transform={flip ? MIRROR : undefined}>
        <BackAccessories look={look} />
        <Hair look={look} layer="back" />
        <Outfit look={look} />
        <path d={NECK} fill={look.skin} stroke={INK} strokeWidth={1.3} />
        <path d={NECK_SHADE} fill={shade(look.skin, 0.8)} />
        {OUTFIT_SHAPES[look.outfit.style].highCollar && (
          <path
            d={OUTFIT_SHAPES.akatsukiCloak.parts[0].d}
            fill={look.outfit.primary}
            stroke={INK}
            strokeWidth={1.2}
          />
        )}
        {OUTFIT_SHAPES[look.outfit.style].highCollar && (
          <path
            d={OUTFIT_SHAPES.akatsukiCloak.parts[1].d}
            fill={look.outfit.secondary}
            stroke={INK}
            strokeWidth={1.2}
          />
        )}
        <BodyHeadband look={look} />
        <ellipse
          cx={36.4}
          cy={63}
          rx={3.6}
          ry={6}
          fill={look.skin}
          stroke={INK}
          strokeWidth={1.2}
        />
        <ellipse
          cx={83.6}
          cy={63}
          rx={3.6}
          ry={6}
          fill={look.skin}
          stroke={INK}
          strokeWidth={1.2}
        />
        <path d={FACE} fill={look.skin} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={FACE_SHADE} fill={shade(look.skin, 0.84)} />
        <Eye look={look} plain={plainEyes} />
        <g transform={MIRROR}><Eye look={look} plain={false} /></g>
        <path d={NOSE} fill="none" stroke={shade(look.skin, 0.55)} strokeWidth={0.9} strokeLinecap="round" />
        <path d={MOUTH} fill="none" stroke={shade(look.skin, 0.35)} strokeWidth={1.1} strokeLinecap="round" />
        <FaceMarks look={look} />
        <Masks look={look} />
        <Eyewear look={look} />
        <Hair look={look} layer="front" />
        <Headband look={look} />
        <FrontAccessories id={id} look={look} />
      </g>
    </svg>
  );
});

CastPortrait.displayName = 'CastPortrait';
