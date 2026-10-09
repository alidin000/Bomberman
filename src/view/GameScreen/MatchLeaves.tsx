import React, { useMemo } from 'react';
import { GameEngineState } from '../../engine';
import { EngineStore, useEngineSelector } from '../../hooks/engineStore';
import { MotionStore } from '../../hooks/motionStore';
import { sceneStateSelector, selectHudState } from '../../hooks/useRenderState';
import { GameHUD } from './GameHUD';
import { GameScene3D } from './GameScene3D';
import { CaptionLiveRegion, FeedbackCaption } from './GameScreen.styles';
import { GamePreferences } from './gamePreferences';
import { MatchBeatOverlay } from './MatchBeatOverlay';
import { createRoundBeatSelector } from './matchView';

// The parts of the game screen that follow the engine tick by tick. Each one
// subscribes to the slice it draws, so a publish that changes nothing it
// draws does not render it at all, and GameScreen itself renders only for
// menus, pauses, round ends and feedback events.

// Fed shared states (see useRenderState) that keep their identity until
// something each one draws changes; the scene animates the rest itself from
// the motion store and the live state.
const MemoGameHUD = React.memo(GameHUD);
const MemoGameScene3D = React.memo(GameScene3D);

/** The HUD: re-renders when something it prints changes (the clock each second). */
export function MatchHud({ store, scale }: { store: EngineStore; scale: number }) {
  const hud = useEngineSelector(store, selectHudState);
  return hud && <MemoGameHUD state={hud} scale={scale} />;
}

type MatchSceneProps = {
  store: EngineStore;
  motion: MotionStore | null | undefined;
  preferences: GamePreferences;
  impact: number;
  advanceFrame: ((timestamp: number) => void) | undefined;
  liveState: (() => GameEngineState | null) | undefined;
  idle: boolean;
};

/** The 3D arena: re-renders when something on the board changes, never for clocks. */
export function MatchScene({
  store, motion, preferences, impact, advanceFrame, liveState, idle,
}: MatchSceneProps) {
  const select = useMemo(() => sceneStateSelector(motion), [motion]);
  const state = useEngineSelector(store, select);
  return state && (
    <MemoGameScene3D
      state={state}
      preferences={preferences}
      impact={impact}
      motion={motion}
      advanceFrame={advanceFrame}
      liveState={liveState}
      idle={idle}
    />
  );
}

type MatchAnnouncerProps = {
  store: EngineStore;
  caption: string;
  eventId: number;
  /** The banner held over the end of a round, or null. */
  roundOver: { text: string; accent: string } | null;
  /** Paused or a round over: no countdown or GO then. */
  held: boolean;
  hudScale: number;
  campaign: boolean;
};

/**
 * The countdown, GO and round-over plates, the caption, and the one live
 * region that reads them. The live region reads the round line with the
 * first number, then "2, 1, Go!" (nothing else happens while the arena is
 * frozen), then captions. Re-renders per countdown number, not per tick.
 */
export function MatchAnnouncer({
  store, caption, eventId, roundOver, held, hudScale, campaign,
}: MatchAnnouncerProps) {
  const selectBeat = useMemo(createRoundBeatSelector, []);
  const beat = useEngineSelector(store, selectBeat);
  const countdown = held ? '' : beat.countdown;
  const go = !held && beat.go;
  const line = countdown ? beat.line : '';
  let announcement = caption;
  if (countdown) announcement = countdown === '3' && line ? `${line}. 3` : countdown;
  else if (go) announcement = 'Go!';
  else if (roundOver) {
    // The knockout that decided it, then who took the round.
    announcement = caption ? `${caption}. ${roundOver.text}` : roundOver.text;
  }
  return (
    <>
      <CaptionLiveRegion role="status" aria-atomic="true">
        {announcement}
      </CaptionLiveRegion>
      {caption && (
        <FeedbackCaption key={eventId} aria-hidden="true">
          {caption}
        </FeedbackCaption>
      )}
      <MatchBeatOverlay
        countdown={countdown}
        go={go}
        line={line}
        roundOver={roundOver}
        hudScale={hudScale}
        campaign={campaign}
      />
    </>
  );
}
