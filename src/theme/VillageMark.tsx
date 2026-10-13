/* eslint-disable react/require-default-props */
import React from 'react';
import { VILLAGE_SYMBOLS, VillageSymbolId } from '../content/villageSymbols';

// The village marks in the menus: one inline SVG per mark, drawn from
// VILLAGE_SYMBOLS in its 0-100 box (the same data the headband plates and
// the portraits read).

const DEFAULT_STROKE = 6;
const DEFAULT_OUTLINE = 4;
// The Akatsuki cloud's outline: white on cloth, as on the cloaks.
const FILL_OUTLINE = '#ffffff';

type VillageMarkProps = {
  id: VillageSymbolId;
  /** Width and height (px number or any CSS length). */
  size?: number | string;
  /** Overrides the mark's own colour (stroke and glyph marks). */
  color?: string;
  /**
   * The accessible name. Without one the mark is decoration and hidden from
   * assistive tech (the village's name is always in the text beside it).
   */
  title?: string;
  className?: string;
};

export const VillageMark = ({
  id, size = 32, color, title, className,
}: VillageMarkProps) => {
  const mark = VILLAGE_SYMBOLS[id];
  let body: React.ReactNode;
  if (mark.mode === 'glyph') {
    body = (
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="86"
        fill={color ?? mark.color}
        style={{ fontFamily: 'var(--font-brush)' }}
      >
        {mark.glyph}
      </text>
    );
  } else if (mark.mode === 'fill') {
    body = (
      <path
        d={mark.d}
        fill={mark.color}
        stroke={FILL_OUTLINE}
        strokeWidth={mark.strokeWidth ?? DEFAULT_OUTLINE}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    );
  } else {
    body = (
      <path
        d={mark.d}
        fill="none"
        stroke={color ?? mark.color}
        strokeWidth={mark.strokeWidth ?? DEFAULT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      data-village-mark={id}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable={title ? undefined : 'false'}
    >
      {body}
    </svg>
  );
};

/**
 * A stroke or fill mark as a CSS `url(...)` image, for watermarks drawn as a
 * background (no extra DOM). Glyph marks need the page's brush font, which an
 * SVG image cannot load, so they return null: draw those as text.
 */
export function villageMarkImage(
  id: VillageSymbolId,
  color?: string,
  opacity = 1
): string | null {
  const mark = VILLAGE_SYMBOLS[id];
  if (mark.mode === 'glyph' || !mark.d) return null;
  const path = mark.mode === 'fill'
    ? `<path d='${mark.d}' fill='${mark.color}' stroke='${FILL_OUTLINE}' stroke-width='${mark.strokeWidth ?? DEFAULT_OUTLINE}' stroke-linejoin='round' paint-order='stroke'/>`
    : `<path d='${mark.d}' fill='none' stroke='${color ?? mark.color}' stroke-width='${mark.strokeWidth ?? DEFAULT_STROKE}' stroke-linecap='round' stroke-linejoin='round'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g opacity='${opacity}'>${path}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
