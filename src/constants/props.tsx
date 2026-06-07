import { Player } from '../model/player';

export interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onModifyControls?: () => void;
}

export type PlayerStatusProps = {
  player: Player;
  index: number;
}

export interface KeyBindings {
  [playerNumber: string]: string[];
}

export const ACTION_BINDING_LABELS = ['Bomb', 'Detonate', 'Ultimate', 'Cover'] as const;
export const KEY_BINDING_COUNT = 4 + ACTION_BINDING_LABELS.length;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  1: ['w', 'a', 's', 'd', '2', '1', '3', '4'],
  2: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'o', 'i', 'p', '['],
  3: ['u', 'h', 'j', 'k', '7', '6', '8', '9']
};

export function normalizeKeyBindings(bindings?: Partial<KeyBindings> | null): KeyBindings {
  return Object.keys(DEFAULT_KEY_BINDINGS).reduce<KeyBindings>((acc, playerNumber) => {
    const current = bindings?.[playerNumber] ?? [];
    acc[playerNumber] = DEFAULT_KEY_BINDINGS[playerNumber].map(
      (fallback, index) => current[index] ?? fallback
    );
    return acc;
  }, {});
}

export const arrowKeySymbols: { [key: string]: string } = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
};

export interface Point {
  x: number;
  y: number;
}
