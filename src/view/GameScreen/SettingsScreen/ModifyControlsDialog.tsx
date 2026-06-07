import React, { useEffect, useMemo, useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  Button,
  DialogActions,
  Typography,
} from '@mui/material';
import {
  KeyConfigInput,
  KeyGroup,
  PlayerControlsRow,
  ControlsLabel,
  StyledDialog,
  KeyRow,
  ActionKeysGrid,
  ActionKeyCell,
  ActionKeyName,
} from '../../ConfigScreen/ConfigScreen.styles';
import {
  ACTION_BINDING_LABELS,
  KeyBindings,
  arrowKeySymbols,
  normalizeKeyBindings,
} from '../../../constants/props';

type ModifyControlsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keyBindings: KeyBindings) => void;
  keyBindings: KeyBindings;
  numOfPlayers: string;
}

function getDisplayKey(key: string): string {
  return arrowKeySymbols[key] || key.toUpperCase();
}

function getActivePlayers(numOfPlayers: string): string[] {
  const count = Number.parseInt(numOfPlayers, 10) || 1;
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

const ModifyControlsDialog = ({
  isOpen,
  onClose,
  onSave,
  keyBindings,
  numOfPlayers,
}: ModifyControlsDialogProps) => {
  const [draftBindings, setDraftBindings] = useState<KeyBindings>(() => (
    normalizeKeyBindings(keyBindings)
  ));
  const activePlayers = useMemo(() => getActivePlayers(numOfPlayers), [numOfPlayers]);

  useEffect(() => {
    if (isOpen) setDraftBindings(normalizeKeyBindings(keyBindings));
  }, [isOpen, keyBindings]);

  const keyErrors = useMemo(() => {
    const seen = new Map<string, string>();
    const conflicts = new Set<string>();
    activePlayers.forEach((player) => {
      draftBindings[player].forEach((key, keyIndex) => {
        const keyId = `player${player}-${keyIndex}`;
        if (seen.has(key)) {
          conflicts.add(keyId);
          conflicts.add(seen.get(key)!);
        } else {
          seen.set(key, keyId);
        }
      });
    });
    return conflicts;
  }, [activePlayers, draftBindings]);

  const handleKeyDown = (
    player: string,
    keyIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    event.preventDefault();
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Backspace' || key === 'Delete' || (key.length > 1 && !key.includes('Arrow'))) return;

    setDraftBindings((current) => {
      const next = normalizeKeyBindings(current);
      next[player] = next[player].map((item, index) => (index === keyIndex ? key : item));
      return next;
    });
  };

  return (
    <StyledDialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="modify-controls-title"
      style={{ zIndex: 2100 }}
    >
      <DialogTitle id="modify-controls-title">Modify Controls</DialogTitle>
      <DialogContent dividers>
        {activePlayers.map((player) => (
          <PlayerControlsRow key={`player-${player}-controls`} numOfPlayers={numOfPlayers}>
            <ControlsLabel>{`Player ${player} Controls:`}</ControlsLabel>
            <KeyGroup>
              <KeyConfigInput
                aria-label={`player ${player} up key`}
                value={getDisplayKey(draftBindings[player][0])}
                onKeyDown={(event) => handleKeyDown(player, 0, event)}
                readOnly
                style={{ borderColor: keyErrors.has(`player${player}-0`) ? 'red' : 'black' }}
              />
              <KeyRow>
                {draftBindings[player].slice(1, 4).map((key, index) => {
                  const keyIndex = index + 1;
                  return (
                    <KeyConfigInput
                      key={`player-${player}-move-${keyIndex}`}
                      aria-label={`player ${player} move key ${keyIndex}`}
                      value={getDisplayKey(key)}
                      onKeyDown={(event) => handleKeyDown(player, keyIndex, event)}
                      readOnly
                      style={{ borderColor: keyErrors.has(`player${player}-${keyIndex}`) ? 'red' : 'black' }}
                    />
                  );
                })}
              </KeyRow>
            </KeyGroup>
            <ActionKeysGrid>
              {ACTION_BINDING_LABELS.map((label, index) => {
                const keyIndex = index + 4;
                const key = draftBindings[player][keyIndex];
                return (
                  <ActionKeyCell key={`player-${player}-action-${keyIndex}`}>
                    <ActionKeyName>{label}</ActionKeyName>
                    <KeyConfigInput
                      aria-label={`player ${player} ${label.toLowerCase()} key`}
                      value={getDisplayKey(key)}
                      onKeyDown={(event) => handleKeyDown(player, keyIndex, event)}
                      readOnly
                      style={{ borderColor: keyErrors.has(`player${player}-${keyIndex}`) ? 'red' : 'black' }}
                    />
                  </ActionKeyCell>
                );
              })}
            </ActionKeysGrid>
          </PlayerControlsRow>
        ))}
        {keyErrors.size > 0 && (
          <Typography variant="body2" color="error">
            Please correct highlighted key conflicts before saving.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSave(draftBindings)}
          color="primary"
          disabled={keyErrors.size > 0}
        >
          Save
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default ModifyControlsDialog;
