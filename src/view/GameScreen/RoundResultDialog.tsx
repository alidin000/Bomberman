/* eslint-disable react/require-default-props */
import React from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ResultActions,
  ResultBanner,
  ResultEmblem,
  ResultBreakdown,
  ResultIntel,
  ResultMessage,
  ResultTone,
  RESULT_TONE_ACCENTS,
  StyledResultDialog,
} from './RoundResultDialog.styles';
import { GameEngineState } from '../../engine/types';

type RoundResultDialogProps = {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  resultMessage: string;
  isGameOver: boolean;
  tone?: ResultTone;
  state: GameEngineState;
}

function getResultTitle(isGameOver: boolean, tone: ResultTone): string {
  if (!isGameOver) return 'Trial Complete';
  if (tone === 'victory') return 'Mission Accomplished';
  if (tone === 'defeat') return 'Mission Failed';
  return 'Arena Sealed';
}

export const RoundResultDialog = (
  {
    open,
    onClose,
    onRestart,
    resultMessage,
    isGameOver,
    tone = 'neutral',
    state,
  }: RoundResultDialogProps
) => {
  const navigate = useNavigate();
  const accent = RESULT_TONE_ACCENTS[tone];
  const completedObjectives = state.campaign?.objectives.filter(
    (objective) => objective.status === 'complete'
  ).length ?? 0;
  const handleClose = (event: object, reason: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return;
    }
    onClose();
  };

  return (
    <StyledResultDialog
      open={open}
      onClose={handleClose}
      aria-labelledby="round-result-title"
    >
      <ResultBanner id="round-result-title" accent={accent}>
        {getResultTitle(isGameOver, tone)}
      </ResultBanner>
      <ResultEmblem accent={accent} aria-hidden />
      <ResultMessage>{resultMessage}</ResultMessage>
      <ResultBreakdown>
        <h3>Mission Report</h3>
        <table aria-label="match breakdown">
          <thead>
            <tr>
              <th scope="col">Shinobi</th>
              <th scope="col">Status</th>
              <th scope="col">Round wins</th>
              <th scope="col">Final intel</th>
            </tr>
          </thead>
          <tbody>
            {state.players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{player.alive ? 'Standing' : 'Sealed'}</td>
                <td>{state.roundWinners.filter((winner) => winner === player.id).length}</td>
                <td>{player.deathReason ?? (player.alive ? 'Survived' : 'Unknown')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ResultIntel>
          <span>
            <strong>{state.monsters.length}</strong>
            Threats left
          </span>
          <span>
            <strong>
              {state.campaign ? `${completedObjectives}/${state.campaign.objectives.length}` : state.roundWinners.length}
            </strong>
            {state.campaign ? 'Objectives' : 'Rounds scored'}
          </span>
          <span>
            <strong>{state.campaign?.discoveredSecrets.length ?? 0}</strong>
            Secrets
          </span>
        </ResultIntel>
      </ResultBreakdown>
      <ResultActions>
        {isGameOver
          ? (
            <>
              <Button autoFocus onClick={onRestart} variant="contained" size="large">Retry Same Setup</Button>
              <Button onClick={() => navigate('/config')} variant="outlined">Choose New Loadout</Button>
              <Button onClick={() => navigate('/')} variant="outlined">Back to Dojo</Button>
            </>
          )
          : (
            <Button autoFocus onClick={onClose} variant="contained" size="large">Next Trial</Button>
          )}
      </ResultActions>
    </StyledResultDialog>
  );
};
