import React, { useMemo } from 'react';
import styled from '@emotion/styled';
import {
  FormControlLabel, Switch, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import { isTouchMode, useTouchMode } from '../../../input/touchMode';
import {
  DEFAULT_TOUCH_PREFERENCES,
  TOUCH_OPACITY_LEVELS,
  TOUCH_SIZES,
  TouchPreferences,
  setTouchPreferences,
  useTouchPreferences,
} from '../../../input/touchPreferences';
import { TOUCH_BOMB_PX, TouchSize } from '../../../input/touchLayout';
import { canVibrate } from '../TouchControls';
import { PreferenceGrid, PreferenceSection, SettingsButton } from './SettingsScreen.styles';

const SIZE_LABELS: Record<TouchSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

const OptionRow = styled.div({
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
  color: 'rgba(33,29,26,0.78)',
  fontSize: '0.76rem',
  fontWeight: 800,
  '& .MuiToggleButtonGroup-root': { display: 'flex' },
  '& .MuiToggleButton-root': {
    flex: '1 1 0',
    minHeight: 40,
    padding: '4px 8px',
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
    fontSize: '0.76rem',
    fontWeight: 900,
    textTransform: 'none',
  },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-teal)',
  },
  '@media (max-width: 420px)': { gridTemplateColumns: '1fr', gap: 4 },
});

/** A touch screen, even while a keyboard is in use: the section stays findable. */
function touchCapable(): boolean {
  if (isTouchMode()) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(any-pointer: coarse)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Settings → Touch Controls: size and opacity presets, a left-handed swap,
 * vibration where the browser has it, and a reset (XAG 107: presets plus
 * adjustable size and position). Saved for the next visit; the overlay and
 * the camera follow at once.
 */
export const TouchSettings = () => {
  const touchMode = useTouchMode();
  const capable = useMemo(touchCapable, [touchMode]);
  const preferences = useTouchPreferences();
  if (!touchMode && !capable) return null;
  const update = (patch: Partial<TouchPreferences>) => setTouchPreferences({
    ...preferences,
    ...patch,
  });
  return (
    <PreferenceSection aria-labelledby="touch-settings-title">
      <h3 id="touch-settings-title">
        <TouchAppIcon fontSize="small" />
        Touch Controls
      </h3>
      <OptionRow>
        <span id="touch-size-label">Button size</span>
        <ToggleButtonGroup
          exclusive
          value={preferences.size}
          aria-labelledby="touch-size-label"
          onChange={(_, value: TouchSize | null) => value && update({ size: value })}
        >
          {TOUCH_SIZES.map((size) => (
            <ToggleButton
              key={size}
              value={size}
              aria-label={`${SIZE_LABELS[size]} buttons, ${TOUCH_BOMB_PX[size]} pixel bomb`}
            >
              {SIZE_LABELS[size]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </OptionRow>
      <OptionRow>
        <span id="touch-opacity-label">Opacity</span>
        <ToggleButtonGroup
          exclusive
          value={preferences.opacity}
          aria-labelledby="touch-opacity-label"
          onChange={(_, value: TouchPreferences['opacity'] | null) => value && update({ opacity: value })}
        >
          {TOUCH_OPACITY_LEVELS.map((level) => (
            <ToggleButton key={level} value={level} aria-label={`${level}% opacity`}>
              {`${level}%`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </OptionRow>
      <PreferenceGrid>
        <FormControlLabel
          control={(
            <Switch
              checked={preferences.leftHanded}
              onChange={(event) => update({ leftHanded: event.target.checked })}
            />
          )}
          label="Left-handed: pad on the right"
        />
        {canVibrate() && (
          <FormControlLabel
            control={(
              <Switch
                checked={preferences.vibration}
                onChange={(event) => update({ vibration: event.target.checked })}
              />
            )}
            label="Vibrate on press"
          />
        )}
      </PreferenceGrid>
      <SettingsButton
        variant="outlined"
        sx={{ mt: 1 }}
        onClick={() => setTouchPreferences(DEFAULT_TOUCH_PREFERENCES)}
      >
        Reset Touch Layout
      </SettingsButton>
    </PreferenceSection>
  );
};
