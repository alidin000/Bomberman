import { parseTracks, trackFor } from './tracks';

describe('recorded tracks the owner supplies', () => {
  it('keeps file names in public/music and https URLs, and drops anything else', () => {
    const tracks = parseTracks({
      hiddenLeaf: 'leaf-theme.mp3',
      rome: 'https://cdn.example.org/rome.ogg',
      // Out of the folder, another folder, not audio, not a string, a bad key.
      hiddenSand: '../secret.mp3',
      hiddenMist: 'songs/mist.mp3',
      hiddenCloud: 'cloud.exe',
      hiddenStone: 42,
      'bad key': 'x.mp3',
      akatsukiHideout: 'http://insecure.example.org/a.mp3',
      greatShinobiWar: '.hidden.mp3',
    });
    expect(tracks).toEqual({
      hiddenLeaf: '/music/leaf-theme.mp3',
      rome: 'https://cdn.example.org/rome.ogg',
    });
    expect(parseTracks(null)).toEqual({});
    expect(parseTracks(['a.mp3'])).toEqual({});
  });

  it('plays a map\'s own track, Rome\'s for its control, then the default, else none', () => {
    const tracks = parseTracks({ hiddenLeaf: 'leaf.mp3', rome: 'rome.mp3', default: 'battle.ogg' });
    expect(trackFor(tracks, 'hiddenLeaf')).toBe('/music/leaf.mp3');
    expect(trackFor(tracks, 'romeControl')).toBe('/music/rome.mp3');
    expect(trackFor(tracks, 'budapest')).toBe('/music/battle.ogg');
    expect(trackFor(parseTracks({ hiddenLeaf: 'leaf.mp3' }), 'budapest')).toBeNull();
  });
});
