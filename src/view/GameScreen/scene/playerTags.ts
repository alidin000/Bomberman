import * as THREE from 'three';
import { createRefCache } from './labelSprites';

// "P1" / "P2" / "P3" chips over each fighter, in the colour of that player's
// HUD card, so a mirror match (two Narutos) still reads at a glance. One
// small canvas texture per text, colour and style, shared and reference
// counted. The same chip draws the CPU tag ("P2 · CPU", square corners, so
// shape says it too), the greyed KO chip left where a ninja fell, and the
// pickup label that rises from a fighter.

const INK = '#211d1a';
const PAPER = '#fff8e7';
const KO_FILL = '#4a4541';

export type ChipStyle = 'slot' | 'cpu' | 'ko' | 'pickup';

/** Same rule as the HUD cards: ink on light player colours, paper on dark. */
export function tagTextColor(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return INK;
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? INK : PAPER;
}

export function chipKey(label: string, color: string, style: ChipStyle = 'slot'): string {
  return style === 'slot' ? `${label}\n${color}` : `${label}\n${color}\n${style}`;
}

/** The tag over a fighter: "P2", or "P2 · CPU" for a CPU slot. */
export function playerTagLabel(slot: number, cpu = false): string {
  return cpu ? `P${slot} · CPU` : `P${slot}`;
}

export function playerTagKey(slot: number, color: string, cpu = false): string {
  return chipKey(playerTagLabel(slot, cpu), color, cpu ? 'cpu' : 'slot');
}

/** The chip left on the cell where that player fell, for the rest of the round. */
export function koChipKey(slot: number, color: string): string {
  return chipKey(`P${slot} KO`, color, 'ko');
}

export type PlayerTagSprite = {
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  /** Width over height of the chip, for the sprite's scale. */
  aspect: number;
};

const CHIP_HEIGHT = 64;
const CHIP_FONT_PX: Record<ChipStyle, number> = {
  slot: 40, cpu: 34, ko: 34, pickup: 36,
};

/**
 * Canvas width for a label, in 32 px steps so similar labels share a size.
 * Estimated from the text length (bold Arial runs ~0.56 em per glyph), which
 * keeps the size, and so the sprite's aspect, the same with or without a 2D
 * canvas.
 */
export function chipWidth(label: string, style: ChipStyle): number {
  if (style === 'slot' && label.length <= 2) return 128;
  const text = label.length * CHIP_FONT_PX[style] * 0.56 + 36;
  return Math.max(128, Math.ceil(text / 32) * 32);
}

function chipColors(style: ChipStyle, color: string): { fill: string; edge: string; text: string } {
  if (style === 'ko') return { fill: KO_FILL, edge: color, text: PAPER };
  if (style === 'pickup') return { fill: PAPER, edge: color, text: INK };
  const text = tagTextColor(color);
  // Outlined in the text colour, so a cream or near-black chip still has a
  // high-contrast edge against the pastel floors.
  return { fill: color, edge: text, text };
}

function drawPlayerTag(key: string): PlayerTagSprite {
  const [label, color, styleKey] = key.split('\n');
  const style = (styleKey as ChipStyle | undefined) ?? 'slot';
  const width = chipWidth(label, style);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = CHIP_HEIGHT;
  const context = canvas.getContext('2d');
  if (context) {
    const { fill, edge, text } = chipColors(style, color);
    context.clearRect(0, 0, canvas.width, canvas.height);
    // CPU chips have square corners: a shape cue, not only the text.
    const radius = style === 'cpu' ? 4 : 14;
    const [left, top, right, bottom] = [5, 5, width - 5, CHIP_HEIGHT - 5];
    context.beginPath();
    context.moveTo(left + radius, top);
    context.arcTo(right, top, right, bottom, radius);
    context.arcTo(right, bottom, left, bottom, radius);
    context.arcTo(left, bottom, left, top, radius);
    context.arcTo(left, top, right, top, radius);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = edge;
    context.stroke();
    context.font = `800 ${CHIP_FONT_PX[style]}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = text;
    context.fillText(label, width / 2, CHIP_HEIGHT / 2 + 2, width - 24);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  // The same variant as the shared name labels, so no new shader program.
  // Drawn over walls in front: depthTest is not part of the program key.
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: false,
  });
  return { texture, material, aspect: width / CHIP_HEIGHT };
}

// Room for every slot's tag, CPU tag and KO chip plus the pickup labels, so
// a rematch finds them all still cached.
export const PLAYER_TAG_SPRITES = createRefCache(
  drawPlayerTag,
  (sprite: PlayerTagSprite) => {
    sprite.material.dispose();
    sprite.texture.dispose();
  },
  24
);
