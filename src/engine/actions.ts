import { Direction, GameConfig } from './types';
import { CharacterId, GameMode, StageId } from '../content';

type RoomSelectionPayload = {
  mode: GameMode;
  stageId: StageId;
  selectedCharacters: CharacterId[];
};

/** Serializable actions – safe to send over network for future multiplayer */
export type GameAction =
  | { type: 'INIT'; config: GameConfig }
  | { type: 'MOVE'; playerId: string; direction: Direction }
  | { type: 'DROP_BOMB'; playerId: string }
  | { type: 'DETONATE_BOMBS'; playerId: string }
  | { type: 'USE_ULTIMATE'; playerId: string }
  | { type: 'PLACE_OBSTACLE'; playerId: string }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'DISMISS_DIALOG' }
  | { type: 'RESTART' };

export type NetworkMessage =
  | { kind: 'join'; roomId: string; playerName: string; selection?: RoomSelectionPayload }
  | { kind: 'room-selection'; roomId: string; playerId: string; selection: RoomSelectionPayload }
  | { kind: 'input'; roomId: string; playerId: string; action: GameAction }
  | { kind: 'state'; roomId: string; tick: number; payload: string }
  | { kind: 'snapshot'; roomId: string; state: string };
