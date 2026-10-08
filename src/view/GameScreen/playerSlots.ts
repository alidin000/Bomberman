// Per-slot identity for local multiplayer. Players may pick the same shinobi,
// so the HUD, captions and result screen tell them apart by slot (P1/P2/P3),
// not by character colour. The colours follow the red/blue/yellow port order
// of couch party games, taken from the colour-blind-safe Okabe-Ito set
// (vermillion lightened so ink text keeps 4.5:1), and every use pairs the
// colour with the "P1" label so colour is never the only cue.
export const PLAYER_SLOT_COLORS = ['#E06A10', '#0072B2', '#F0E442'] as const;

// Text that reads on each slot colour at WCAG AA (4.5:1) or better.
const PLAYER_SLOT_TEXT = ['var(--anime-ink)', '#ffffff', 'var(--anime-ink)'] as const;

export function playerSlotColor(slotIndex: number): string {
  return PLAYER_SLOT_COLORS[slotIndex % PLAYER_SLOT_COLORS.length];
}

export function playerSlotTextColor(slotIndex: number): string {
  return PLAYER_SLOT_TEXT[slotIndex % PLAYER_SLOT_TEXT.length];
}

export function playerSlotLabel(slotIndex: number): string {
  return `P${slotIndex + 1}`;
}
