import { ARENA_MAPS } from '../../content/arenaMaps';
import { STAGE_DEFINITIONS } from '../../content/stages';
import { FORM_BARS, composeBar } from './composer';
import {
  MUSIC_THEMES, SCALES, degreeToMidi, midiToHz, themeFor,
} from './themes';

const leadOf = (events: ReturnType<typeof composeBar>) => events.flatMap((event) => (
  event.kind === 'lead' ? [event] : []
));

describe('match music themes', () => {
  it('gives every village and city its own theme', () => {
    const ids = [...STAGE_DEFINITIONS.map((stage) => stage.id), ...ARENA_MAPS.map((map) => map.id)];
    ids.forEach((id) => {
      const theme = themeFor(id);
      expect(theme.id).toBe(id === 'romeControl' ? 'rome' : id);
    });
    // Unknown looks fall back to a theme rather than silence.
    expect(themeFor('nowhere').id).toBe('hiddenLeaf');
  });

  it('uses the Japanese scales for the villages and each city its own mode', () => {
    expect(SCALES.yo).toEqual([0, 2, 5, 7, 9]);
    expect(SCALES.in).toEqual([0, 1, 5, 7, 8]);
    expect(MUSIC_THEMES.hiddenLeaf.scale).toBe('yo');
    expect(MUSIC_THEMES.akatsukiHideout.scale).toBe('in');
    expect(MUSIC_THEMES.rome.beatsPerBar).toBe(6);
    expect(MUSIC_THEMES.budapest.scale).toBe('hungarianMinor');
    expect(midiToHz(69)).toBeCloseTo(440);
    // Degrees past the scale climb an octave.
    const leaf = MUSIC_THEMES.hiddenLeaf;
    expect(degreeToMidi(leaf, 5)).toBe(degreeToMidi(leaf, 0) + 12);
  });
});

describe('composed bars', () => {
  Object.values(MUSIC_THEMES).forEach((theme) => {
    it(`${theme.id}: stays in key and in its bar, the same every time`, () => {
      for (let bar = 0; bar < FORM_BARS; bar += 1) {
        const events = composeBar(theme, bar, false);
        expect(composeBar(theme, bar, false)).toEqual(events);
        events.forEach((event) => {
          expect(event.at).toBeGreaterThanOrEqual(0);
          expect(event.at).toBeLessThan(theme.beatsPerBar);
        });
        const lead = leadOf(events);
        expect(lead.length).toBeGreaterThan(0);
        const length = lead.reduce((sum, note) => sum + note.length, 0);
        expect(length).toBeLessThanOrEqual(theme.beatsPerBar);
        lead.forEach(({ midi }) => {
          const pitch = (((midi - theme.root) % 12) + 12) % 12;
          expect(SCALES[theme.scale]).toContain(pitch);
        });
      }
    });

    it(`${theme.id}: lifts the melody an octave and fills the drums when it gets intense`, () => {
      const calm = composeBar(theme, 1, false);
      const intense = composeBar(theme, 1, true);
      const calmLead = leadOf(calm);
      leadOf(intense).forEach((note, index) => expect(note.midi).toBe(calmLead[index].midi + 12));
      const drums = (events: typeof calm) => events.filter((event) => event.kind === 'drum').length;
      expect(drums(intense)).toBeGreaterThan(drums(calm));
    });
  });

  it('writes each theme its own tune, in an A A\' B A\'\' form that comes home', () => {
    const tune = (id: string) => Array.from({ length: FORM_BARS }, (_unused, bar) => (
      leadOf(composeBar(MUSIC_THEMES[id], bar, false))
        .map(({ at, midi }) => `${at}:${midi - MUSIC_THEMES[id].root}`)
    ).join(' ')).join('|');
    expect(tune('hiddenLeaf')).not.toBe(tune('hiddenCloud'));
    const leaf = MUSIC_THEMES.hiddenLeaf;
    const bar = (index: number) => leadOf(composeBar(leaf, index, false));
    expect(bar(2)).toEqual(bar(0));
    // The last bar ends on the root.
    const last = bar(FORM_BARS - 1);
    expect((((last[last.length - 1].midi - leaf.root) % 12) + 12) % 12).toBe(0);
  });
});
