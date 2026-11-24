import type { Drum } from './composer';
import { LeadVoice, midiToHz } from './themes';

/**
 * The music's instruments, built from WebAudio nodes at play time: no
 * samples. Plucked strings (koto, shamisen, mandolin) are rendered once per
 * note into a buffer (Karplus-Strong), the rest are oscillators and noise.
 */

const NOISE = new WeakMap<BaseAudioContext, AudioBuffer>();
const PLUCKS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function noise(context: BaseAudioContext): AudioBuffer {
  let buffer = NOISE.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    NOISE.set(context, buffer);
  }
  return buffer;
}

/** An envelope on a fresh gain node: a quick attack, then a fall to silence. */
function envelope(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  peak: number,
  attack: number,
  hold: number,
  release: number
): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  gain.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  gain.connect(out);
  return gain;
}

function noiseBurst(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  length: number,
  filter: BiquadFilterType,
  frequency: number,
  peak: number
) {
  const source = context.createBufferSource();
  source.buffer = noise(context);
  const band = context.createBiquadFilter();
  band.type = filter;
  band.frequency.value = frequency;
  source.connect(band);
  band.connect(envelope(context, out, at, peak, 0.002, 0, length));
  source.start(at, Math.random() * 0.5, length + 0.05);
}

/** A drum hit: taiko and shime are pitched skins with a click; the rest is noise. */
export function playDrum(
  context: BaseAudioContext,
  out: AudioNode,
  drum: Drum,
  at: number,
  velocity: number
) {
  if (drum === 'taiko' || drum === 'shime') {
    const taiko = drum === 'taiko';
    const skin = context.createOscillator();
    skin.type = 'sine';
    const start = taiko ? 92 : 260;
    skin.frequency.setValueAtTime(start, at);
    skin.frequency.exponentialRampToValueAtTime(start * 0.55, at + (taiko ? 0.35 : 0.08));
    const peak = velocity * (taiko ? 0.9 : 0.35);
    skin.connect(envelope(context, out, at, peak, 0.004, 0, taiko ? 0.45 : 0.1));
    skin.start(at);
    skin.stop(at + 0.6);
    noiseBurst(context, out, at, 0.03, 'lowpass', taiko ? 900 : 3000, velocity * 0.18);
    return;
  }
  if (drum === 'rim') noiseBurst(context, out, at, 0.04, 'bandpass', 2400, velocity * 0.4);
  if (drum === 'clap') noiseBurst(context, out, at, 0.07, 'bandpass', 1500, velocity * 0.5);
  if (drum === 'shaker') noiseBurst(context, out, at, 0.05, 'highpass', 6000, velocity * 0.3);
}

/** A plucked string, rendered once per note and voice (Karplus-Strong). */
function pluckBuffer(context: BaseAudioContext, midi: number, voice: LeadVoice): AudioBuffer {
  let cache = PLUCKS.get(context);
  if (!cache) {
    cache = new Map();
    PLUCKS.set(context, cache);
  }
  const key = `${voice}|${midi}`;
  let buffer = cache.get(key);
  if (buffer) return buffer;
  const rate = context.sampleRate;
  const seconds = voice === 'koto' ? 1.6 : 0.8;
  buffer = context.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / midiToHz(midi)));
  const ring = new Float32Array(period);
  for (let index = 0; index < period; index += 1) ring[index] = Math.random() * 2 - 1;
  // A shamisen's bright buzz (sawari) decays less smoothly than a koto's.
  const damping = voice === 'koto' ? 0.996 : 0.99;
  for (let index = 0; index < data.length; index += 1) {
    const at = index % period;
    const next = ring[(at + 1) % period];
    const value = ring[at];
    data[index] = value;
    ring[at] = damping * 0.5 * (value + next) + (voice === 'shamisen' ? (Math.random() - 0.5) * 0.002 : 0);
  }
  cache.set(key, buffer);
  return buffer;
}

/** A melodic note on the theme's lead voice, or the bass, or a soft pad. */
export function playNote(
  context: BaseAudioContext,
  out: AudioNode,
  voice: LeadVoice | 'bass' | 'pad',
  midi: number,
  at: number,
  length: number,
  velocity: number
) {
  const frequency = midiToHz(midi);
  if (voice === 'koto' || voice === 'shamisen' || voice === 'mandolin') {
    // A mandolin holds a long note as a tremolo of quick plucks.
    const tremolo = 0.09;
    const strikes = voice === 'mandolin' && length >= 0.3 ? Math.min(16, Math.floor(length / tremolo)) : 1;
    for (let strike = 0; strike < strikes; strike += 1) {
      const source = context.createBufferSource();
      source.buffer = pluckBuffer(context, midi, voice === 'mandolin' ? 'shamisen' : voice);
      const gain = context.createGain();
      gain.gain.value = velocity * (strike ? 0.55 : 0.8);
      source.connect(gain);
      gain.connect(out);
      source.start(at + strike * tremolo);
    }
    return;
  }
  const oscillator = context.createOscillator();
  if (voice === 'bass') oscillator.type = 'triangle';
  else if (voice === 'violin') oscillator.type = 'sawtooth';
  else oscillator.type = voice === 'pad' ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(frequency, at);
  let node: AudioNode = oscillator;
  if (voice === 'violin' || voice === 'bass') {
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = voice === 'violin' ? 2200 : 500;
    oscillator.connect(tone);
    node = tone;
  }
  if (voice === 'flute' || voice === 'violin') {
    // Vibrato that comes in after the attack, as a player would add it.
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(frequency * 0.008, at + Math.min(0.25, length * 0.5));
    lfo.connect(depth);
    depth.connect(oscillator.frequency);
    lfo.start(at);
    lfo.stop(at + length + 0.3);
  }
  const attack = voice === 'pad' ? 0.3 : 0.04;
  const release = voice === 'pad' ? 0.5 : 0.12;
  const peak = velocity * (voice === 'pad' ? 0.35 : 0.5);
  node.connect(envelope(context, out, at, peak, attack, Math.max(0, length - attack), release));
  oscillator.start(at);
  oscillator.stop(at + length + release + 0.05);
  if (voice === 'flute') noiseBurst(context, out, at, 0.08, 'bandpass', frequency * 2, velocity * 0.05);
}
