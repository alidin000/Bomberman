/**
 * Recorded music the owner supplies, instead of the generated themes:
 * `public/music/tracks.json` maps a map id (a village stage id such as
 * `hiddenLeaf`, or a city such as `rome`) to an audio file in `public/music/`,
 * with `default` for every map without its own. An https URL works too, if
 * its host allows cross-origin requests. A map with no track, or a track that
 * fails to load, plays its generated theme. See docs/MUSIC.md.
 */

export type TrackManifest = Readonly<Record<string, string>>;

/** The site serves from its root (vite.config sets no base). */
const BASE = '/';

export const TRACKS_URL = `${BASE}music/tracks.json`;

/** A file name in public/music (no folders, no way out of it) or an https URL. */
function trackUrl(value: string): string | null {
  const file = value.trim();
  if (/^https:\/\/[^\s]+$/i.test(file)) return file;
  if (/^[\w.-]+\.(mp3|ogg|oga|opus|m4a|aac|wav|webm)$/i.test(file) && !file.startsWith('.')) {
    return `${BASE}music/${file}`;
  }
  return null;
}

/** Keeps the manifest's usable entries, as URLs; anything else is dropped. */
export function parseTracks(value: unknown): TrackManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([id, file]) => {
    if (typeof file !== 'string' || !/^[\w-]+$/.test(id)) return;
    const url = trackUrl(file);
    if (url) out[id] = url;
  });
  return out;
}

/** A look's track: its own, Rome's for the Rome control, or the default; null for none. */
export function trackFor(tracks: TrackManifest, lookId: string): string | null {
  return tracks[lookId] ?? (lookId === 'romeControl' ? tracks.rome : undefined) ?? tracks.default ?? null;
}

let loading: Promise<TrackManifest> | null = null;

/** The manifest, fetched once per page; empty when it is missing or broken. */
export function loadTracks(fetcher: typeof fetch = fetch): Promise<TrackManifest> {
  if (!loading) {
    loading = fetcher(TRACKS_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : {}))
      .then(parseTracks)
      .catch(() => ({}));
  }
  return loading;
}
