import { Direction } from '../engine/types';
import { TouchPad } from './touchPad';
import { TouchButtonId } from './touchLayout';

export type TouchKeySink = (type: 'keydown' | 'keyup', key: string) => void;

// Index of each control in a player's bindings: up, left, down, right,
// bomb, detonate, ultimate, cover (constants/props KeyBindings).
const DIRECTION_KEY: Record<Direction, number> = {
  up: 0, left: 1, down: 2, right: 3,
};
const BUTTON_KEY: Record<TouchButtonId, number> = {
  bomb: 4, detonate: 5, ultimate: 6, cover: 7,
};

/**
 * Turns pad and button pointers into presses of one player's bound keys.
 * Only changes send keys. A new direction is pressed before the old one is
 * released, the way a thumb rolls between keys, so the engine's buffered
 * turn (TURN_BUFFER_MS, fallbackDirection) and escape forgiveness apply as
 * they do on a keyboard. A release always sends the key that was pressed,
 * even if the bindings changed in between.
 */
export class TouchController {
  readonly pad = new TouchPad();

  private padPointer: number | null = null;

  private direction: Direction | null = null;

  private directionKey = '';

  private readonly pressed = new Map<number, string>();

  private keys: readonly string[];

  private readonly sink: TouchKeySink;

  constructor(keys: readonly string[], sink: TouchKeySink) {
    this.keys = keys;
    this.sink = sink;
  }

  setKeys(keys: readonly string[]): void {
    if (keys === this.keys) return;
    this.releaseAll();
    this.keys = keys;
  }

  get padActive(): boolean {
    return this.padPointer !== null;
  }

  /** The direction the pad holds now. */
  get heldDirection(): Direction | null {
    return this.direction;
  }

  isPadPointer(pointerId: number): boolean {
    return this.padPointer === pointerId;
  }

  /** A thumb landed in the pad zone; false if another thumb already has the pad. */
  padStart(pointerId: number, x: number, y: number): boolean {
    if (this.padPointer !== null) return false;
    this.padPointer = pointerId;
    this.pad.start(x, y);
    return true;
  }

  padMove(pointerId: number, x: number, y: number): boolean {
    if (this.padPointer !== pointerId) return false;
    this.steer(this.pad.move(x, y));
    return true;
  }

  padEnd(pointerId: number): boolean {
    if (this.padPointer !== pointerId) return false;
    this.padPointer = null;
    this.pad.end();
    this.steer(null);
    return true;
  }

  press(pointerId: number, button: TouchButtonId): boolean {
    const key = this.keys[BUTTON_KEY[button]];
    if (!key || this.pressed.has(pointerId)) return false;
    this.pressed.set(pointerId, key);
    this.sink('keydown', key);
    return true;
  }

  release(pointerId: number): boolean {
    const key = this.pressed.get(pointerId);
    if (key === undefined) return false;
    this.pressed.delete(pointerId);
    this.sink('keyup', key);
    return true;
  }

  /** Lets go of everything (a menu opened, the page lost focus, a cancelled touch). */
  releaseAll(): void {
    if (this.padPointer !== null) this.padEnd(this.padPointer);
    Array.from(this.pressed.keys()).forEach((pointerId) => this.release(pointerId));
  }

  private steer(next: Direction | null): void {
    if (next === this.direction) return;
    const nextKey = next ? this.keys[DIRECTION_KEY[next]] ?? '' : '';
    const previousKey = this.directionKey;
    if (nextKey) this.sink('keydown', nextKey);
    if (previousKey) this.sink('keyup', previousKey);
    this.direction = next;
    this.directionKey = nextKey;
  }
}
