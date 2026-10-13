// The bomb key in a village square: inside the square it never drops a
// bomb; next to a prop it uses the prop instead (talk, the board, the
// stall, the shrine, the gate). Keyboard, gamepad (A presses the bomb key)
// and the touch bomb button all arrive here as the bound bomb key. Which
// matches have a square, and its tier, are the engine's rules
// (engine/villageSquare.ts); this only decides what the key does.
import { CAMPAIGN_STAGE_LAYOUTS } from '../content/campaignLayouts';
import {
  VillageInteractable,
  VillageInteractableKind,
  reachableInteractable,
} from '../content/villageSquare';
import { getActiveVillageSquare, stallRefusal } from '../engine/villageSquare';
import type { GameEngineState } from '../engine/types';

export type SquareBombPress =
  // Outside the square (or no square in this match): the key drops a bomb.
  | null
  // In the square: no bomb; `item` is the prop in reach, if any.
  | { item: VillageInteractable | null };

export function squareBombPress(
  state: GameEngineState,
  playerId: string
): SquareBombPress {
  const active = getActiveVillageSquare(state.config);
  const { stageId } = state.config;
  const layout = stageId ? CAMPAIGN_STAGE_LAYOUTS[stageId]?.square : undefined;
  if (!active || !layout) return null;
  const player = state.players.find((item) => item.id === playerId);
  if (!player?.alive) return null;
  // The cell a player is on, as the engine counts it mid-step.
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  if (!active.contains(x, y)) return null;
  return { item: reachableInteractable(layout, x, y, active.tier) };
}

/**
 * The stall and the board are open: a solo visit (GameConfig.village, one
 * player). Co-op rooms, which also play as 'solo', have neither.
 */
export function squareVisitOpen(state: GameEngineState): boolean {
  return stallRefusal(state, 'paperWard') !== 'closed';
}

// Every square has villagers, the shrine and the gate.
const SHARED_KINDS = new Set<VillageInteractableKind>(['villager', 'shrine', 'gate']);

/** True when this match's square opens the prop's full overlay. */
export function squareKindOpen(state: GameEngineState, kind: VillageInteractableKind): boolean {
  return SHARED_KINDS.has(kind) || squareVisitOpen(state);
}
