import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  DOJO_NAME, DOJO_ROOMS, dojoRoomPath, getDojoRoomInfo,
} from '../../content/dojo';
import {
  dojoRoomStatus,
  dojoStarted,
  loadDojoProgress,
  markDojoSuggested,
  nextDojoRoomId,
} from '../../story/dojoProgress';
import {
  InstructionsBackground,
  StyledDialog,
  StyledDialogContent,
  StyledDialogTitle,
  DialogActions,
} from '../InstructionsScreen/InstructionsScreen.styles';
import { moveFocusWithArrows } from '../ConfigScreen/menuNavigation';
import { MAIN_MENU_LABEL } from '../ConfigScreen/menuCopy';
import {
  DojoActions, DojoIntro, DojoRoomBadge, DojoRoomCard, DojoRoomList,
} from './DojoScreen.styles';

const STATUS_LABELS = {
  cleared: 'Cleared',
  skipped: 'Skipped',
  new: 'New',
} as const;

/**
 * The Training Dojo's room list: start or continue where the player left
 * off, replay any room, or leave. Every room stays open, cleared or not.
 */
export const DojoScreen = () => {
  const navigate = useNavigate();
  const [progress] = useState(loadDojoProgress);
  // Opening the dojo answers the title screen's suggestion.
  useEffect(() => {
    markDojoSuggested();
  }, []);

  const started = dojoStarted(progress);
  const allCleared = progress.cleared.length === DOJO_ROOMS.length;
  const resumeId = nextDojoRoomId(progress)
    ?? DOJO_ROOMS.find((room) => !progress.cleared.includes(room.id))?.id
    ?? null;
  const resumeRoom = resumeId ? getDojoRoomInfo(resumeId) : null;
  const leave = () => navigate('/');

  let primaryLabel = 'Start training';
  if (resumeRoom && started) primaryLabel = `Continue: ${resumeRoom.name}`;

  return (
    <InstructionsBackground>
      <StyledDialog
        open
        onClose={leave}
        maxWidth={false}
        aria-labelledby="dojo-title"
        PaperProps={{ onKeyDown: moveFocusWithArrows }}
      >
        <StyledDialogTitle id="dojo-title">{DOJO_NAME}</StyledDialogTitle>
        <StyledDialogContent dividers>
          <DojoIntro>
            {allCleared
              ? 'All four rooms cleared. Replay any of them, or head for the villages.'
              : 'Four short rooms, about half a minute each. You play first; each instructor explains once you have done it. Leave or skip whenever you like.'}
          </DojoIntro>
          <DojoRoomList aria-label="training rooms">
            {DOJO_ROOMS.map((room) => {
              const status = dojoRoomStatus(progress, room.id);
              const verb = status === 'cleared' ? 'Replay' : 'Play';
              return (
                <DojoRoomCard key={room.id} status={status} current={room.id === resumeId}>
                  <DojoRoomBadge status={status}>
                    {`Room ${room.order} · ${STATUS_LABELS[status]}`}
                  </DojoRoomBadge>
                  <h3>{room.name}</h3>
                  <p>{`${room.skill} · with ${room.instructor}`}</p>
                  <Button
                    variant="outlined"
                    onClick={() => navigate(dojoRoomPath(room))}
                    aria-label={`${verb} room ${room.order}: ${room.name}`}
                  >
                    {verb}
                  </Button>
                </DojoRoomCard>
              );
            })}
          </DojoRoomList>
        </StyledDialogContent>
        <DialogActions>
          <DojoActions>
            {resumeRoom && (
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={() => navigate(dojoRoomPath(resumeRoom))}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              >
                {primaryLabel}
              </Button>
            )}
            <Button
              variant="outlined"
              size="large"
              onClick={leave}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={!resumeRoom}
            >
              {allCleared || started ? MAIN_MENU_LABEL : 'Skip the dojo'}
            </Button>
          </DojoActions>
        </DialogActions>
      </StyledDialog>
    </InstructionsBackground>
  );
};
