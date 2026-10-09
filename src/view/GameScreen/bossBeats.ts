import { BOSS_INTRO_MS, GameEngineState } from '../../engine';
import { getBossDefinition } from '../../content/bosses';
import { BossId } from '../../content/types';
import type { EngineSelector } from '../../hooks/engineStore';
import { FRAME_MARGIN, screenY } from './scene/cameraFraming';
import { INTRO_AIM_TOWARD_CAMERA, INTRO_FRAMING } from './scene/bossPresentation';

// The boss's entrance and seal, as the DOM shows them: the title card over
// the frozen arena, and the reward card over the hold that follows the seal.
// The scene's side (camera push-in, roar pose, collapse) is in
// scene/bossPresentation.ts.

/**
 * The hold after a boss is sealed, before the result covers the arena. The
 * deciding blast and the collapse (scene/bossPresentation) play out, and the
 * reward card reads, while the scene keeps drawing. A plain round end keeps
 * RESULT_HOLD_MS.
 */
export const BOSS_SEAL_HOLD_MS = 2200;

/** The title card shows from here (ms into the intro), once the camera is on the boss... */
export const BOSS_TITLE_FROM_MS = 450;
/** ...until here, as the camera heads back to the player. */
export const BOSS_TITLE_UNTIL_MS = BOSS_INTRO_MS - 250;

export type BossSeal = { bossId: BossId; name: string; reward: string };

/** The boss the campaign just sealed, while the match is over on it; else null. */
export function bossSealOf(state: GameEngineState | null): BossSeal | null {
  if (
    !state
    || state.phase !== 'game_over'
    || state.config.mode !== 'solo'
    || !state.boss
    || state.boss.health > 0
  ) return null;
  return {
    bossId: state.boss.id,
    name: state.boss.name,
    reward: getBossDefinition(state.boss.id).reward,
  };
}

export type BossTitle = {
  /** Shown now: the boss's entrance is between BOSS_TITLE_FROM_MS and BOSS_TITLE_UNTIL_MS. */
  card: boolean;
  name: string;
  /** Its two signature attacks, so the player knows what is coming. */
  line: string;
  /**
   * Each living ninja's place from the intro camera's aim, in cells toward
   * the camera: the card goes where none of them is drawn.
   */
  ninjaDepths: readonly number[];
};

const NO_TITLE: BossTitle = {
  card: false, name: '', line: '', ninjaDepths: [],
};

/** Milliseconds since the boss appeared, while its intro runs; null otherwise. */
export function bossIntroElapsedMs(state: GameEngineState | null): number | null {
  const remaining = state?.bossIntroMsRemaining ?? 0;
  if (!state || remaining <= 0 || !state.boss) return null;
  return BOSS_INTRO_MS - remaining;
}

/**
 * The title card's slice of the state: it changes twice per intro (on and
 * off), so the card renders twice, not per tick.
 */
export const selectBossTitle: EngineSelector<BossTitle> = (state, previous) => {
  const elapsed = bossIntroElapsedMs(state);
  const card = elapsed !== null
    && state?.phase === 'playing'
    && elapsed >= BOSS_TITLE_FROM_MS
    && elapsed < BOSS_TITLE_UNTIL_MS;
  if (!card || !state?.boss) return previous && !previous.card ? previous : NO_TITLE;
  const { boss } = state;
  const { name } = boss;
  const ninjaDepths = state.players
    .filter((player) => player.alive)
    .map((player) => player.y - boss.y - INTRO_AIM_TOWARD_CAMERA);
  if (
    previous?.card
    && previous.name === name
    && previous.ninjaDepths.length === ninjaDepths.length
    && previous.ninjaDepths.every((depth, index) => depth === ninjaDepths[index])
  ) return previous;
  const definition = getBossDefinition(boss.id);
  return {
    card: true, name, line: definition.attacks.join(' · '), ninjaDepths,
  };
};

/** The intro camera's framing while the card is up (between arrival and the closest push-in). */
const TITLE_FRAMING = (INTRO_FRAMING.arrive + INTRO_FRAMING.close) / 2;

/**
 * Where the title card goes: low, unless a ninja would be drawn under it
 * there, then high. `edges` are the card's top edge when high and its bottom
 * edge when low, as distances from the top and bottom of the screen;
 * `cardFraction` is its height. Screen fractions throughout.
 */
export function bossTitlePlacement(
  ninjaDepths: readonly number[],
  edges: { top: number; bottom: number },
  cardFraction: number
): 'top' | 'bottom' {
  const covers = (from: number, to: number) => ninjaDepths.some((depth) => {
    const head = screenY(TITLE_FRAMING, depth, FRAME_MARGIN.head);
    const feet = screenY(TITLE_FRAMING, depth, 0);
    return feet > from && head < to;
  });
  const bottomBand: [number, number] = [1 - edges.bottom - cardFraction, 1 - edges.bottom];
  if (!covers(...bottomBand)) return 'bottom';
  const topBand: [number, number] = [edges.top, edges.top + cardFraction];
  return covers(...topBand) ? 'bottom' : 'top';
}
