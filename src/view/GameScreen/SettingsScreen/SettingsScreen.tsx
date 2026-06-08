import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Button, DialogActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ButtonContainer } from './SettingsScreen.styles';
import { SettingsScreenProps } from '../../../constants/props';

const SettingsScreen: React.FC<SettingsScreenProps> = (
  {
    open,
    onClose,
    onRestart,
    onModifyControls
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
    <Dialog open={open} onClose={onClose} aria-labelledby="settings-dialog-title">
      <DialogTitle id="settings-dialog-title">Settings</DialogTitle>
      <DialogContent>
        <ButtonContainer>
          <Button variant="contained" color="primary" onClick={handleQuitClick}>
            Quit
          </Button>
          <Button variant="contained" color="secondary" onClick={onRestart}>
            Restart Same Setup
          </Button>
          <Button variant="contained" onClick={onModifyControls}>
            Modify Controls
          </Button>
        </ButtonContainer>
      </DialogContent>
      <Dialog open={openConfirm} onClose={handleQuitCancel} aria-labelledby="confirm-dialog-title">
        <DialogTitle id="confirm-dialog-title">Are you sure you want to exit the game?</DialogTitle>
        <DialogActions>
          <Button onClick={handleQuitConfirm} autoFocus>
            Yes
          </Button>
          <Button onClick={handleQuitCancel}>No</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default SettingsScreen;
