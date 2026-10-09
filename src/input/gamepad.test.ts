import { DEFAULT_KEY_BINDINGS, normalizeKeyBindings } from '../constants/props';
import { GamepadPoller, PadSnapshot, PAUSE_KEY } from './gamepad';

type MutablePad = {
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean }[];
};

function createPad(): MutablePad {
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
}

function run(poller: GamepadPoller, pads: (PadSnapshot | null)[], bindings = DEFAULT_KEY_BINDINGS) {
  const events: string[] = [];
  poller.poll(pads, bindings, (type, key) => events.push(`${type}:${key}`));
  return events;
}

describe('GamepadPoller', () => {
  it('presses and releases the bound keys of the player each pad plays as', () => {
    const poller = new GamepadPoller();
    const first = createPad();
    const second = createPad();
    // A gap in the browser's pad list does not shift who plays whom.
    const pads = [first, null, second];

    first.buttons[15].pressed = true; // d-pad right
    second.buttons[0].pressed = true; // bottom face button
    expect(run(poller, pads)).toEqual(['keydown:d', 'keydown:o']);
    // Held controls send nothing more.
    expect(run(poller, pads)).toEqual([]);

    first.buttons[15].pressed = false;
    expect(run(poller, pads)).toEqual(['keyup:d']);
  });

  it('reads only the dominant stick axis and ignores drift inside the deadzone', () => {
    const poller = new GamepadPoller();
    const pad = createPad();

    pad.axes[0] = 0.3;
    pad.axes[1] = -0.2;
    expect(run(poller, [pad])).toEqual([]);

    pad.axes[0] = 0.6;
    pad.axes[1] = -0.9;
    expect(run(poller, [pad])).toEqual(['keydown:w']);

    pad.axes[0] = 0.95;
    expect(run(poller, [pad])).toEqual(['keyup:w', 'keydown:d']);
  });

  it('releases the key it pressed even after the bindings change mid-hold', () => {
    const poller = new GamepadPoller();
    const pad = createPad();
    pad.buttons[0].pressed = true;
    expect(run(poller, [pad])).toEqual(['keydown:2']);

    const remapped = normalizeKeyBindings({
      ...DEFAULT_KEY_BINDINGS,
      1: ['w', 'a', 's', 'd', ' ', '1', '3', '4'],
    });
    pad.buttons[0].pressed = false;
    expect(run(poller, [pad], remapped)).toEqual(['keyup:2']);
  });

  it('lets go of everything a pad held when it disconnects', () => {
    const poller = new GamepadPoller();
    const pad = createPad();
    pad.buttons[12].pressed = true;
    pad.buttons[9].pressed = true;
    expect(run(poller, [pad])).toEqual(['keydown:w', `keydown:${PAUSE_KEY}`]);

    expect(run(poller, [])).toEqual(['keyup:w', `keyup:${PAUSE_KEY}`]);
  });

  it('presses held controls again after a reset', () => {
    const poller = new GamepadPoller();
    const pad = createPad();
    pad.buttons[14].pressed = true;
    expect(run(poller, [pad])).toEqual(['keydown:a']);

    poller.reset();
    expect(run(poller, [pad])).toEqual(['keydown:a']);
  });

  it('keeps each press with whoever got it, game keys or menu, until it is let go', () => {
    const poller = new GamepadPoller();
    const pad = createPad();
    const events: string[] = [];
    const poll = (menuTakesPresses: boolean) => poller.poll(
      [pad],
      DEFAULT_KEY_BINDINGS,
      (type, key) => events.push(`${type}:${key}`),
      (control, pressed) => events.push(`menu:${control}:${pressed ? 'down' : 'up'}`),
      menuTakesPresses
    );

    pad.buttons[0].pressed = true; // bomb, in play
    poll(false);
    // The round ends with it still held; the menu now takes new presses.
    pad.buttons[15].pressed = true; // d-pad right
    poll(true);
    poll(true);
    // Play resumes while right is still held.
    pad.buttons[0].pressed = false;
    poll(false);
    pad.buttons[15].pressed = false;
    poll(false);

    // The bomb never reached the menu, and the menu's press never walked.
    expect(events).toEqual(['keydown:2', 'menu:3:down', 'keyup:2', 'menu:3:up']);
  });
});
