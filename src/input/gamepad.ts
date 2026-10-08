import { KeyBindings, KEY_BINDING_COUNT } from '../constants/props';
import { getPlayerBindings } from './humanController';

// Pads drive the game through the keyboard path: each pad presses and
// releases the keys bound to its player, so remapping, held-direction
// stacking and buffered turns behave exactly as they do on a keyboard.

/** The subset of the browser `Gamepad` the poller reads. */
export type PadSnapshot = {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
};

export type KeySink = (type: 'keydown' | 'keyup', key: string) => void;

export const STICK_DEADZONE = 0.5;
export const PAUSE_KEY = 'Escape';

// W3C "Standard Gamepad" layout: 12-15 left cluster (d-pad) up/down/left/
// right, 0-3 right cluster bottom/right/left/top, 9 right centre (Start).
// Listed in key-binding order: up, left, down, right, bomb, detonate,
// ultimate, cover.
const BUTTONS_BY_BINDING: readonly number[] = [12, 14, 13, 15, 0, 1, 3, 2];
const START_BUTTON = 9;
const CONTROL_COUNT = KEY_BINDING_COUNT + 1;
const PAUSE_CONTROL = KEY_BINDING_COUNT;

function isPressed(pad: PadSnapshot, button: number): boolean {
  return pad.buttons[button]?.pressed === true;
}

/**
 * Turns pad state into key presses. The n-th connected pad plays as player
 * n+1. Only changes produce key events, and a release always sends the key
 * that was pressed, even if the bindings changed in between. Polling
 * allocates nothing after a slot's first use.
 */
export class GamepadPoller {
  private readonly slots: { held: boolean[]; keys: string[] }[] = [];

  private readonly scratch: boolean[] = new Array(CONTROL_COUNT).fill(false);

  poll(
    pads: readonly (PadSnapshot | null)[],
    keyBindings: KeyBindings,
    sink: KeySink
  ): void {
    let slotIndex = 0;
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      if (pad && pad.connected) {
        this.applySlot(slotIndex, pad, keyBindings, sink);
        slotIndex += 1;
      }
    }
    // Slots whose pad went away release everything they still hold.
    for (let i = slotIndex; i < this.slots.length; i += 1) {
      this.applySlot(i, null, keyBindings, sink);
    }
  }

  /**
   * Forgets what is held without sending releases, for when the keyboard
   * side already dropped all movement (window blur). Controls still down
   * press again on the next poll.
   */
  reset(): void {
    this.slots.forEach((slot) => {
      slot.held.fill(false);
    });
  }

  /**
   * Reads one pad into the scratch row (binding order, then Start). The left
   * stick picks only its dominant axis, so a sloppy diagonal never presses
   * two directions.
   */
  private read(pad: PadSnapshot | null): boolean[] {
    const out = this.scratch;
    out.fill(false);
    if (!pad || !pad.connected) return out;
    for (let i = 0; i < KEY_BINDING_COUNT; i += 1) {
      out[i] = isPressed(pad, BUTTONS_BY_BINDING[i]);
    }
    out[PAUSE_CONTROL] = isPressed(pad, START_BUTTON);

    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (Math.abs(x) >= Math.abs(y)) {
      if (x <= -STICK_DEADZONE) out[1] = true;
      if (x >= STICK_DEADZONE) out[3] = true;
    } else {
      if (y <= -STICK_DEADZONE) out[0] = true;
      if (y >= STICK_DEADZONE) out[2] = true;
    }
    return out;
  }

  private applySlot(
    slotIndex: number,
    pad: PadSnapshot | null,
    keyBindings: KeyBindings,
    sink: KeySink
  ): void {
    let slot = this.slots[slotIndex];
    if (!slot) {
      slot = {
        held: new Array(CONTROL_COUNT).fill(false),
        keys: new Array(CONTROL_COUNT).fill(''),
      };
      this.slots[slotIndex] = slot;
    }
    const controls = this.read(pad);
    const bindings = getPlayerBindings(keyBindings, slotIndex);
    for (let i = 0; i < CONTROL_COUNT; i += 1) {
      if (controls[i] !== slot.held[i]) {
        if (controls[i]) {
          const key = i === PAUSE_CONTROL ? PAUSE_KEY : bindings?.[i];
          if (key) {
            slot.held[i] = true;
            slot.keys[i] = key;
            sink('keydown', key);
          }
        } else {
          slot.held[i] = false;
          sink('keyup', slot.keys[i]);
        }
      }
    }
  }
}
