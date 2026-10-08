import * as THREE from 'three';
import { createRefCache } from './labelSprites';

// "P1" / "P2" / "P3" chips over each fighter, in the colour of that player's
// HUD card, so a mirror match (two Narutos) still reads at a glance. One
// small canvas texture per number and colour, shared and reference counted.

const INK = '#211d1a';
const PAPER = '#fff8e7';

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

export function playerTagKey(slot: number, color: string): string {
  return `P${slot}\n${color}`;
}

export type PlayerTagSprite = {
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
};

function drawPlayerTag(key: string): PlayerTagSprite {
  const [label, color] = key.split('\n');
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const text = tagTextColor(color);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const [left, top, right, bottom, radius] = [5, 5, 123, 59, 14];
    context.beginPath();
    context.moveTo(left + radius, top);
    context.arcTo(right, top, right, bottom, radius);
    context.arcTo(right, bottom, left, bottom, radius);
    context.arcTo(left, bottom, left, top, radius);
    context.arcTo(left, top, right, top, radius);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    // Outlined in the text colour, so a cream or near-black chip still has a
    // high-contrast edge against the pastel floors.
    context.lineWidth = 6;
    context.strokeStyle = text;
    context.stroke();
    context.font = '800 40px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = text;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  // The same variant as the shared name labels, so no new shader program.
  // Drawn over walls in front: depthTest is not part of the program key.
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: false,
  });
  return { texture, material };
}

export const PLAYER_TAG_SPRITES = createRefCache(
  drawPlayerTag,
  (sprite: PlayerTagSprite) => {
    sprite.material.dispose();
    sprite.texture.dispose();
  },
  6
);
