import React from 'react';
import { VILLAGE_SYMBOLS, type VillageSymbolId } from '../../content/villageSymbols';

export interface VillageMarkProps {
  symbol: VillageSymbolId;
  // Top-left corner and size of the mark's square, in the parent's units.
  x: number;
  y: number;
  size: number;
  // eslint-disable-next-line react/require-default-props
  color?: string;
}

/** A village mark (villageSymbols.ts) drawn into an SVG at any size. */
export function VillageMark({
  symbol, x, y, size, color,
}: VillageMarkProps) {
  const mark = VILLAGE_SYMBOLS[symbol];
  const ink = color ?? mark.color;
  const scale = size / 100;
  if (mark.mode === 'glyph') {
    return (
      <text
        x={x + size / 2}
        y={y + size * 0.86}
        fontSize={size * 0.92}
        fontWeight={900}
        textAnchor="middle"
        fill={ink}
      >
        {mark.glyph}
      </text>
    );
  }
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d={mark.d}
      fill={mark.mode === 'fill' ? ink : 'none'}
      stroke={mark.mode === 'fill' ? '#f8fafc' : ink}
      strokeWidth={mark.mode === 'fill' ? 5 : 9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
