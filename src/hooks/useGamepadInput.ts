import { useEffect, useRef } from 'react';
import { KeyBindings } from '../constants/props';
import { GamepadPoller, KeySink, PadSnapshot } from '../input/gamepad';

const NO_PADS: readonly (PadSnapshot | null)[] = [];

function readPads(): readonly (PadSnapshot | null)[] {
  return navigator.getGamepads?.() ?? NO_PADS;
}

function hasConnectedPad(pads: readonly (PadSnapshot | null)[]): boolean {
  for (let i = 0; i < pads.length; i += 1) {
    if (pads[i]?.connected) return true;
  }
  return false;
}

// Window key events, so the engine's keyboard handlers and the screen's
// Escape (pause) handler treat a pad exactly like the bound keys.
const sendKey: KeySink = (type, key) => {
  window.dispatchEvent(new KeyboardEvent(type, { key }));
};

/**
 * Plays connected gamepads through the keyboard bindings. It costs nothing
 * until the browser exposes a pad (the first button press); only then does a
 * per-frame poll run, and it stops once every pad is gone.
 */
export function useGamepadInput(keyBindings: KeyBindings): void {
  const bindingsRef = useRef(keyBindings);
  bindingsRef.current = keyBindings;

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return undefined;
    }
    const poller = new GamepadPoller();
    let frame: number | undefined;
    // Keyboard movement is dropped on blur; held pad controls press again
    // once the window has focus back.
    let suspended = false;

    const poll = () => {
      const pads = readPads();
      if (!suspended) poller.poll(pads, bindingsRef.current, sendKey);
      frame = hasConnectedPad(pads) ? requestAnimationFrame(poll) : undefined;
    };
    const start = () => {
      if (frame === undefined) frame = requestAnimationFrame(poll);
    };
    const handleBlur = () => {
      suspended = true;
      poller.reset();
    };
    const handleFocus = () => {
      suspended = false;
    };

    window.addEventListener('gamepadconnected', start);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    // A pad already pressed on an earlier screen stays exposed.
    if (hasConnectedPad(readPads())) start();

    return () => {
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
}
