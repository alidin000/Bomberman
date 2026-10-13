/* eslint-disable max-len -- part recipes read best one part per line */
import type { ScarfId } from '../../../../content/villageSquare';
import { SCARF_LOOKS } from '../../../../content/scarves';
import {
  HALF_TURN, InkedToken, TokenPart, ball, box, buildInkedToken, ring, tokenPart,
} from '../inkedToken';

/**
 * The scarf a player chose to wear (GameConfig.village.scarf): the ember
 * scarf of Honored standing, or a village's scarf in that village's colours
 * (all three of its secrets found). A wrap round the neck, a knot at the back
 * and two tails with a woven thread, in token parts (the token program and
 * the shared ink line, no new shader). Placed on the cast figure's neck, in
 * the fighter's body frame (feet at -0.55).
 */

export type ScarfColors = {
  cloth: string;
  thread: string;
  tips: string;
  /** Emissive tint (a uniform on a pooled token material). */
  glow?: string;
};

// The tips' accent and the ember glow are render only; cloth and thread come
// from the hub's scarf list (content/scarves.ts), so the picker's swatch and
// the worn scarf always match.
const SCARF_TIPS: Record<ScarfId, string> = {
  ember: '#f97316',
  hiddenLeaf: '#f47b20',
  hiddenSand: '#7a2b2b',
  hiddenMist: '#9fc5d3',
  hiddenCloud: '#2d2f38',
  hiddenStone: '#c9a26b',
  akatsukiHideout: '#f8fafc',
  greatShinobiWar: '#e2e8f0',
};

export const SCARF_COLORS = Object.fromEntries(
  (Object.keys(SCARF_LOOKS) as ScarfId[]).map((id) => [id, {
    cloth: SCARF_LOOKS[id].colors[0],
    thread: SCARF_LOOKS[id].colors[1],
    tips: SCARF_TIPS[id],
    ...(id === 'ember' ? { glow: '#f97316' } : {}),
  }])
) as Record<ScarfId, ScarfColors>;

const NECK_Y = 0.795 - 0.55;
const flat = (part: TokenPart): TokenPart => ({ ...part, ink: false });

function scarfParts(colors: ScarfColors): TokenPart[] {
  const { cloth, thread, tips } = colors;
  return [
    tokenPart(ring(0.105, 0.04, 6, 18), cloth, [0, NECK_Y, 0], [HALF_TURN, 0, 0], [1, 0.85, 1]),
    flat(tokenPart(ring(0.108, 0.01, 3, 18), thread, [0, NECK_Y - 0.02, 0], [HALF_TURN, 0, 0], [1.06, 0.9, 1])),
    tokenPart(ball(0.05, 6, 5), cloth, [0.04, NECK_Y - 0.01, -0.12]),
    tokenPart(box(0.075, 0.26, 0.022), cloth, [0.02, NECK_Y - 0.15, -0.15], [0.35, 0, 0.12]),
    tokenPart(box(0.065, 0.21, 0.022), cloth, [0.1, NECK_Y - 0.12, -0.145], [0.45, 0, -0.2]),
    flat(tokenPart(box(0.077, 0.018, 0.026), thread, [0.005, NECK_Y - 0.21, -0.172], [0.35, 0, 0.12])),
    flat(tokenPart(box(0.067, 0.018, 0.026), thread, [0.12, NECK_Y - 0.17, -0.165], [0.45, 0, -0.2])),
    flat(tokenPart(box(0.072, 0.03, 0.026), tips, [-0.005, NECK_Y - 0.27, -0.19], [0.35, 0, 0.12])),
    flat(tokenPart(box(0.062, 0.03, 0.026), tips, [0.135, NECK_Y - 0.22, -0.18], [0.45, 0, -0.2])),
  ];
}

const SCARVES = new Map<ScarfId, InkedToken>();

/** One shared scarf per id, for the session. */
export function scarfMesh(scarf: ScarfId): InkedToken {
  let token = SCARVES.get(scarf);
  if (!token) {
    token = buildInkedToken(scarfParts(SCARF_COLORS[scarf]));
    SCARVES.set(scarf, token);
  }
  return token;
}
