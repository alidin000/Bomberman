import type { CharacterId } from '../../../../content/types';

/**
 * The playable fighters' effect colours: the campaign floor ring and the
 * shield bubble (aura), and the shield's inner ring (accent). Their figures
 * come from content/animeCast.ts.
 */
export const FIGHTER_EFFECT_COLORS: Record<CharacterId, { aura: string; accent: string }> = {
  deidara: { aura: '#ff8a00', accent: '#d92323' },
  naruto: { aura: '#f97316', accent: '#2563eb' },
  sasuke: { aura: '#60a5fa', accent: '#60a5fa' },
  gaara: { aura: '#d6a45d', accent: '#f59e0b' },
  minato: { aura: '#fde047', accent: '#facc15' },
  itachi: { aura: '#ef4444', accent: '#dc2626' },
};
