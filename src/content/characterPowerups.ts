/* eslint-disable object-curly-newline, comma-dangle */
import { Power } from '../model/gameItem';
import { CharacterId } from './types';

export type CharacterPowerTheme = {
  label: string;
  shortLabel: string;
  color: string;
  accent: string;
  paper: string;
};

const DEFAULT_POWER_THEMES: Record<Power, CharacterPowerTheme> = {
  AddBomb: {
    label: '+1 Bomb Charge', shortLabel: '+Bomb', color: '#f97316', accent: '#fed7aa', paper: '#fff1d6'
  },
  BlastRangeUp: {
    label: '+Blast Radius', shortLabel: '+Blast', color: '#22c55e', accent: '#bbf7d0', paper: '#ecfccb'
  },
  Detonator: {
    label: 'Manual Release', shortLabel: 'Release', color: '#dc2626', accent: '#fed7aa', paper: '#f9e8d2'
  },
  RollerSkate: {
    label: '+Movement Speed', shortLabel: '+Speed', color: '#38bdf8', accent: '#dbeafe', paper: '#e0f2fe'
  },
  Invincibility: {
    label: 'Chakra Shield', shortLabel: 'Shield', color: '#a855f7', accent: '#ddd6fe', paper: '#ede9fe'
  },
  Ghost: {
    label: 'Phase Step', shortLabel: 'Phase', color: '#16a34a', accent: '#bbf7d0', paper: '#dcfce7'
  },
  Obstacle: {
    label: 'Barrier Drop', shortLabel: 'Barrier', color: '#a16207', accent: '#fde68a', paper: '#e7d2a6'
  },
};

