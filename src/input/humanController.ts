import { Direction } from '../engine/types';
import { GameAction } from '../engine/actions';
import {
  EMPTY_INPUT_STATE,
  InputState,
  PlayerController,
} from './types';
import { KeyBindings } from '../constants/props';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const BINDING_DIRECTIONS: Direction[] = ['up', 'left', 'down', 'right'];

export class HumanController implements PlayerController {
  private readonly source = 'human';

  getActions(
    player: { id: string },
    input: InputState
  ): GameAction[] {
    const direction = DIRECTIONS.find((item) => input[item]);
    if (direction && this.source === 'human') {
      return [HumanController.createMoveAction(player.id, direction)];
    }
    if (input.bomb) {
      return [{ type: 'DROP_BOMB', playerId: player.id }];
    }
    if (input.detonate) {
      return [{ type: 'DETONATE_BOMBS', playerId: player.id }];
    }
    if (input.special) {
      return [{ type: 'USE_ULTIMATE', playerId: player.id }];
    }
    if (input.cover) {
      return [{ type: 'PLACE_OBSTACLE', playerId: player.id }];
    }
    return [];
  }

  private static createMoveAction(playerId: string, direction: Direction): GameAction {
    return { type: 'MOVE', playerId, direction };
  }
}

export function getInputStateForKey(
  key: string,
  bindings: string[]
): InputState {
  const input = { ...EMPTY_INPUT_STATE };
  const directionIndex = bindings.slice(0, 4).indexOf(key);
  const direction = BINDING_DIRECTIONS[directionIndex];
  if (direction) {
    return { ...input, [direction]: true };
  }
  if (bindings[4] === key) {
    return { ...input, bomb: true };
  }
  if (bindings[5] === key) {
    return { ...input, detonate: true };
  }
  if (bindings[6] === key) {
    return { ...input, special: true };
  }
  if (bindings[7] === key) {
    return { ...input, cover: true };
  }
  return input;
}

export function hasInput(input: InputState): boolean {
  return Object.values(input).some(Boolean);
}

export function getPlayerBindings(
  keyBindings: KeyBindings,
  playerIndex: number
): string[] | undefined {
  return keyBindings[String(playerIndex + 1)];
}
