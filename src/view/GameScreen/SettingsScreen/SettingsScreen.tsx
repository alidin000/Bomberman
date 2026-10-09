import React, { useState } from 'react';
import {
  DialogContent, FormControlLabel, Slider, Switch
} from '@mui/material';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useNavigate } from 'react-router-dom';
import {
  ButtonContainer,
  PreferenceGrid,
  PreferenceSection,
  PreferenceSlider,
  SettingsButton,
  SettingsIntro,
  SettingsTitle,
  StyledSettingsDialog,
} from './SettingsScreen.styles';
import { SettingsScreenProps } from '../../../constants/props';
import { MatchConfirmDialog, MatchConfirmKind } from './MatchConfirmDialog';
import { TouchSettings } from './TouchSettings';

// `onClose` goes back to wherever settings were opened from (the pause menu
// or live play); `onResume` always gives play back.
// eslint-disable-next-line react/require-default-props
type Props = SettingsScreenProps & { onResume?: () => void };

const SettingsScreen: React.FC<Props> = (
  {
    open,
    onClose,
    onResume,
    onRestart,
    onModifyControls,
    preferences,
    onPreferencesChange,
  }
) => {
  const navigate = useNavigate();
  // Restart and Quit both wipe the match, so both ask first.
  const [confirmKind, setConfirmKind] = useState<MatchConfirmKind | null>(null);

  const handleConfirm = (kind: MatchConfirmKind) => {
    setConfirmKind(null);
    if (kind === 'quit') navigate('/');
    else onRestart();
  };

  return (
    <StyledSettingsDialog open={open} onClose={onClose} aria-labelledby="settings-dialog-title">
      <SettingsTitle id="settings-dialog-title">Match Command</SettingsTitle>
      <DialogContent>
        <SettingsIntro>
          Resume the arena, restart this setup, rebind controls, or return to the dojo.
        </SettingsIntro>
        <ButtonContainer>
          <SettingsButton variant="contained" startIcon={<PlayArrowIcon />} onClick={onResume ?? onClose}>
            Resume Game
          </SettingsButton>
          <SettingsButton variant="outlined" startIcon={<RestartAltIcon />} onClick={() => setConfirmKind('restart')}>
            Restart Same Setup
          </SettingsButton>
          <SettingsButton variant="outlined" startIcon={<KeyboardIcon />} onClick={onModifyControls}>
            Modify Controls
          </SettingsButton>
          <SettingsButton variant="outlined" color="warning" startIcon={<ExitToAppIcon />} onClick={() => setConfirmKind('quit')}>
            Quit Game
          </SettingsButton>
        </ButtonContainer>
        <PreferenceSection aria-labelledby="accessibility-settings-title">
          <h3 id="accessibility-settings-title">
            <AccessibilityNewIcon fontSize="small" />
            Accessibility & Feedback
          </h3>
          <PreferenceGrid>
            <FormControlLabel
              control={(
                <Switch
                  checked={preferences.soundEnabled}
                  onChange={(event) => onPreferencesChange({
                    ...preferences,
                    soundEnabled: event.target.checked,
                  })}
                />
              )}
              label="Sound effects"
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={preferences.captions}
                  onChange={(event) => onPreferencesChange({
                    ...preferences,
                    captions: event.target.checked,
                  })}
                />
              )}
              label="Sound captions"
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={preferences.reducedMotion}
                  onChange={(event) => onPreferencesChange({
                    ...preferences,
                    reducedMotion: event.target.checked,
                  })}
                />
              )}
              label="Reduce motion"
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={preferences.highContrast}
                  onChange={(event) => onPreferencesChange({
                    ...preferences,
                    highContrast: event.target.checked,
                  })}
                />
              )}
              label="High contrast"
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={preferences.scenery}
                  onChange={(event) => onPreferencesChange({
                    ...preferences,
                    scenery: event.target.checked,
                  })}
                />
              )}
              label="Stage scenery"
            />
          </PreferenceGrid>
          <PreferenceSlider>
            <span>
              Effects volume
              <strong>{`${preferences.effectsVolume}%`}</strong>
            </span>
            <Slider
              aria-label="effects volume"
              value={preferences.effectsVolume}
              valueLabelDisplay="auto"
              onChange={(_, value) => onPreferencesChange({
                ...preferences,
                effectsVolume: value as number,
              })}
            />
          </PreferenceSlider>
          <PreferenceSlider>
            <span>
              Screen shake
              <strong>{preferences.reducedMotion ? 'Off' : `${preferences.screenShake}%`}</strong>
            </span>
            <Slider
              aria-label="screen shake"
              value={preferences.screenShake}
              valueLabelDisplay="auto"
              disabled={preferences.reducedMotion}
              onChange={(_, value) => onPreferencesChange({
                ...preferences,
                screenShake: value as number,
              })}
            />
          </PreferenceSlider>
          <PreferenceSlider>
            <span>
              HUD size
              <strong>{`${preferences.hudScale}%`}</strong>
            </span>
            <Slider
              aria-label="HUD size"
              min={80}
              max={125}
              value={preferences.hudScale}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              onChange={(_, value) => onPreferencesChange({
                ...preferences,
                hudScale: value as number,
              })}
            />
          </PreferenceSlider>
        </PreferenceSection>
        {/* Touch screens only. */}
        <TouchSettings />
      </DialogContent>
      <MatchConfirmDialog
        kind={confirmKind}
        onCancel={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
      />
    </StyledSettingsDialog>
  );
};

export default SettingsScreen;
