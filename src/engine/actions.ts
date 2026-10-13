import { Direction, GameConfig } from './types';
import type { HubConsumableId } from '../content/hubShop';

/** Serializable actions – safe to send over network for future multiplayer */
export type GameAction =
  | { type: 'INIT'; config: GameConfig }
  | { type: 'MOVE'; playerId: string; direction: Direction; fallbackDirection?: Direction }
  | { type: 'DROP_BOMB'; playerId: string }
  | { type: 'DETONATE_BOMBS'; playerId: string }
  | { type: 'USE_ULTIMATE'; playerId: string }
  | { type: 'PLACE_OBSTACLE'; playerId: string }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'DISMISS_DIALOG' }
  // Any action key, A or Start during the boss intro: start the fight now
  // (ignored for its first BOSS_INTRO_SKIP_LOCK_MS).
  | { type: 'SKIP_BOSS_INTRO' }
  // Solo campaign village square (villageSquare.ts). Both are taken while the
  // match is paused, since the board and stall pause it; without
  // GameConfig.village they do nothing.
  | { type: 'ACCEPT_REQUEST'; playerId: string; requestId: string }
  | { type: 'CAMPAIGN_PURCHASE'; playerId: string; itemId: HubConsumableId }
  | { type: 'RESTART' };
