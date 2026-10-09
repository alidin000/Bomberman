import React, { useEffect, useRef } from 'react';
import { Button } from '@mui/material';
import { DojoRoom } from '../../content/dojoRooms';
import { GameEngineState } from '../../engine/types';
import { getTrainingOutcome } from '../../engine/training';
import { PAD_START_EVENT } from '../../input/padNavigator';
import { RESULT_INPUT_LOCK_MS } from '../GameScreen/RoundResultDialog';
import {
  ResultActions,
  ResultBanner,
  ResultMessage,
  RESULT_TONE_ACCENTS,
  StyledResultDialog,
} from '../GameScreen/RoundResultDialog.styles';

type DojoDebriefProps = {
  room: DojoRoom;
  /** The room after this one; null after the last. */
  nextRoom: DojoRoom | null;
  open: boolean;
  state: GameEngineState;
  restart: () => void;
  onNext: () => void;
  onSkip: () => void;
  onLeave: () => void;
  onCleared: () => void;
};

// The fall's cause picks the instructor's hint: a blast or a flame, or an enemy.
function retryHint(room: DojoRoom, state: GameEngineState): string {
  const cause = state.players[0]?.deathCause?.kind;
  return cause === 'enemy' ? room.retryHint.enemy : room.retryHint.blast;
}

/**
 * The room's end: the instructor's explanation once it is cleared (prose
 * comes only after the player has done the thing), or a hint and a retry
 * after a fall. Like the round result, it ignores input for its first
 * RESULT_INPUT_LOCK_MS, and pad Start presses its main button.
 */
export function DojoDebrief({
  room, nextRoom, open, state, restart, onNext, onSkip, onLeave, onCleared,
}: DojoDebriefProps) {
  const outcome = getTrainingOutcome(state);
  const cleared = outcome === 'cleared';

  // Saved the moment the room is cleared, not when the debrief opens, so
  // leaving during the hold keeps it.
  const recorded = useRef<GameEngineState | null>(null);
  useEffect(() => {
    if (cleared && recorded.current !== state) {
      recorded.current = state;
      onCleared();
    }
  }, [cleared, onCleared, state]);

  const openedAt = useRef<number | null>(null);
  if (!open) openedAt.current = null;
  else if (openedAt.current === null) openedAt.current = Date.now();
  const locked = () => (
    openedAt.current === null || Date.now() - openedAt.current < RESULT_INPUT_LOCK_MS
  );
  const blockEarlyInput = (event: React.SyntheticEvent) => {
    if (locked()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const primary = cleared ? onNext : restart;
  useEffect(() => {
    if (!open) return undefined;
    const handlePadStart = (event: Event) => {
      event.preventDefault();
      if (!locked()) primary();
    };
    window.addEventListener(PAD_START_EVENT, handlePadStart);
    return () => window.removeEventListener(PAD_START_EVENT, handlePadStart);
  });

  if (!outcome) return null;
  const nextLabel = nextRoom ? `Next room: ${nextRoom.name}` : 'Finish training';

  return (
    <StyledResultDialog
      open={open}
      onClose={(_event, reason) => {
        if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') onLeave();
      }}
      onClickCapture={blockEarlyInput}
      aria-labelledby="dojo-debrief-title"
      aria-describedby="dojo-debrief-text"
      betweenRounds={false}
    >
      <ResultBanner
        id="dojo-debrief-title"
        accent={cleared ? RESULT_TONE_ACCENTS.victory : RESULT_TONE_ACCENTS.defeat}
        textColor="var(--anime-ink)"
      >
        {cleared ? `${room.name} cleared` : 'Caught'}
      </ResultBanner>
      <ResultMessage id="dojo-debrief-text">
        <strong>{`${room.instructor}: `}</strong>
        {cleared ? room.debrief : retryHint(room, state)}
      </ResultMessage>
      <ResultActions>
        {cleared ? (
          <>
            <Button autoFocus onClick={onNext} variant="contained" size="large">{nextLabel}</Button>
            <Button onClick={restart} variant="outlined">Replay room</Button>
            <Button onClick={onLeave} variant="outlined">Dojo rooms</Button>
          </>
        ) : (
          <>
            <Button autoFocus onClick={restart} variant="contained" size="large">Try again</Button>
            <Button onClick={onSkip} variant="outlined">Skip room</Button>
            <Button onClick={onLeave} variant="outlined">Dojo rooms</Button>
          </>
        )}
      </ResultActions>
    </StyledResultDialog>
  );
}
