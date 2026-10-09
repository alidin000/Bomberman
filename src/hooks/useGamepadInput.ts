import { useEffect, useRef } from 'react';
import { KeyBindings } from '../constants/props';
import { registerGameplayPad } from '../input/padHub';

/**
 * Plays connected gamepads through the keyboard bindings, as window key
 * events. It costs nothing until the browser exposes a pad (the first button
 * press); only then does a per-frame poll run, and it stops once every pad
 * is gone. The poll is shared with menu navigation (src/input/padHub), which
 * takes the presses instead while the game screen claims them.
 */
export function useGamepadInput(keyBindings: KeyBindings): void {
  const bindingsRef = useRef(keyBindings);
  bindingsRef.current = keyBindings;

  useEffect(() => registerGameplayPad(bindingsRef), []);
}
