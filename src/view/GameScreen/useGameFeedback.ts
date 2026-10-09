import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { GameEngineState } from '../../engine/types';
import type { EngineStore } from '../../hooks/engineStore';
import { differsOnlyInPlayerMotion } from '../../hooks/useRenderState';
import { getRoundTimeRemainingMs, isSuddenDeathMode } from '../../engine/suddenDeath';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import { GamePreferences } from './gamePreferences';
import { playerSlotLabel } from './playerSlots';
import { composeCaption, knockoutCaption, SUDDEN_DEATH_LEAD_MS } from './matchCopy';

// Clock milestones worth a caption (and a screen-reader announcement, since
// the clock itself is role="timer" and stays silent).
const CLOCK_MILESTONES_MS = [30000, 15000];

type FeedbackSnapshot = {
  tick: number;
  phase: GameEngineState['phase'];
  // Bomb id -> its cell.
  bombCells: Map<string, string>;
  explosionCells: Set<string>;
  monsterIds: Set<string>;
  alivePlayers: Set<string>;
  pickupIds: Set<string>;
  bossHealth: number | null;
  bossPhase: number | null;
  bossName: string;
  // Versus only: time left on the round clock; null in the campaign.
  clockMs: number | null;
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
    bossPhase: state.boss?.phase ?? null,
    bossName: state.boss?.name ?? '',
    clockMs: isSuddenDeathMode(state) ? getRoundTimeRemainingMs(state) : null,
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

type GameFeedback = { caption: string; impact: number; eventId: number };

/** Compares each state it is shown with the one before and plays what happened. */
function useFeedbackCore(
  preferences: GamePreferences
): { observe: (state: GameEngineState | null) => void; feedback: GameFeedback } {
  const previousRef = useRef<FeedbackSnapshot | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [caption, setCaption] = useState('');
  const [impact, setImpact] = useState(0);
  const [eventId, setEventId] = useState(0);
  // Read when an event plays, so a volume change does not re-run anything.
  const soundRef = useRef(preferences);
  soundRef.current = preferences;

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

  const observe = useCallback((state: GameEngineState | null) => {
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
    const newBombs = [...current.bombCells.keys()]
      .filter((id) => !previous.bombCells.has(id)).length;
    const defeated = [...previous.monsterIds].filter((id) => !current.monsterIds.has(id)).length;
    const fallen = [...previous.alivePlayers].filter((id) => !current.alivePlayers.has(id));
    const playerDown = fallen.length > 0;
    const bossHit = previous.bossHealth !== null
      && current.bossHealth !== null
      && current.bossHealth < previous.bossHealth;
    // The arena opened: the boss's entrance (the scene plays its roar pose).
    const bossAppeared = previous.bossHealth === null && current.bossHealth !== null;
    const bossEnraged = previous.bossPhase !== null
      && current.bossPhase !== null
      && current.bossPhase > previous.bossPhase
      && (current.bossHealth ?? 0) > 0;
    // By id: a repeat pickup replaces its old message, so the count can stay flat.
    const newPickups = state.pickupMessages
      .filter((message) => !previous.pickupIds.has(message.id));
    const pickup = newPickups.length > 0;
    const previousClock = previous.clockMs;
    const currentClock = current.clockMs;
    const clockRunning = previousClock !== null && currentClock !== null;
    const clockMilestone = clockRunning
      ? CLOCK_MILESTONES_MS.find((mark) => previousClock > mark && currentClock <= mark)
      : undefined;
    const suddenDeathLeadIn = clockRunning
      && previousClock > SUDDEN_DEATH_LEAD_MS && currentClock <= SUDDEN_DEATH_LEAD_MS;
    const suddenDeath = clockRunning && previousClock > 0 && currentClock <= 0;
    const { effectsVolume, soundEnabled } = soundRef.current;
    const volume = (effectsVolume / 100) * 0.08;
    const audio = soundEnabled ? audioRef.current : null;

    // Captions in priority order, one line of 40 characters or fewer
    // (composeCaption). Blasts get the shake and a tone, not a caption: they
    // are on screen already, and "Blast detonates" filled every second.
    const captions: string[] = [];
    if (newExplosions > 0) {
      setImpact(Math.min(1, 0.3 + newExplosions * 0.12));
      if (audio) playTone(audio, 115, 0.24, volume * Math.min(1.8, 1 + newExplosions * 0.1), 'sawtooth');
    }
    if (playerDown) {
      // Who went down and whose blast it was, by slot: "P2 Itachi's blast
      // caught P1 Gaara".
      captions.push(knockoutCaption(state, fallen));
      setImpact(0.7);
      if (audio && newExplosions === 0) playTone(audio, 180, 0.42, volume, 'triangle');
    }
    if (suddenDeath) {
      captions.push('Sudden death · walls closing');
      if (audio && newExplosions === 0) playTone(audio, 150, 0.5, volume, 'square');
    } else if (suddenDeathLeadIn) {
      captions.push(`Sudden death in ${SUDDEN_DEATH_LEAD_MS / 1000}`);
      if (audio && newExplosions === 0) playTone(audio, 330, 0.16, volume * 0.7, 'square');
    } else if (clockMilestone !== undefined) {
      captions.push(`${clockMilestone / 1000} seconds left`);
      if (audio && newExplosions === 0) playTone(audio, 440, 0.12, volume * 0.6, 'triangle');
    }
    if (bossAppeared) {
      captions.push(`${current.bossName} enters the arena`);
      // A low growl: the roar, as sound (the screen does not shake for it).
      if (audio) playTone(audio, 72, 0.7, volume * 1.2, 'sawtooth');
    }
    if (bossEnraged) {
      captions.push(`${current.bossName} enrages · phase ${current.bossPhase}`);
      if (audio && newExplosions === 0) playTone(audio, 64, 0.5, volume, 'sawtooth');
    }
    if (bossHit) {
      captions.push('Boss hit');
      if (!playerDown) setImpact(0.45);
      if (audio && newExplosions === 0) playTone(audio, 90, 0.2, volume, 'sawtooth');
    }
    if (pickup) {
      // Name the power: the generic "Power-up collected" never said what changed.
      captions.push(newPickups.map((message) => {
        const slot = state.players.findIndex((player) => player.id === message.playerId);
        const characterId = state.players[slot]?.characterId;
        const label = characterId
          ? getCharacterPowerTheme(characterId, message.power).label
          : 'Power-up';
        return `${slot >= 0 ? playerSlotLabel(slot) : 'Shinobi'} ${label}`;
      }).join(', '));
      if (audio && newExplosions === 0) playTone(audio, 720, 0.14, volume * 0.65, 'sine');
    }
    if (defeated > 0) {
      captions.push(defeated > 1 ? `${defeated} enemies defeated` : 'Enemy defeated');
      if (audio && newExplosions === 0) playTone(audio, 520, 0.16, volume * 0.75, 'square');
    }
    if (newBombs > 0 && audio && captions.length === 0 && newExplosions === 0) {
      playTone(audio, 260, 0.08, volume * 0.45, 'triangle');
    }
    if (captions.length > 0) {
      setCaption(composeCaption(captions));
      setEventId((currentId) => currentId + 1);
    }
  }, []);

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

  return {
    observe,
    feedback: { caption: preferences.captions ? caption : '', impact, eventId },
  };
}

/** Feedback for each new `state` a render passes in. */
export function useGameFeedback(
  state: GameEngineState | null,
  preferences: GamePreferences
): GameFeedback {
  const { observe, feedback } = useFeedbackCore(preferences);
  useEffect(() => { observe(state); }, [observe, state]);
  return feedback;
}

/**
 * Feedback straight from the engine's publishes: the caller re-renders only
 * when a caption, a shake or a tone starts or ends, never for a plain tick.
 * Frames that only move players are skipped (no event can happen in one).
 */
export function useEngineFeedback(store: EngineStore, preferences: GamePreferences): GameFeedback {
  const { observe, feedback } = useFeedbackCore(preferences);
  useEffect(() => {
    let observed = store.getState();
    observe(observed);
    return store.subscribe(() => {
      const next = store.getState();
      if (next === observed || differsOnlyInPlayerMotion(observed, next)) return;
      observed = next;
      observe(next);
    });
  }, [observe, store]);
  return feedback;
}
