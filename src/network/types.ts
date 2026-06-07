import { GameAction } from '../engine/actions';
import { GameEngineState } from '../engine/types';
import { CharacterId, GameMode, StageId } from '../content';

export interface RoomSelection {
  mode: GameMode;
  stageId: StageId;
  selectedCharacters: CharacterId[];
}

/** Wire format for future WebSocket multiplayer */
export interface ClientInputMessage {
  type: 'input';
  roomId: string;
  playerId: string;
  tick: number;
  action: GameAction;
}

export interface ServerStateMessage {
  type: 'state';
  roomId: string;
  tick: number;
  state: GameEngineState;
}

export interface JoinRoomMessage {
  type: 'join';
  roomId: string;
  playerName: string;
  selection?: RoomSelection;
}

export interface RoomSelectionMessage {
  type: 'room-selection';
  roomId: string;
  playerId: string;
  selection: RoomSelection;
}

export interface LobbySnapshotMessage {
  type: 'lobby';
  roomId: string;
  players: {
    id: string;
    name: string;
    ready: boolean;
    characterId?: CharacterId;
  }[];
  selection: RoomSelection;
}

export interface RoomSnapshotMessage {
  type: 'snapshot';
  roomId: string;
  state: GameEngineState;
}

export type MultiplayerMessage =
  | ClientInputMessage
  | ServerStateMessage
  | JoinRoomMessage
  | RoomSelectionMessage
  | LobbySnapshotMessage
  | RoomSnapshotMessage;

export function serializeMessage(message: MultiplayerMessage): string {
  return JSON.stringify(message);
}

export function parseMessage(raw: string): MultiplayerMessage {
  return JSON.parse(raw) as MultiplayerMessage;
}
