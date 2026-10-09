import { CampaignRuntimeState } from '../../engine/types';
import { getWaveClock, WaveClock } from '../../engine/campaignWaves';

// The HUD wave line and the wave captions, from the engine's wave clock.

export type WaveLineModel = {
  // "Wave 2/4", or "Final wave" once every wave is in.
  label: string;
  // "in 0:12", "held", or "seal 0:08".
  value: string;
  // Where the marked wave comes from, or why it waits.
  note: string;
  held: boolean;
};

/** 12400 ms -> "0:13": whole seconds, rounded up like the other HUD clocks. */
export function formatWaveClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function toModel(clock: WaveClock): WaveLineModel {
  if (clock.phase === 'final') {
    return {
      label: 'Final wave',
      value: `seal ${formatWaveClock(clock.remainingMs)}`,
      note: '',
      held: false,
    };
  }
  const label = `Wave ${clock.wave}/${clock.total}`;
  if (clock.phase === 'held') {
    return {
      label, value: 'held', note: 'Too many attackers: clear some', held: true,
    };
  }
  return {
    label,
    value: `in ${formatWaveClock(clock.remainingMs)}`,
    note: clock.entries.join(' · '),
    held: false,
  };
}

/** The wave line while a scripted defense runs, else null. */
export function waveLineModel(
  campaign: CampaignRuntimeState | null | undefined
): WaveLineModel | null {
  const clock = getWaveClock(campaign);
  if (!clock) return null;
  const model = toModel(clock);
  // Between marks, the village event's twist on the waves (if any).
  const eventNote = campaign?.waves?.eventNote;
  return !model.note && clock.phase === 'incoming' && eventNote
    ? { ...model, note: eventNote }
    : model;
}

/** One-line form for the phone and short-screen mission line. */
export function waveShortText(model: WaveLineModel): string {
  return `${model.label.replace('Wave ', 'W')} ${model.value}`;
}

export type WaveCueSnapshot = {
  run: number;
  opened: number;
  telegraphing: boolean;
  held: boolean;
} | null;

export function waveCueSnapshot(
  campaign: CampaignRuntimeState | null | undefined
): WaveCueSnapshot {
  const waves = campaign?.waves;
  if (!waves || waves.finished) return null;
  return {
    run: waves.run, opened: waves.opened, telegraphing: waves.telegraphing, held: waves.held,
  };
}

/**
 * The caption for a wave cue between two snapshots: its spawn points being
 * marked ("Wave 2/4 from Market Lane +1"), or a wave held at the cap.
 * At most 40 characters (composeCaption's line).
 */
export function waveCaption(
  previous: WaveCueSnapshot,
  current: WaveCueSnapshot,
  campaign: CampaignRuntimeState | null | undefined
): string | null {
  if (!current || !campaign?.waves) return null;
  const sameRun = previous?.run === current.run && previous.opened === current.opened;
  const clock = getWaveClock(campaign);
  if (!clock || clock.phase === 'final') return null;
  if (current.held && !(sameRun && previous?.held)) {
    return `Wave ${clock.wave} held · clear attackers`;
  }
  if (current.telegraphing && !(sameRun && previous?.telegraphing)) {
    const [first, ...rest] = clock.entries;
    const from = first ? ` from ${first}${rest.length > 0 ? ` +${rest.length}` : ''}` : '';
    return `Wave ${clock.wave}/${clock.total}${from}`.slice(0, 40);
  }
  return null;
}
