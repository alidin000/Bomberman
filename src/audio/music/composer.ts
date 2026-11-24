import { nextRandom, normalizeSeed } from '../../engine/random';
import {
  MusicTheme, SCALES, degreeToMidi,
} from './themes';

/**
 * The music's notes, one bar at a time, as plain data: pure and deterministic
 * (the same theme, bar and intensity always give the same notes), so it is
 * tested without audio. Melodies are walked from a seed per theme, in an
 * eight-bar form (A A' B A''), so each map has its own original tune.
 */

export type Drum = 'taiko' | 'shime' | 'rim' | 'clap' | 'shaker';

export type NoteEvent =
  | { kind: 'lead' | 'bass' | 'pad'; at: number; length: number; midi: number; velocity: number }
  | { kind: 'drum'; at: number; drum: Drum; velocity: number };

/** Bars in one pass of a theme's form. */
export const FORM_BARS = 8;

/** A seeded draw per call, from the engine's generator (src/engine/random.ts). */
function random(seedText: string): () => number {
  let seed = normalizeSeed(
    Array.from(seedText).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 2147483647, 7)
  );
  return () => {
    const draw = nextRandom(seed);
    seed = draw.seed;
    return draw.value;
  };
}

type Phrase = { at: number; length: number; degree: number }[];

const RHYTHMS: Readonly<Record<number, readonly (readonly number[])[]>> = {
  4: [
    [1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2],
    [1, 0.5, 0.5, 2], [2, 1, 1], [0.5, 0.5, 0.5, 0.5, 2],
  ],
  6: [[3, 3], [2, 1, 2, 1], [1, 1, 1, 3], [2, 1, 3], [1, 1, 1, 1, 1, 1]],
};

const FORMS = new Map<string, Phrase[]>();

/** A theme's eight bars of melody, walked once from its seed and kept. */
function melody(theme: MusicTheme): Phrase[] {
  const cached = FORMS.get(theme.id);
  if (cached) return cached;
  const rnd = random(`music|${theme.id}`);
  const steps = SCALES[theme.scale].length;
  const rhythms = RHYTHMS[theme.beatsPerBar] ?? RHYTHMS[4];
  let degree = 2 + Math.floor(rnd() * 3);
  const bar = (): Phrase => {
    const rhythm = rhythms[Math.floor(rnd() * rhythms.length)];
    let at = 0;
    return rhythm.map((length) => {
      // Mostly steps, now and then a leap; kept within two octaves.
      const move = rnd();
      let step = 2;
      if (move < 0.4) step = 1;
      else if (move < 0.8) step = -1;
      else if (move < 0.9) step = -2;
      degree = Math.min(steps * 2, Math.max(0, degree + step));
      const note = { at, length, degree };
      at += length;
      return note;
    });
  };
  const [a1, a2, b1, b2] = [bar(), bar(), bar(), bar()];
  // A cadence: the phrase's last note comes home to the root (or its octave).
  const resolve = (phrase: Phrase, home: number): Phrase => phrase.map((note, index) => (
    index === phrase.length - 1 ? { ...note, degree: home } : note
  ));
  const form = [a1, a2, a1, resolve(a2, steps), b1, b2, a1, resolve(a2, 0)];
  FORMS.set(theme.id, form);
  return form;
}

/** The bass line's chord roots through the form, as scale degrees. */
const PROGRESSION = [0, 0, 2, 3, 0, 2, 3, 0];

function drums(theme: MusicTheme, intense: boolean): NoteEvent[] {
  const hit = (at: number, drum: Drum, velocity: number): NoteEvent => ({
    kind: 'drum', at, drum, velocity,
  });
  const out: NoteEvent[] = [];
  switch (theme.groove) {
    case 'taiko':
      out.push(hit(0, 'taiko', 1), hit(2, 'taiko', 0.8), hit(1, 'rim', 0.35), hit(3, 'rim', 0.35));
      for (let at = 0; at < 4; at += 0.5) out.push(hit(at, 'shime', at % 1 === 0 ? 0.4 : 0.22));
      if (intense) {
        out.push(hit(3.5, 'taiko', 0.75));
        for (let at = 3; at < 4; at += 0.25) out.push(hit(at, 'shime', 0.3));
      }
      break;
    case 'cave':
      out.push(hit(0, 'taiko', 0.9), hit(1.5, 'shime', 0.2), hit(3, 'shime', 0.2), hit(2.5, 'rim', 0.25));
      if (intense) {
        out.push(hit(2, 'taiko', 0.8));
        for (let at = 0; at < 4; at += 0.5) out.push(hit(at, 'shime', 0.25));
      }
      break;
    case 'tarantella':
      for (let at = 0; at < 6; at += intense ? 0.5 : 1) {
        out.push(hit(at, 'shaker', at % 3 === 0 ? 0.5 : 0.28));
      }
      out.push(hit(0, 'clap', 0.3), hit(3, 'clap', 0.3));
      break;
    case 'flamenco':
      [0.5, 1.5, 2.5, 3].forEach((at) => out.push(hit(at, 'clap', 0.38)));
      out.push(hit(2, 'rim', 0.3));
      if (intense) [0, 1, 2, 3.5].forEach((at) => out.push(hit(at, 'clap', 0.3)));
      break;
    default:
      // A csárdás: shaker on the off-beats, claps when it speeds up.
      [0.5, 1.5, 2.5, 3.5].forEach((at) => out.push(hit(at, 'shaker', 0.3)));
      if (intense) [1, 3].forEach((at) => out.push(hit(at, 'clap', 0.35)));
  }
  return out;
}

function bass(theme: MusicTheme, bar: number): NoteEvent[] {
  const chord = PROGRESSION[bar % PROGRESSION.length];
  const root = degreeToMidi(theme, chord) - 24;
  const fifth = degreeToMidi(theme, chord + 2) - 24;
  const note = (at: number, midi: number, length: number, velocity: number): NoteEvent => ({
    kind: 'bass', at, length, midi, velocity,
  });
  switch (theme.groove) {
    case 'cave':
      return [{
        kind: 'pad', at: 0, length: theme.beatsPerBar, midi: root, velocity: 0.22
      }];
    case 'tarantella':
      return [note(0, root, 1, 0.5), note(3, fifth, 1, 0.45)];
    case 'csardas': {
      // Oom-pah: bass on the beat, a short chord stab between.
      const stab = (at: number): NoteEvent[] => [
        {
          kind: 'pad', at, length: 0.4, midi: degreeToMidi(theme, chord + 2) - 12, velocity: 0.2
        },
        {
          kind: 'pad', at, length: 0.4, midi: degreeToMidi(theme, chord + 4) - 12, velocity: 0.18
        },
      ];
      return [note(0, root, 0.8, 0.5), ...stab(1), note(2, fifth, 0.8, 0.45), ...stab(3)];
    }
    default:
      return [note(0, root, 1.5, 0.45), note(2, fifth, 1.5, 0.4)];
  }
}

/**
 * One bar of a theme: its melody, bass and drums. `intense` (sudden death,
 * an enraged boss) lifts the melody an octave and fills the drums.
 */
export function composeBar(theme: MusicTheme, bar: number, intense: boolean): NoteEvent[] {
  const phrase = melody(theme)[((bar % FORM_BARS) + FORM_BARS) % FORM_BARS];
  const lift = intense ? 12 : 0;
  const lead: NoteEvent[] = phrase.map(({ at, length, degree }) => ({
    kind: 'lead', at, length, midi: degreeToMidi(theme, degree) + lift, velocity: 0.55,
  }));
  return [...lead, ...bass(theme, bar), ...drums(theme, intense)];
}
