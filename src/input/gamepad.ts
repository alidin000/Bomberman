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

/** A press or release of a pad control the menu owns. */
export type PadMenuSink = (control: number, pressed: boolean, slot: number) => void;

export const STICK_DEADZONE = 0.5;
export const PAUSE_KEY = 'Escape';

// W3C "Standard Gamepad" layout: 12-15 left cluster (d-pad) up/down/left/
// right, 0-3 right cluster bottom/right/left/top, 9 right centre (Start).
// Listed in key-binding order: up, left, down, right, bomb, detonate,
// ultimate, cover.
const BUTTONS_BY_BINDING: readonly number[] = [12, 14, 13, 15, 0, 1, 3, 2];
/**
 * What each binding is on a pad, in the same order, for on-screen prompts.
 * Face buttons use the letters most pads print (bottom A, right B, top Y,
 * left X); the left stick also moves.
 */
export const PAD_BINDING_LABELS: readonly string[] = [
  'D-pad up', 'D-pad left', 'D-pad down', 'D-pad right', 'A', 'B', 'Y', 'X',
];
const START_BUTTON = 9;
const CONTROL_COUNT = KEY_BINDING_COUNT + 1;
const PAUSE_CONTROL = KEY_BINDING_COUNT;

/**
 * Control indices as the poller reads them: binding order, then Start. The
 * face buttons are named by position, since they also carry game actions.
 */
export const PAD_CONTROL = {
  UP: 0,
  LEFT: 1,
  DOWN: 2,
  RIGHT: 3,
  SOUTH: 4,
  EAST: 5,
  NORTH: 6,
  WEST: 7,
  START: PAUSE_CONTROL,
} as const;
export const PAD_CONTROL_COUNT = CONTROL_COUNT;

// Who a held control belongs to: its press went to the keys or the menu.
const NO_OWNER = 0;
const KEY_OWNER = 1;
const MENU_OWNER = 2;

function isPressed(pad: PadSnapshot, button: number): boolean {
  return pad.buttons[button]?.pressed === true;
}

/**
 * Turns pad state into key presses. The n-th connected pad plays as player
 * n+1. Only changes produce key events, and a release always sends the key
 * that was pressed, even if the bindings changed in between. Polling
 * allocates nothing after a slot's first use.
 *
 * While `menuTakesPresses`, new presses go to the `menu` sink instead of the
 * keys. Each press keeps the owner it started with until it is released, so
 * one press never both plays and steers a menu: a bomb held into the round
 * result stays a key, and an A that resumed from the pause menu never bombs.
 */
export class GamepadPoller {
  private readonly slots: { held: boolean[]; keys: string[]; owners: number[] }[] = [];

  private readonly scratch: boolean[] = new Array(CONTROL_COUNT).fill(false);

  poll(
    pads: readonly (PadSnapshot | null)[],
    keyBindings: KeyBindings,
    sink: KeySink,
    menu: PadMenuSink | null = null,
    menuTakesPresses = menu !== null
  ): void {
    const pressSink = menuTakesPresses ? menu : null;
    let slotIndex = 0;
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      if (pad && pad.connected) {
        this.applySlot(slotIndex, pad, keyBindings, sink, menu, pressSink);
        slotIndex += 1;
      }
    }
    // Slots whose pad went away release everything they still hold.
    for (let i = slotIndex; i < this.slots.length; i += 1) {
      this.applySlot(i, null, keyBindings, sink, menu, pressSink);
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
      slot.owners.fill(NO_OWNER);
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
    sink: KeySink,
    menu: PadMenuSink | null,
    pressSink: PadMenuSink | null
  ): void {
    let slot = this.slots[slotIndex];
    if (!slot) {
      slot = {
        held: new Array(CONTROL_COUNT).fill(false),
        keys: new Array(CONTROL_COUNT).fill(''),
        owners: new Array(CONTROL_COUNT).fill(NO_OWNER),
      };
      this.slots[slotIndex] = slot;
    }
    const controls = this.read(pad);
    const bindings = getPlayerBindings(keyBindings, slotIndex);
    for (let i = 0; i < CONTROL_COUNT; i += 1) {
      if (controls[i] !== slot.held[i]) {
        if (controls[i]) {
          if (pressSink) {
            slot.held[i] = true;
            slot.owners[i] = MENU_OWNER;
            pressSink(i, true, slotIndex);
          } else {
            const key = i === PAUSE_CONTROL ? PAUSE_KEY : bindings?.[i];
            if (key) {
              slot.held[i] = true;
              slot.owners[i] = KEY_OWNER;
              slot.keys[i] = key;
              sink('keydown', key);
            }
          }
        } else {
          slot.held[i] = false;
          if (slot.owners[i] === MENU_OWNER) menu?.(i, false, slotIndex);
          else sink('keyup', slot.keys[i]);
          slot.owners[i] = NO_OWNER;
        }
      }
    }
  }
}
