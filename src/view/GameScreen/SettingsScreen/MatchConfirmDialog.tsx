import React, { useRef } from 'react';
import { DialogActions } from '@mui/material';
import {
  ConfirmText,
  SettingsButton,
  SettingsTitle,
  StyledSettingsDialog,
} from './SettingsScreen.styles';

export type MatchConfirmKind = 'restart' | 'quit';

const COPY: Record<MatchConfirmKind, { title: string; body: string; confirm: string }> = {
  restart: {
    title: 'Restart The Match?',
    body: 'Round wins reset and this setup starts again from the first round.',
    confirm: 'Restart Match',
  },
  quit: {
    title: 'Leave The Arena?',
    body: 'Your current match progress will be lost.',
    confirm: 'Leave Match',
  },
};

type MatchConfirmDialogProps = {
  /** Which action waits for an answer; null keeps the dialog closed. */
  kind: MatchConfirmKind | null;
  onCancel: () => void;
  onConfirm: (kind: MatchConfirmKind) => void;
};

/**
 * The one confirmation in front of every mid-match restart and quit (pause
 * menu and Settings). "Stay" takes focus first, so a stray Enter, pad A or
 * double click lands on the safe choice; Escape and pad B also stay.
 */
export const MatchConfirmDialog = ({ kind, onCancel, onConfirm }: MatchConfirmDialogProps) => {
  // The copy stays put while the dialog fades out after an answer.
  const shown = useRef<MatchConfirmKind>('quit');
  if (kind) shown.current = kind;
  const copy = COPY[shown.current];

  return (
    <StyledSettingsDialog
      open={kind !== null}
      onClose={onCancel}
      aria-labelledby="match-confirm-title"
      aria-describedby="match-confirm-text"
    >
      <SettingsTitle id="match-confirm-title">{copy.title}</SettingsTitle>
      <ConfirmText id="match-confirm-text">{copy.body}</ConfirmText>
      <DialogActions>
        <SettingsButton autoFocus variant="outlined" onClick={onCancel}>
          Stay
        </SettingsButton>
        <SettingsButton
          variant="outlined"
          color="warning"
          onClick={() => {
            if (kind) onConfirm(kind);
          }}
        >
          {copy.confirm}
        </SettingsButton>
      </DialogActions>
    </StyledSettingsDialog>
  );
};
