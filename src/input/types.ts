import { GameAction } from '../engine/actions';
import { PlayerState } from '../engine/types';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  bomb: boolean;
  detonate: boolean;
  special: boolean;
  cover: boolean;
}

export interface PlayerController {
  getActions(player: PlayerState, input: InputState): GameAction[];
}

export const EMPTY_INPUT_STATE: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  bomb: false,
  detonate: false,
  special: false,
  cover: false,
};
