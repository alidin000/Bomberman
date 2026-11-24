/**
 * The match music's themes: original, generated in the browser (no recorded
 * tracks, no samples, nothing to license). Each map has a scale, a tempo, a
 * lead voice and a groove; composer.ts writes its melodies from a seed, so
 * every theme is its own tune and none copies an existing one.
 */

export type ScaleName =
  | 'yo' | 'in' | 'hirajoshi' | 'minor' | 'phrygianDominant' | 'hungarianMinor';

/** Semitones above the root, one octave. */
export const SCALES: Readonly<Record<ScaleName, readonly number[]>> = {
  // Japanese folk pentatonic, bright (steps 2-3-2-2-3).
  yo: [0, 2, 5, 7, 9],
  // Miyako-bushi, the koto and shamisen scale: dark, with half steps.
  in: [0, 1, 5, 7, 8],
  hirajoshi: [0, 2, 3, 7, 8],
  minor: [0, 2, 3, 5, 7, 8, 10],
  // Spanish cadences (Barcelona).
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  // Hungarian minor, for a csárdás (Budapest).
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
};

export type LeadVoice = 'flute' | 'koto' | 'shamisen' | 'mandolin' | 'violin';
export type Groove = 'taiko' | 'cave' | 'tarantella' | 'flamenco' | 'csardas';

export interface MusicTheme {
  id: string;
  /** Beats per minute at normal intensity. */
  tempo: number;
  beatsPerBar: number;
  scale: ScaleName;
  /** MIDI note of the scale's root, for the lead. */
  root: number;
  lead: LeadVoice;
  groove: Groove;
}

const village = (
  id: string,
  tempo: number,
  scale: ScaleName,
  root: number,
  lead: LeadVoice,
  groove: Groove = 'taiko'
): MusicTheme => ({
  id, tempo, beatsPerBar: 4, scale, root, lead, groove,
});

export const MUSIC_THEMES: Readonly<Record<string, MusicTheme>> = {
  hiddenLeaf: village('hiddenLeaf', 112, 'yo', 62, 'flute'),
  hiddenSand: village('hiddenSand', 100, 'hirajoshi', 60, 'shamisen'),
  hiddenMist: village('hiddenMist', 90, 'in', 62, 'koto', 'cave'),
  hiddenCloud: village('hiddenCloud', 118, 'yo', 64, 'koto'),
  hiddenStone: village('hiddenStone', 104, 'yo', 57, 'shamisen'),
  akatsukiHideout: village('akatsukiHideout', 86, 'in', 57, 'flute', 'cave'),
  greatShinobiWar: village('greatShinobiWar', 128, 'in', 60, 'shamisen'),
  // A tarantella in 6/8 (six eighths a bar).
  rome: {
    id: 'rome', tempo: 252, beatsPerBar: 6, scale: 'minor', root: 69, lead: 'mandolin', groove: 'tarantella',
  },
  barcelona: {
    id: 'barcelona', tempo: 108, beatsPerBar: 4, scale: 'phrygianDominant', root: 64, lead: 'mandolin', groove: 'flamenco',
  },
  budapest: {
    id: 'budapest', tempo: 100, beatsPerBar: 4, scale: 'hungarianMinor', root: 62, lead: 'violin', groove: 'csardas',
  },
};

/** The theme for a look (a village stage or a city), Leaf's for anything else. */
export function themeFor(lookId: string): MusicTheme {
  if (lookId === 'romeControl') return MUSIC_THEMES.rome;
  return MUSIC_THEMES[lookId] ?? MUSIC_THEMES.hiddenLeaf;
}

/** Sudden death and an enraged boss: faster and higher. */
export const INTENSE_TEMPO = 1.12;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The MIDI note of a scale degree; degrees past the scale climb octaves. */
export function degreeToMidi(theme: MusicTheme, degree: number): number {
  const steps = SCALES[theme.scale];
  const octave = Math.floor(degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;
  return theme.root + octave * 12 + steps[index];
}
