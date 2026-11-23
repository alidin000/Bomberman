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
import { useHudDevice } from '../../input/touchMode';
import type { ArenaMapEntry } from '../../content/arenaMaps';
import { CityOverviewPlate } from '../CityArena/CityArena';
import { OVERVIEW_PLATE } from '../CityArena/overviewPlate';

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
  /** Online: this browser's seat, so only its player sees village prompts. */
  // eslint-disable-next-line react/require-default-props -- defaulted to null in the signature
  localSeat?: number | null;
  /** A city's round-start overview was skipped: the camera stays on the players. */
  // eslint-disable-next-line react/require-default-props -- defaulted to false in the signature
  overviewSkipped?: boolean;
};

/** The 3D arena: re-renders when something on the board changes, never for clocks. */
export function MatchScene({
  store,
  motion,
  preferences,
  impact,
  advanceFrame,
  liveState,
  idle,
  localSeat = null,
  overviewSkipped = false,
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
      localSeat={localSeat}
      overviewSkipped={overviewSkipped}
    />
  );
}

type MatchAnnouncerProps = {
  store: EngineStore;
  caption: string;
  eventId: number;
  /** The banner held over the end of a round (a sealed boss's reward card), or null. */
  roundOver: { text: string; accent: string; detail?: string } | null;
  /** Paused or a round over: no countdown or GO then. */
  held: boolean;
  hudScale: number;
  campaign: boolean;
  /**
   * A city's round-start overview is up: its plate shows the countdown
   * (RoundOverviewPlate), so the top centre stays clear over the board.
   */
  // eslint-disable-next-line react/require-default-props -- defaulted to false in the signature
  overview?: boolean;
};

/**
 * The countdown, GO and round-over plates, the caption, and the one live
 * region that reads them. The live region reads the round line with the
 * first number, then "2, 1, Go!" (nothing else happens while the arena is
 * frozen), then captions. Re-renders per countdown number, not per tick.
 */
export function MatchAnnouncer({
  store, caption, eventId, roundOver, held, hudScale, campaign, overview = false,
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
    const banner = roundOver.detail ? `${roundOver.text}. ${roundOver.detail}` : roundOver.text;
    announcement = caption ? `${caption}. ${banner}` : banner;
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
        countdown={overview ? '' : countdown}
        go={go}
        line={overview ? '' : line}
        roundOver={roundOver}
        hudScale={hudScale}
        campaign={campaign}
      />
    </>
  );
}

/**
 * A city's round-start overview plate at the foot of the screen, with the
 * countdown in it while the overview runs (the live region above still reads
 * it). It may cover the bottom HUD band and the touch controls: the arena is
 * frozen until GO, and any touch ends the overview. Re-renders per countdown
 * number.
 */
export function RoundOverviewPlate({
  store, entry, named, onSkip,
}: {
  store: EngineStore;
  entry: ArenaMapEntry;
  /** The HUD is shown: the plate names the city and offers Skip. */
  named: boolean;
  onSkip: () => void;
}) {
  const selectBeat = useMemo(createRoundBeatSelector, []);
  const beat = useEngineSelector(store, selectBeat);
  // Clear of the home indicator; the camera reads the same safe area.
  const { safe } = useHudDevice();
  const bottom = safe.bottom + OVERVIEW_PLATE.gapPx;
  return (
    <CityOverviewPlate
      entry={entry}
      countdown={beat.countdown}
      named={named}
      bottom={bottom}
      onSkip={onSkip}
    />
  );
}
