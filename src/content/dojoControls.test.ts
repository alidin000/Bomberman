import { normalizeKeyBindings } from '../constants/props';
import { GamepadPoller, PAD_BINDING_LABELS } from '../input/gamepad';
import {
  ControlLabelSource,
  GAMEPAD_LABEL_SOURCE,
  controlPromptText,
  controlPrompts,
  keyboardLabelSource,
} from './dojoControls';

// W3C standard layout: what each printed label is as a button index.
const STANDARD_BUTTONS: Record<string, number> = {
  A: 0, B: 1, X: 2, Y: 3, 'D-pad up': 12, 'D-pad down': 13, 'D-pad left': 14, 'D-pad right': 15,
};

describe('Training Dojo control prompts', () => {
  it('name the keys the player actually bound, not the defaults', () => {
    const bindings = normalizeKeyBindings({
      1: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', ' ', 'q', 'e', 'Shift'],
    });
    const prompts = controlPrompts(
      ['move', 'bomb', 'detonate', 'cover'],
      [keyboardLabelSource(bindings), GAMEPAD_LABEL_SOURCE]
    );
    expect(prompts.map(controlPromptText)).toEqual([
      'Move: ↑ ← ↓ → or D-pad',
      'Bomb: Space or Pad A',
      'Detonate: Q or Pad B',
      'Cover: Shift or Pad X',
    ]);
  });

  it('label each pad button as the one that really presses that control', () => {
    const bindings = normalizeKeyBindings(null);
    PAD_BINDING_LABELS.forEach((label, index) => {
      const poller = new GamepadPoller();
      const pad = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
      };
      pad.buttons[STANDARD_BUTTONS[label]].pressed = true;
      const pressed: string[] = [];
      poller.poll([pad], bindings, (type, key) => pressed.push(`${type}:${key}`));
      expect(pressed).toEqual([`keydown:${bindings[1][index]}`]);
    });
  });

  it('take any further input method as one more label source', () => {
    const touch: ControlLabelSource = {
      device: 'Touch',
      label: (control) => (control === 'bomb' ? 'Bomb button' : ''),
    };
    const [bomb, move] = controlPrompts(
      ['bomb', 'move'],
      [keyboardLabelSource(normalizeKeyBindings(null)), GAMEPAD_LABEL_SOURCE, touch]
    );
    expect(controlPromptText(bomb)).toBe('Bomb: 2 or Pad A or Bomb button');
    // A source with nothing for a control is left out, not shown blank.
    expect(controlPromptText(move)).toBe('Move: W A S D or D-pad');
  });
});
