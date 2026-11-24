import { NoteEvent, composeBar } from './composer';
import { playDrum, playNote } from './synth';
import { INTENSE_TEMPO, MusicTheme } from './themes';

/**
 * Plays the match music: one shared AudioContext of its own, a bar of notes
 * scheduled a little ahead of the audio clock at a time, so timing never
 * depends on the frame rate. It starts only after the player's first input
 * (browsers keep audio suspended until then), and the screen pauses it with
 * the game and when the tab is hidden.
 */

/** How far ahead of the audio clock bars are scheduled, and how often it checks. */
const LOOKAHEAD = 0.25;
const TICK_MS = 50;
/** Music sits under the sound effects: full volume is this loud. */
const MAX_GAIN = 0.32;
/** How far the music dips under a blast, and how fast it comes back. */
const DUCK_TO = 0.5;
const DUCK_BACK = 0.35;

export class MusicPlayer {
  private context: AudioContext | null = null;

  private master: GainNode | null = null;

  private duck: GainNode | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;

  private theme: MusicTheme | null = null;

  private intense = false;

  private bar = 0;

  private nextBar = 0;

  private volume = 0.4;

  /** A recorded track the owner supplied (tracks.ts), looping, or null. */
  private track: HTMLAudioElement | null = null;

  private trackUrl: string | null = null;

  private trackSource: MediaElementAudioSourceNode | null = null;

  /** What plays if the track cannot. */
  private fallback: MusicTheme | null = null;

  /** Tracks that failed to load: not asked for again this page. */
  private readonly failed = new Set<string>();

  /** Call from a user gesture: creates or wakes the audio context. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
      this.duck = this.context.createGain();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * MAX_GAIN;
      this.duck.connect(this.master);
      this.master.connect(this.context.destination);
    }
    this.context.resume().catch(() => undefined);
    if (this.theme && !this.timer) this.startClock();
    this.startTrack();
  }

  /**
   * Plays a recorded track on loop instead of a theme, through the same
   * volume, dip and pause. If it cannot play, `fallback` plays instead.
   */
  playTrack(url: string, fallback: MusicTheme): void {
    if (this.failed.has(url)) {
      this.play(fallback);
      return;
    }
    if (this.trackUrl === url && this.track) return;
    this.stopTheme();
    this.stopTrack();
    this.fallback = fallback;
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    if (/^https:/i.test(url)) audio.crossOrigin = 'anonymous';
    audio.addEventListener('error', () => {
      if (this.track !== audio) return;
      this.failed.add(url);
      this.stopTrack();
      if (this.fallback) this.play(this.fallback);
    });
    audio.src = url;
    this.track = audio;
    this.trackUrl = url;
    this.startTrack();
  }

  private startTrack(): void {
    const { context, duck, track } = this;
    if (!context || !duck || !track) return;
    if (!this.trackSource) {
      this.trackSource = context.createMediaElementSource(track);
      this.trackSource.connect(duck);
    }
    if (this.master) {
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setTargetAtTime(this.volume * MAX_GAIN, context.currentTime, 0.2);
    }
    track.play().catch(() => undefined);
  }

  private stopTrack(): void {
    if (this.track) {
      this.track.pause();
      this.track.removeAttribute('src');
      this.track.load();
    }
    this.trackSource?.disconnect();
    this.track = null;
    this.trackSource = null;
    this.trackUrl = null;
  }

  private stopTheme(): void {
    this.theme = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Plays a theme from its first bar (once unlocked). */
  play(theme: MusicTheme): void {
    if (this.theme?.id === theme.id && this.timer) return;
    this.stopTrack();
    this.theme = theme;
    this.bar = 0;
    this.nextBar = 0;
    if (this.context) this.startClock();
  }

  stop(): void {
    this.stopTheme();
    this.stopTrack();
    this.fallback = null;
    // Silence what is already scheduled.
    if (this.context && this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  /** 0 to 1. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.context && this.master && this.theme) {
      this.master.gain.setTargetAtTime(this.volume * MAX_GAIN, this.context.currentTime, 0.1);
    }
  }

  /** Sudden death or an enraged boss: from the next bar, faster and higher. */
  setIntense(intense: boolean): void {
    this.intense = intense;
    // A recorded track plays a little faster (browsers keep its pitch).
    if (this.track) this.track.playbackRate = intense ? 1.06 : 1;
  }

  /** Dips the music under a blast, then brings it back. */
  dip(): void {
    if (!this.context || !this.duck) return;
    const now = this.context.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(DUCK_TO, now);
    this.duck.gain.linearRampToValueAtTime(1, now + DUCK_BACK);
  }

  /** Pauses (a paused game, a hidden tab) without losing the place. */
  suspend(): void {
    this.context?.suspend().catch(() => undefined);
    this.track?.pause();
  }

  resume(): void {
    this.context?.resume().catch(() => undefined);
    if (this.track && this.context) this.track.play().catch(() => undefined);
  }

  private startClock(): void {
    const { context, master } = this;
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(this.volume * MAX_GAIN, context.currentTime, 0.2);
    if (this.timer) clearInterval(this.timer);
    this.nextBar = Math.max(this.nextBar, context.currentTime + 0.1);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private schedule(): void {
    const { context, duck, theme } = this;
    if (!context || !duck || !theme || context.state !== 'running') return;
    // After a suspension the clock stood still; never schedule into the past.
    if (this.nextBar < context.currentTime) this.nextBar = context.currentTime + 0.05;
    while (this.nextBar < context.currentTime + LOOKAHEAD) {
      const beat = 60 / (theme.tempo * (this.intense ? INTENSE_TEMPO : 1));
      composeBar(theme, this.bar, this.intense).forEach((event) => this.voice(event, beat));
      this.nextBar += beat * theme.beatsPerBar;
      this.bar += 1;
    }
  }

  private voice(event: NoteEvent, beat: number): void {
    const { context, duck, theme } = this;
    if (!context || !duck || !theme) return;
    const at = this.nextBar + event.at * beat;
    if (event.kind === 'drum') {
      playDrum(context, duck, event.drum, at, event.velocity);
      return;
    }
    const voice = event.kind === 'lead' ? theme.lead : event.kind;
    playNote(context, duck, voice, event.midi, at, event.length * beat, event.velocity);
  }
}

/** The one player every match screen shares. */
export const musicPlayer = new MusicPlayer();
