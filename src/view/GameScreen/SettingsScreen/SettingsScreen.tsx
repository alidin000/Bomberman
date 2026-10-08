import React, { useState } from 'react';
import {
  DialogContent, DialogActions, FormControlLabel, Slider, Switch
} from '@mui/material';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useNavigate } from 'react-router-dom';
import {
  ButtonContainer,
  ConfirmText,
  PreferenceGrid,
  PreferenceSection,
  PreferenceSlider,
  SettingsButton,
  SettingsIntro,
  SettingsTitle,
  StyledSettingsDialog,
} from './SettingsScreen.styles';
import { SettingsScreenProps } from '../../../constants/props';

const SettingsScreen: React.FC<SettingsScreenProps> = (
  {
    open,
    onClose,
    onRestart,
    onModifyControls,
    preferences,
    onPreferencesChange,
  }
) => {
  const navigate = useNavigate();
  const [openConfirm, setOpenConfirm] = useState(false);

  const handleQuitClick = () => {
    setOpenConfirm(true);
  };

  const handleQuitConfirm = () => {
    navigate('/');
  };

  const handleQuitCancel = () => {
    setOpenConfirm(false);
  };

  return (
    <StyledSettingsDialog open={open} onClose={onClose} aria-labelledby="settings-dialog-title">
      <SettingsTitle id="settings-dialog-title">Match Command</SettingsTitle>
      <DialogContent>
        <SettingsIntro>
          Resume the arena, restart this setup, rebind controls, or return to the dojo.
        </SettingsIntro>
        <ButtonContainer>
          <SettingsButton variant="contained" startIcon={<PlayArrowIcon />} onClick={onClose}>
            Resume Game
          </SettingsButton>
          <SettingsButton variant="outlined" startIcon={<RestartAltIcon />} onClick={onRestart}>
            Restart Same Setup
          </SettingsButton>
          <SettingsButton variant="outlined" startIcon={<KeyboardIcon />} onClick={onModifyControls}>
            Modify Controls
          </SettingsButton>
          <SettingsButton variant="outlined" color="warning" startIcon={<ExitToAppIcon />} onClick={handleQuitClick}>
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
          </PreferenceGrid>
          <PreferenceSlider>
            <span>Effects volume</span>
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
            <span>Screen shake</span>
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
            <span>HUD size</span>
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
      </DialogContent>
      <StyledSettingsDialog open={openConfirm} onClose={handleQuitCancel} aria-labelledby="confirm-dialog-title">
        <SettingsTitle id="confirm-dialog-title">Leave The Arena?</SettingsTitle>
        <ConfirmText>Your current match progress will be lost.</ConfirmText>
        <DialogActions>
          <SettingsButton variant="outlined" onClick={handleQuitCancel}>Stay</SettingsButton>
          <SettingsButton variant="outlined" color="warning" onClick={handleQuitConfirm}>
            Leave Match
          </SettingsButton>
        </DialogActions>
      </StyledSettingsDialog>
    </StyledSettingsDialog>
  );
};

export default SettingsScreen;
