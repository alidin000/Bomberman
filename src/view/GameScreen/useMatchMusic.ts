import { useEffect } from 'react';
import type { EngineStore } from '../../hooks/engineStore';
import { getRoundTimeRemainingMs, isSuddenDeathMode } from '../../engine/suddenDeath';
import type { GameEngineState } from '../../engine/types';
import { musicPlayer } from '../../audio/music/musicPlayer';
import { themeFor } from '../../audio/music/themes';
import { TrackManifest, loadTracks, trackFor } from '../../audio/music/tracks';
import { sceneLookFor } from './scene/arenaScene';
import { GamePreferences } from './gamePreferences';

/** Sudden death has begun, or the boss is enraged: the music lifts. */
export function musicIntense(state: GameEngineState): boolean {
  const clock = isSuddenDeathMode(state) ? getRoundTimeRemainingMs(state) : null;
  const boss = state.boss !== null && state.boss.phase > 1 && state.boss.health > 0;
  return (clock !== null && clock <= 0) || boss;
}

/**
 * The match music for a screen's engine: the map's theme, from the first
 * input (browsers hold audio until one), lifted in sudden death and for an
 * enraged boss, dipped under blasts, paused with the game and while the tab is
 * hidden, and stopped when the screen goes. Silent with sound or music off.
 */
export function useMatchMusic(store: EngineStore, preferences: GamePreferences) {
  const on = preferences.soundEnabled && preferences.musicEnabled && preferences.musicVolume > 0;

  useEffect(() => {
    musicPlayer.setVolume(preferences.musicVolume / 100);
  }, [preferences.musicVolume]);

  useEffect(() => {
    if (!on) {
      musicPlayer.stop();
      return undefined;
    }
    const unlock = () => musicPlayer.unlock();
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    events.forEach((name) => window.addEventListener(name, unlock));
    const visibility = () => (document.hidden ? musicPlayer.suspend() : musicPlayer.resume());
    document.addEventListener('visibilitychange', visibility);
    let explosions = 0;
    let paused = false;
    // The owner's recorded tracks, if any (public/music/tracks.json).
    let tracks: TrackManifest | null = null;
    let alive = true;
    const observe = () => {
      const state = store.getState();
      if (!state || !tracks) return;
      const { lookId } = sceneLookFor(state.config);
      const theme = themeFor(lookId);
      const track = trackFor(tracks, lookId);
      if (track) musicPlayer.playTrack(track, theme);
      else musicPlayer.play(theme);
      musicPlayer.setIntense(musicIntense(state));
      if (state.paused !== paused) {
        paused = state.paused;
        if (paused) musicPlayer.suspend();
        else if (!document.hidden) musicPlayer.resume();
      }
      if (state.explosions.length > explosions) musicPlayer.dip();
      explosions = state.explosions.length;
    };
    loadTracks().then((manifest) => {
      if (!alive) return;
      tracks = manifest;
      observe();
      // The click that started the match already counts as an input.
      unlock();
    });
    const unsubscribe = store.subscribe(observe);
    return () => {
      alive = false;
      unsubscribe();
      events.forEach((name) => window.removeEventListener(name, unlock));
      document.removeEventListener('visibilitychange', visibility);
      musicPlayer.stop();
    };
  }, [on, store]);
}
