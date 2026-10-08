import { useEffect, useRef, useState } from 'react';
import { GameEngineState } from '../../engine/types';
import { GamePreferences } from './gamePreferences';

type FeedbackSnapshot = {
  tick: number;
  phase: GameEngineState['phase'];
  // Bomb id -> its cell, so a vanished bomb can be matched to its blast.
  bombCells: Map<string, string>;
  explosionCells: Set<string>;
  monsterIds: Set<string>;
  alivePlayers: Set<string>;
  pickupIds: Set<string>;
  bossHealth: number | null;
};

function snapshot(state: GameEngineState): FeedbackSnapshot {
  return {
    tick: state.tick,
    phase: state.phase,
    bombCells: new Map(state.bombs.map((bomb) => [bomb.id, `${bomb.x},${bomb.y}`])),
    explosionCells: new Set(
      state.explosions.map((cell) => `${cell.x},${cell.y},${cell.kind}`)
    ),
    // Short-lived summons fade on their own, so their exit is not a defeat.
    monsterIds: new Set(state.monsters
      .filter((monster) => monster.lifetimeMs === undefined)
      .map((monster) => monster.id)),
    alivePlayers: new Set(
      state.players.filter((player) => player.alive).map((player) => player.id)
    ),
    pickupIds: new Set(state.pickupMessages.map((message) => message.id)),
    bossHealth: state.boss?.health ?? null,
  };
}

function playTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
): void {
  if (context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function useGameFeedback(
  state: GameEngineState | null,
  preferences: GamePreferences
): { caption: string; impact: number; eventId: number } {
  const previousRef = useRef<FeedbackSnapshot | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [caption, setCaption] = useState('');
  const [impact, setImpact] = useState(0);
  const [eventId, setEventId] = useState(0);

  useEffect(() => {
    const unlock = () => {
      if (
        (!audioRef.current || audioRef.current.state === 'closed')
        && typeof AudioContext !== 'undefined'
      ) {
        audioRef.current = new AudioContext();
      }
      audioRef.current?.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const current = snapshot(state);
    const previous = previousRef.current;
    previousRef.current = current;
    // Skip comparisons across a reset: RESTART rewinds the tick, and the next
    // round starts by leaving round_end. The round number itself already
    // advances on the tick that ends a round, which must still be announced.
    if (
      !previous
      || current.tick < previous.tick
      || (previous.phase !== 'playing' && current.phase === 'playing')
    ) return;

    const newExplosions = [...current.explosionCells]
      .filter((key) => !previous.explosionCells.has(key)).length;
    // A blast always covers its bomb's own cell; a bomb crushed by sudden
    // death leaves no flame there, so it is not counted.
    const flameCells = new Set(state.explosions.map((cell) => `${cell.x},${cell.y}`));
    const detonatedBombs = [...previous.bombCells]
      .filter(([id, cell]) => !current.bombCells.has(id) && flameCells.has(cell)).length;
    const blasts = Math.max(1, detonatedBombs);
    const newBombs = [...current.bombCells.keys()]
      .filter((id) => !previous.bombCells.has(id)).length;
    const defeated = [...previous.monsterIds].filter((id) => !current.monsterIds.has(id)).length;
    const playerDown = [...previous.alivePlayers].some((id) => !current.alivePlayers.has(id));
    const bossHit = previous.bossHealth !== null
      && current.bossHealth !== null
      && current.bossHealth < previous.bossHealth;
    // By id: a repeat pickup replaces its old message, so the count can stay flat.
    const pickup = [...current.pickupIds].some((id) => !previous.pickupIds.has(id));
    const volume = (preferences.effectsVolume / 100) * 0.08;
    const audio = preferences.soundEnabled ? audioRef.current : null;

    const captions: string[] = [];
    if (newExplosions > 0) {
      captions.push(blasts > 1 ? `${blasts} blasts detonate` : 'Blast detonates');
      setImpact(Math.min(1, 0.3 + newExplosions * 0.12));
      if (audio) playTone(audio, 115, 0.24, volume * Math.min(1.8, 1 + newExplosions * 0.1), 'sawtooth');
    }
    if (playerDown) {
      captions.push('Shinobi down');
      setImpact(0.7);
      if (audio && newExplosions === 0) playTone(audio, 180, 0.42, volume, 'triangle');
    }
    if (defeated > 0) {
      captions.push(defeated > 1 ? `${defeated} enemies defeated` : 'Enemy defeated');
      if (audio && newExplosions === 0) playTone(audio, 520, 0.16, volume * 0.75, 'square');
    }
    if (bossHit) {
      captions.push('Boss hit');
      if (!playerDown) setImpact(0.45);
      if (audio && newExplosions === 0) playTone(audio, 90, 0.2, volume, 'sawtooth');
    }
    if (pickup) {
      captions.push('Power-up collected');
      if (audio && newExplosions === 0) playTone(audio, 720, 0.14, volume * 0.65, 'sine');
    }
    if (newBombs > 0 && audio && captions.length === 0) {
      playTone(audio, 260, 0.08, volume * 0.45, 'triangle');
    }
    if (captions.length > 0) {
      setCaption(captions.join('. '));
      setEventId((currentId) => currentId + 1);
    }
  }, [preferences.effectsVolume, preferences.soundEnabled, state]);

  useEffect(() => {
    if (!caption) return undefined;
    const timeout = window.setTimeout(() => setCaption(''), 1400);
    return () => window.clearTimeout(timeout);
  }, [caption, eventId]);

  useEffect(() => {
    if (impact <= 0) return undefined;
    const timeout = window.setTimeout(() => setImpact(0), 180);
    return () => window.clearTimeout(timeout);
  }, [eventId, impact]);

  return { caption: preferences.captions ? caption : '', impact, eventId };
}
