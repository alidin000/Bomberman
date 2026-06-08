import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

type RoundResultDialogProps = {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  resultMessage: string;
  isGameOver: boolean;
}

export const RoundResultDialog = (
  {
    open,
    onClose,
    onRestart,
    resultMessage,
    isGameOver
  }: RoundResultDialogProps
) => {
  const navigate = useNavigate();
  const handleClose = (event: object, reason: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isGameOver ? 'Arena Sealed' : 'Trial Complete'}
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px'
        }}
      >
        <p>{resultMessage}</p>

        {isGameOver
          ? (
            <>
              <Button onClick={onRestart} variant="contained">Retry Same Setup</Button>
              <Button onClick={() => navigate('/config')} variant="outlined">Choose New Loadout</Button>
              <Button onClick={() => navigate('/')} variant="outlined">Back to Dojo</Button>
            </>
          )
          : (
            <Button onClick={onClose} variant="outlined">Next Trial</Button>
          )}
      </DialogContent>
    </Dialog>
  );
};
