import React from 'react';
import {
  BeatLayer, BeatLine, CountdownPlate, GoPlate, RoundOverPlate,
} from './MatchBeatOverlay.styles';
import { hudInsets, hudLayout } from './scene/cameraFraming';
import { useViewportSize } from './useViewportSize';
import { useHudDevice } from '../../input/touchMode';

type MatchBeatOverlayProps = {
  countdown: string;
  go: boolean;
  // The round-start line shown under the countdown.
  line: string;
  // The banner held over the end of a round, or null.
  roundOver: { text: string; accent: string } | null;
  hudScale: number;
  // The campaign camera centres its lone player, so the plates sit above
  // the bottom HUD band there instead.
  campaign: boolean;
};

/**
 * Countdown, "GO!" and the round-over banner, off the middle of the arena.
 * Versus: just under the top HUD band (hudInsets keeps the players below
 * it, and they start at the corners of their box, so the top centre is
 * clear). Campaign: the camera centres the lone player, so just above the
 * bottom band. Short screens: over the match bar itself.
 */
// Memoised: GameScreen renders on every engine publish, these props change
// a few times per round.
export const MatchBeatOverlay = React.memo(({
  countdown, go, line, roundOver, hudScale, campaign,
}: MatchBeatOverlayProps) => {
  const { width, height } = useViewportSize();
  // Touch controls and the safe area move the bands (and so the plates).
  const device = useHudDevice();
  if (!countdown && !go && !roundOver) return null;
  const insets = hudInsets(hudScale, width, height, device);
  let place: React.CSSProperties = { top: Math.round(insets.top * height) + 6 };
  if (hudLayout(width, height) === 'short') place = { top: 8 };
  else if (campaign) place = { bottom: Math.round(insets.bottom * height) + 8 };
  return (
    <BeatLayer style={place}>
      {countdown && (
        <>
          <CountdownPlate aria-label="round countdown">{countdown}</CountdownPlate>
          {line && <BeatLine aria-hidden="true">{line}</BeatLine>}
        </>
      )}
      {!countdown && go && <GoPlate aria-hidden="true">GO!</GoPlate>}
      {!countdown && !go && roundOver && (
        <RoundOverPlate aria-hidden="true" accent={roundOver.accent}>{roundOver.text}</RoundOverPlate>
      )}
    </BeatLayer>
  );
});
MatchBeatOverlay.displayName = 'MatchBeatOverlay';
