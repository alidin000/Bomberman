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
  resultMessage: string;
  isGameOver: boolean;
}

export const RoundResultDialog = (
  {
    open,
    onClose,
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
        {isGameOver ? 'Game Over!' : 'Round Over'}
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
              <Button onClick={() => navigate('/config')} variant="outlined">Start New Game</Button>
              <Button onClick={() => navigate('/')} variant="outlined">Back to Home</Button>
            </>
          )
          : (
            <Button onClick={onClose} variant="outlined">Next Round</Button>
          )}
      </DialogContent>
    </Dialog>
  );
};
