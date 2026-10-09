/* eslint-disable react/require-default-props */
import React, { useRef } from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ResultActions,
  ResultBanner,
  ResultBreakdown,
  ResultIntel,
  ResultMessage,
  ResultPips,
  ResultPip,
  ResultRow,
  ResultTone,
  RESULT_TONE_ACCENTS,
  StyledResultDialog,
} from './RoundResultDialog.styles';
import { GameEngineState } from '../../engine/types';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import {
  cpuLevelLabel,
  deathNote,
  isVersus,
  lastRoundWinnerSlot,
  matchScoreLine,
  matchWinnerSlot,
  roundOverBanner,
  winsBySlot,
  winsNeeded,
} from './matchCopy';

/** Clicks and key presses are ignored this long after the dialog opens. */
export const RESULT_INPUT_LOCK_MS = 600;

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
  if (!isGameOver) return 'Round over';
  if (tone === 'victory') return 'Mission Accomplished';
  if (tone === 'defeat') return 'Mission Failed';
  return 'Match over';
}

// Players mash bomb as a round ends, and Enter or Space on the focused
// button would skip the result unread. Every click (keyboard activation
// included) inside the dialog is dropped until the lock runs out.
function useInputLock(open: boolean): (event: React.SyntheticEvent) => void {
  const openedAt = useRef<number | null>(null);
  if (!open) openedAt.current = null;
  else if (openedAt.current === null) openedAt.current = Date.now();
  return (event) => {
    if (openedAt.current !== null && Date.now() - openedAt.current < RESULT_INPUT_LOCK_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
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
  const blockEarlyInput = useInputLock(open);
  const versus = isVersus(state);
  let winnerSlot: number | null = null;
  if (versus) winnerSlot = isGameOver ? matchWinnerSlot(state) : lastRoundWinnerSlot(state);
  const title = versus ? roundOverBanner(state) : getResultTitle(isGameOver, tone);
  const accent = winnerSlot !== null ? playerSlotColor(winnerSlot) : RESULT_TONE_ACCENTS[tone];
  const accentText = winnerSlot !== null ? playerSlotTextColor(winnerSlot) : 'var(--anime-ink)';
  const wins = winsBySlot(state);
  const needed = winsNeeded(state.totalRounds);
  const completedObjectives = state.campaign?.objectives.filter(
    (objective) => objective.status === 'complete'
  ).length ?? 0;
  // Same count as the HUD's Threats node: a boss still standing is a threat.
  const threatsLeft = state.monsters.length + (state.boss && state.boss.health > 0 ? 1 : 0);
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
      onClickCapture={blockEarlyInput}
      aria-labelledby="round-result-title"
      betweenRounds={versus && !isGameOver}
    >
      <ResultBanner id="round-result-title" accent={accent} textColor={accentText}>
        {title}
      </ResultBanner>
      <ResultMessage>
        {versus
          ? `${isGameOver ? 'Final score' : 'Score'} ${matchScoreLine(state)}`
          : resultMessage}
      </ResultMessage>
      {versus ? (
        <ResultBreakdown>
          <table aria-label="match breakdown">
            <thead>
              <tr>
                <th scope="col">Shinobi</th>
                <th scope="col">Wins</th>
                <th scope="col">{isGameOver ? 'Last round' : 'This round'}</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player, index) => {
                const cpu = cpuLevelLabel(state, index);
                const note = player.alive ? '' : deathNote(state, player);
                return (
                  <ResultRow
                    key={player.id}
                    slotColor={playerSlotColor(index)}
                    winner={index === winnerSlot}
                  >
                    {/* Players may pick the same shinobi; the slot tells them apart. */}
                    <td>
                      {`${playerSlotLabel(index)} · ${player.name}`}
                      {cpu && <small>{`CPU · ${cpu}`}</small>}
                    </td>
                    <td>
                      <ResultPips role="img" aria-label={`${wins[index]} of ${needed} wins`}>
                        {Array.from({ length: needed }, (_, pip) => (
                          <ResultPip key={pip} filled={pip < wins[index]} />
                        ))}
                      </ResultPips>
                    </td>
                    <td>{player.alive ? 'Standing' : `Out${note ? ` · ${note}` : ''}`}</td>
                  </ResultRow>
                );
              })}
            </tbody>
          </table>
        </ResultBreakdown>
      ) : (
        <ResultBreakdown>
          <h3>Mission Report</h3>
          <table aria-label="match breakdown">
            <thead>
              <tr>
                <th scope="col">Shinobi</th>
                <th scope="col">Status</th>
                <th scope="col">Final intel</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player, index) => (
                <ResultRow
                  key={player.id}
                  slotColor={playerSlotColor(index)}
                  winner={false}
                >
                  <td>{`${playerSlotLabel(index)} · ${player.name}`}</td>
                  <td>{player.alive ? 'Standing' : 'Out'}</td>
                  <td>
                    {player.alive
                      ? 'Survived'
                      : deathNote(state, player) || player.deathReason || 'Unknown'}
                  </td>
                </ResultRow>
              ))}
            </tbody>
          </table>
          <ResultIntel>
            <span>
              <strong>{threatsLeft}</strong>
              Threats left
            </span>
            <span>
              <strong>
                {state.campaign
                  ? `${completedObjectives}/${state.campaign.objectives.length}`
                  : state.roundWinners.length}
              </strong>
              {state.campaign ? 'Objectives' : 'Rounds scored'}
            </span>
            <span>
              <strong>{state.campaign?.discoveredSecrets.length ?? 0}</strong>
              Secrets
            </span>
          </ResultIntel>
        </ResultBreakdown>
      )}
      <ResultActions>
        {isGameOver
          ? (
            <>
              <Button autoFocus onClick={onRestart} variant="contained" size="large">
                {versus ? 'Rematch' : 'Retry mission'}
              </Button>
              <Button onClick={() => navigate('/config')} variant="outlined">Change setup</Button>
              <Button onClick={() => navigate('/')} variant="outlined">Main menu</Button>
            </>
          )
          : (
            <Button autoFocus onClick={onClose} variant="contained" size="large">Next Round</Button>
          )}
      </ResultActions>
    </StyledResultDialog>
  );
};