const CHARACTER_POWER_THEMES: Record<CharacterId, Partial<Record<Power, CharacterPowerTheme>>> = {
  deidara: {
    AddBomb: { label: 'Clay Pouch', shortLabel: 'Clay +1', color: '#f5efe0', accent: '#f97316', paper: '#fff7ed' },
    BlastRangeUp: { label: 'C2 Blast Study', shortLabel: 'C2 Range', color: '#fb923c', accent: '#fef3c7', paper: '#fff7ed' },
    Detonator: { label: 'Art Release Seal', shortLabel: 'Release', color: '#dc2626', accent: '#fef2f2', paper: '#f8ead2' },
    RollerSkate: { label: 'Clay Bird Lift', shortLabel: 'Lift', color: '#38bdf8', accent: '#f8fafc', paper: '#e0f2fe' },
    Invincibility: { label: 'Explosive Guard', shortLabel: 'Guard', color: '#d92323', accent: '#fed7aa', paper: '#fee2e2' },
    Ghost: { label: 'Clay Substitution', shortLabel: 'Sub', color: '#c084fc', accent: '#f5efe0', paper: '#f3e8ff' },
    Obstacle: { label: 'Clay Nest', shortLabel: 'Nest', color: '#92400e', accent: '#fef3c7', paper: '#f5efe0' },
  },
  naruto: {
    AddBomb: { label: 'Clone Training', shortLabel: '+Clone', color: '#ff8a00', accent: '#fed7aa', paper: '#fff7ed' },
    BlastRangeUp: { label: 'Rasengan Mastery', shortLabel: 'Rasengan', color: '#38bdf8', accent: '#eff6ff', paper: '#dbeafe' },
    Detonator: { label: 'Clone Release', shortLabel: 'Release', color: '#f97316', accent: '#fed7aa', paper: '#ffedd5' },
    RollerSkate: { label: 'Sage Training', shortLabel: 'Sage', color: '#facc15', accent: '#111827', paper: '#fef3c7' },
    Invincibility: { label: 'Kurama Chakra', shortLabel: 'Kurama', color: '#fb923c', accent: '#7f1d1d', paper: '#ffedd5' },
    Ghost: { label: 'Toad Sage Focus', shortLabel: 'Focus', color: '#22c55e', accent: '#fef3c7', paper: '#dcfce7' },
    Obstacle: { label: 'Clone Barricade', shortLabel: 'Clone Wall', color: '#2563eb', accent: '#ffedd5', paper: '#dbeafe' },
  },
  sasuke: {
    AddBomb: { label: 'Shuriken Stock', shortLabel: '+Tool', color: '#94a3b8', accent: '#60a5fa', paper: '#e2e8f0' },
    BlastRangeUp: { label: 'Chidori Current', shortLabel: 'Chidori', color: '#60a5fa', accent: '#eff6ff', paper: '#dbeafe' },
    Detonator: { label: 'Sharingan Timing', shortLabel: 'Sharingan', color: '#ef4444', accent: '#111827', paper: '#fee2e2' },
    RollerSkate: { label: 'Body Flicker Step', shortLabel: 'Flicker', color: '#38bdf8', accent: '#111827', paper: '#e0f2fe' },
    Invincibility: { label: 'Susanoo Fragment', shortLabel: 'Susanoo', color: '#7c3aed', accent: '#c4b5fd', paper: '#ede9fe' },
    Ghost: { label: 'Curse Mark Veil', shortLabel: 'Curse', color: '#a855f7', accent: '#1e293b', paper: '#f3e8ff' },
    Obstacle: { label: 'Snake Barrier', shortLabel: 'Barrier', color: '#334155', accent: '#c4b5fd', paper: '#e2e8f0' },
  },
  gaara: {
    AddBomb: { label: 'Sand Gourd Reserve', shortLabel: '+Sand', color: '#d6a45d', accent: '#7c2d12', paper: '#f5deb3' },
    BlastRangeUp: { label: 'Desert Blessing', shortLabel: 'Desert', color: '#f59e0b', accent: '#fff7ed', paper: '#fef3c7' },
    Detonator: { label: 'Sand Coffin Seal', shortLabel: 'Coffin', color: '#92400e', accent: '#f5deb3', paper: '#e7d2a6' },
    RollerSkate: { label: 'Sand Slide', shortLabel: 'Slide', color: '#fbbf24', accent: '#78350f', paper: '#fef3c7' },
    Invincibility: { label: 'Sand Armor', shortLabel: 'Armor', color: '#c48a4a', accent: '#fff7ed', paper: '#f5deb3' },
    Ghost: { label: 'Shukaku Chakra', shortLabel: 'Shukaku', color: '#f97316', accent: '#7c2d12', paper: '#ffedd5' },
    Obstacle: { label: 'Sand Wall', shortLabel: 'Wall', color: '#a16207', accent: '#fef3c7', paper: '#e7d2a6' },
  },
  minato: {
    AddBomb: { label: 'FTG Kunai', shortLabel: 'FTG +1', color: '#facc15', accent: '#1d4ed8', paper: '#fef3c7' },
    BlastRangeUp: { label: 'Chakra Seal', shortLabel: 'Seal', color: '#60a5fa', accent: '#fef3c7', paper: '#dbeafe' },
    Detonator: { label: 'FTG Release', shortLabel: 'Release', color: '#facc15', accent: '#2563eb', paper: '#fef3c7' },
    RollerSkate: { label: 'Yellow Flash', shortLabel: 'Flash', color: '#fde047', accent: '#111827', paper: '#fef9c3' },
    Invincibility: { label: 'Hokage Cloak', shortLabel: 'Cloak', color: '#f8fafc', accent: '#f97316', paper: '#fff7ed' },
    Ghost: { label: 'Teleport Mastery', shortLabel: 'Blink', color: '#38bdf8', accent: '#facc15', paper: '#e0f2fe' },
    Obstacle: { label: 'Seal Barrier', shortLabel: 'Barrier', color: '#2563eb', accent: '#fef3c7', paper: '#dbeafe' },
  },
  itachi: {
    AddBomb: { label: 'Crow Feather', shortLabel: 'Crow +1', color: '#111827', accent: '#dc2626', paper: '#e5e7eb' },
    BlastRangeUp: { label: 'Mangekyo Ember', shortLabel: 'Ember', color: '#ef4444', accent: '#111827', paper: '#fee2e2' },
    Detonator: { label: 'Tsukuyomi Trigger', shortLabel: 'Tsukuyomi', color: '#dc2626', accent: '#f8fafc', paper: '#fee2e2' },
    RollerSkate: { label: 'Crow Step', shortLabel: 'Crow Step', color: '#64748b', accent: '#ef4444', paper: '#e2e8f0' },
    Invincibility: { label: 'Yata Mirror', shortLabel: 'Yata', color: '#f97316', accent: '#111827', paper: '#ffedd5' },
    Ghost: { label: 'Sharingan Mirage', shortLabel: 'Mirage', color: '#ef4444', accent: '#111827', paper: '#fee2e2' },
    Obstacle: { label: 'Genjutsu Snare', shortLabel: 'Snare', color: '#7f1d1d', accent: '#fca5a5', paper: '#fee2e2' },
  },
};

export function getCharacterPowerTheme(
  characterId: CharacterId | undefined,
  power: Power,
): CharacterPowerTheme {
  return CHARACTER_POWER_THEMES[characterId ?? 'deidara']?.[power]
    ?? DEFAULT_POWER_THEMES[power];
}
