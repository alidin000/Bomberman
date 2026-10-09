import React from 'react';
import {
  BeatLayer, BeatLine, CountdownPlate, GoPlate, RoundOverDetail, RoundOverPlate,
} from './MatchBeatOverlay.styles';
import { hudInsets, hudLayout } from './scene/cameraFraming';
import { useViewportSize } from './useViewportSize';
import { useHudDevice } from '../../input/touchMode';

type MatchBeatOverlayProps = {
  countdown: string;
  go: boolean;
  // The round-start line shown under the countdown.
  line: string;
  // The banner held over the end of a round, or null. `detail` is a second
  // line: a sealed boss's reward.
  roundOver: { text: string; accent: string; detail?: string } | null;
  hudScale: number;
  // The campaign camera centres its lone player, so the plates sit above
  // the bottom HUD band there instead.
  campaign: boolean;
};

// The feedback caption (GameScreen.styles FeedbackCaption) sits this far up
// from the bottom edge and is about this tall (two lines on a narrow phone).
const CAPTION_BOTTOM_PX = { row: 28, phone: 66 };
const CAPTION_HEIGHT_PX = { row: 44, phone: 64 };

/**
 * How far up from the bottom edge a plate sits that must clear the bottom
 * HUD band and the caption: a knockout's or a hit's caption arrives with the
 * round-over plate, and the boss's entrance caption with its title card.
 */
export function bottomPlateOffset(width: number, height: number, insetBottom: number): number {
  const layout = hudLayout(width, height) === 'phone' ? 'phone' : 'row';
  const band = Math.round(insetBottom * height) + 8;
  return Math.max(band, CAPTION_BOTTOM_PX[layout] + CAPTION_HEIGHT_PX[layout] + 8);
}

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
  else if (campaign) place = { bottom: bottomPlateOffset(width, height, insets.bottom) };
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
        <RoundOverPlate aria-hidden="true" accent={roundOver.accent}>
          {roundOver.text}
          {roundOver.detail && <RoundOverDetail>{roundOver.detail}</RoundOverDetail>}
        </RoundOverPlate>
      )}
    </BeatLayer>
  );
});
MatchBeatOverlay.displayName = 'MatchBeatOverlay';
