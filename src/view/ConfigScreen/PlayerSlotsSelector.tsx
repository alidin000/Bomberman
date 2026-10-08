import React from 'react';
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { PlayerSlotController } from '../../engine/types';
import { SLOT_CONTROLLERS } from '../../ai/controllers';
import { SetupOption } from './ConfigScreen.styles';

const SHORT_LABELS: Record<PlayerSlotController, string> = {
  human: 'Human',
  'cpu-easy': 'Easy',
  'cpu-normal': 'Normal',
  'cpu-hard': 'Hard',
};

const LONG_LABELS: Record<PlayerSlotController, string> = {
  human: 'Human',
  'cpu-easy': 'CPU Easy',
  'cpu-normal': 'CPU Normal',
  'cpu-hard': 'CPU Hard',
};

type PlayerSlotsSelectorProps = {
  controllers: PlayerSlotController[];
  onChange: (controllers: PlayerSlotController[]) => void;
};

/**
 * Local Arena: who plays each slot, a human at that slot's keys or a CPU at
 * a level. One slot always stays human, so the last human's CPU choices are
 * disabled.
 */
export const PlayerSlotsSelector = ({ controllers, onChange }: PlayerSlotsSelectorProps) => {
  const humans = controllers.filter((controller) => controller === 'human').length;
  return (
    <SetupOption role="group" aria-label="human or CPU per player">
      <Typography variant="h6" component="span">Players:</Typography>
      {controllers.map((controller, slot) => {
        const label = `P${slot + 1}`;
        const lastHuman = controller === 'human' && humans === 1;
        return (
          // eslint-disable-next-line react/no-array-index-key
          <span key={slot} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <strong>{label}</strong>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={controller}
              aria-label={`${label} controller`}
              onChange={(_event, next: PlayerSlotController | null) => {
                if (!next) return;
                onChange(controllers.map((item, index) => (index === slot ? next : item)));
              }}
            >
              {SLOT_CONTROLLERS.map((option) => (
                <ToggleButton
                  key={option}
                  value={option}
                  aria-label={`${label} ${LONG_LABELS[option]}`}
                  disabled={lastHuman && option !== 'human'}
                >
                  {SHORT_LABELS[option]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </span>
        );
      })}
      <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%' }}>
        Easy, Normal and Hard slots are CPU shinobi. Only human slots need keys.
      </Typography>
    </SetupOption>
  );
};
