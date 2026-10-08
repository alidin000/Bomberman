import { Player } from '../model/player';
import { GamePreferences } from '../view/GameScreen/gamePreferences';

export interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onModifyControls?: () => void;
  preferences: GamePreferences;
  onPreferencesChange: (preferences: GamePreferences) => void;
}

export type PlayerStatusProps = {
  player: Player;
  index: number;
}

export interface KeyBindings {
  [playerNumber: string]: string[];
}

export const MOVEMENT_BINDING_LABELS = ['Up', 'Left', 'Down', 'Right'] as const;
export const ACTION_BINDING_LABELS = ['Bomb', 'Detonate', 'Ultimate', 'Cover'] as const;
export const KEY_BINDING_COUNT = MOVEMENT_BINDING_LABELS.length + ACTION_BINDING_LABELS.length;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  1: ['w', 'a', 's', 'd', '2', '1', '3', '4'],
  2: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'o', 'i', 'p', '['],
  3: ['u', 'h', 'j', 'k', '7', '6', '8', '9']
};

export function normalizeKeyBindings(bindings?: Partial<KeyBindings> | null): KeyBindings {
  return Object.keys(DEFAULT_KEY_BINDINGS).reduce<KeyBindings>((acc, playerNumber) => {
    const current = bindings?.[playerNumber] ?? [];
    // Stored bindings are user data: anything but a key name falls back.
    acc[playerNumber] = DEFAULT_KEY_BINDINGS[playerNumber].map(
      (fallback, index) => (typeof current[index] === 'string' ? current[index] : fallback)
    );
    return acc;
  }, {});
}

export const arrowKeySymbols: { [key: string]: string } = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space'
};

export interface Point {
  x: number;
  y: number;
}
