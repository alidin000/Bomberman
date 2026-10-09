import { KeyBindings, arrowKeySymbols } from '../constants/props';
import { PAD_BINDING_LABELS } from '../input/gamepad';

// Control prompts for the Training Dojo, read from the player's real input
// mappings. Each input method is a ControlLabelSource that names a control
// from its own mapping; the prompt lists one label per source. A future
// input (touch) plugs in by adding a source, so no prompt text changes.

export type DojoControl = 'move' | 'bomb' | 'detonate' | 'ultimate' | 'cover';

export const DOJO_CONTROL_NAMES: Record<DojoControl, string> = {
  move: 'Move',
  bomb: 'Bomb',
  detonate: 'Detonate',
  ultimate: 'Ultimate',
  cover: 'Cover',
};

// Index of each action in a player's key bindings (and in PAD_BINDING_LABELS).
const ACTION_BINDING_INDEX: Record<Exclude<DojoControl, 'move'>, number> = {
  bomb: 4,
  detonate: 5,
  ultimate: 6,
  cover: 7,
};

export interface ControlLabelSource {
  /** "Keyboard", "Gamepad": read to screen readers before the label. */
  device: string;
  label(control: DojoControl): string;
}

export function formatKeyName(key: string): string {
  if (arrowKeySymbols[key]) return arrowKeySymbols[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

/** The keys one player has bound (1-based player number). */
export function keyboardLabelSource(
  keyBindings: KeyBindings,
  playerNumber = 1
): ControlLabelSource {
  const bindings = keyBindings[String(playerNumber)] ?? [];
  return {
    device: 'Keyboard',
    label: (control) => {
      if (control === 'move') return bindings.slice(0, 4).map(formatKeyName).join(' ');
      return formatKeyName(bindings[ACTION_BINDING_INDEX[control]] ?? '');
    },
  };
}

/** A pad's fixed layout (input/gamepad.ts presses the bound keys with it). */
export const GAMEPAD_LABEL_SOURCE: ControlLabelSource = {
  device: 'Gamepad',
  label: (control) => (
    control === 'move' ? 'D-pad' : `Pad ${PAD_BINDING_LABELS[ACTION_BINDING_INDEX[control]]}`
  ),
};

export interface ControlPrompt {
  control: DojoControl;
  name: string;
  /** One label per source, in source order; empty labels are left out. */
  labels: { device: string; text: string }[];
}

export function controlPrompts(
  controls: readonly DojoControl[],
  sources: readonly ControlLabelSource[]
): ControlPrompt[] {
  return controls.map((control) => ({
    control,
    name: DOJO_CONTROL_NAMES[control],
    labels: sources
      .map((source) => ({ device: source.device, text: source.label(control) }))
      .filter((label) => label.text.trim() !== ''),
  }));
}

/** "Bomb: 2 or Pad A", for screen readers and plain-text prompts. */
export function controlPromptText(prompt: ControlPrompt): string {
  return `${prompt.name}: ${prompt.labels.map((label) => label.text).join(' or ')}`;
}
