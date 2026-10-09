/* eslint-disable no-param-reassign -- materials are shared three.js objects tuned in place */
import { useEffect } from 'react';
import * as THREE from 'three';
import { StageDefinition } from '../../../content/types';

// High contrast without a CSS filter on the canvas. A `filter` there makes the
// compositor run an extra full-screen pass every frame (it was the most
// expensive path in a match). Instead the mode changes colours the scene
// already sends as uniforms and instance colours: the stage palette and the
// opacity of the shared danger-cue materials. No new shader program compiles.

type StagePalette = StageDefinition['palette'];

type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const channel = (offset: number) => parseInt(match[1].slice(offset, offset + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

function rgbToHsl([r, g, b]: [number, number, number]): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = (r - g) / d + 4;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  return { h: h / 6, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const channel = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** WCAG relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linear = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two sRGB hex colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function retone(hex: string, tone: (hsl: Hsl) => Hsl): string {
  const rgb = hexToRgb(hex);
  return rgb ? hslToHex(tone(rgbToHsl(rgb))) : hex;
}

// Each stage keeps its hues; lightness is set by role so the walkable floor,
// solid walls and breakable crates separate by brightness, not only by hue.
const PALETTE_TONES: Partial<Record<keyof StagePalette, (hsl: Hsl) => Hsl>> = {
  groundA: ({ h, s }) => ({ h, s: s * 0.5, l: 0.88 }),
  groundB: ({ h, s }) => ({ h, s: s * 0.5, l: 0.8 }),
  wall: ({ h, s }) => ({ h, s: Math.min(1, s * 0.9), l: 0.2 }),
  // Mid-tone and muted: clear of the floor and walls, and not read as the
  // saturated red of the blast and warning cues.
  crate: ({ h, s }) => ({ h, s: Math.min(0.5, Math.max(0.35, s)), l: 0.5 }),
};

const paletteCache = new WeakMap<StagePalette, StagePalette>();

/** The stage palette for high-contrast mode (same object for the same input). */
export function highContrastPalette(palette: StagePalette): StagePalette {
  const cached = paletteCache.get(palette);
  if (cached) return cached;
  const next = { ...palette };
  (Object.keys(PALETTE_TONES) as (keyof StagePalette)[]).forEach((key) => {
    const tone = PALETTE_TONES[key];
    if (tone && typeof palette[key] === 'string') next[key] = retone(palette[key], tone);
  });
  paletteCache.set(palette, next);
  return next;
}

/** A shared material and the uniform values it takes in high-contrast mode. */
export type HighContrastOverride = {
  material: THREE.Material & { color?: THREE.Color };
  opacity?: number;
  color?: THREE.ColorRepresentation;
};

/**
 * Applies `overrides` while `enabled`, and restores the materials' own
 * values when it turns off or the scene unmounts. Opacity and colour are
 * uniforms, so switching never compiles a program. `overrides` must be a
 * stable (module-level) list.
 */
export function useHighContrastMaterials(
  enabled: boolean,
  overrides: readonly HighContrastOverride[]
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const saved = overrides.map(({ material }) => ({
      opacity: material.opacity,
      color: material.color?.clone(),
    }));
    overrides.forEach(({ material, opacity, color }) => {
      if (opacity !== undefined) material.opacity = opacity;
      if (color !== undefined) material.color?.set(color);
    });
    return () => {
      overrides.forEach(({ material }, index) => {
        material.opacity = saved[index].opacity;
        const original = saved[index].color;
        if (original) material.color?.copy(original);
      });
    };
  }, [enabled, overrides]);
}
