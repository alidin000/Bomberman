/* eslint-disable react/require-default-props */
import React from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ResultActions,
  ResultBanner,
  ResultBreakdown,
  ResultIntel,
  ResultMessage,
  ResultRow,
  ResultTone,
  RESULT_TONE_ACCENTS,
  StyledResultDialog,
} from './RoundResultDialog.styles';
import { GameEngineState } from '../../engine/types';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';

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

// Versus: who won, by slot, as the headline (two players can be the same
// shinobi, so the name alone is ambiguous). Mirrors the engine's rule: the
// round goes to the last one standing, the match to the most round wins.
function getVersusWinnerSlot(state: GameEngineState, isGameOver: boolean): number | null {
  if (isGameOver) {
    const wins = state.players.map((player) => (
      state.roundWinners.filter((winner) => winner === player.id).length
    ));
    const best = Math.max(0, ...wins);
    const leaders = wins.filter((count) => count === best).length;
    return best > 0 && leaders === 1 ? wins.indexOf(best) : null;
  }
  const lastWinner = state.roundWinners[state.roundWinners.length - 1];
  const slot = state.players.findIndex((player) => player.id === lastWinner);
  return slot >= 0 ? slot : null;
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
  const versus = !state.campaign && state.config.mode !== 'solo';
  const winnerSlot = versus ? getVersusWinnerSlot(state, isGameOver) : null;
  const winner = winnerSlot !== null ? state.players[winnerSlot] : null;
  let title = getResultTitle(isGameOver, tone);
  if (versus) {
    const roundLabel = isGameOver ? '' : `Round ${state.round}: `;
    title = winner && winnerSlot !== null
      ? `${roundLabel}${playerSlotLabel(winnerSlot)} · ${winner.name} wins`
      : `${roundLabel}Draw`;
  }
  const accent = winnerSlot !== null ? playerSlotColor(winnerSlot) : RESULT_TONE_ACCENTS[tone];
  const accentText = winnerSlot !== null ? playerSlotTextColor(winnerSlot) : 'var(--anime-ink)';
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
      aria-labelledby="round-result-title"
    >
      <ResultBanner id="round-result-title" accent={accent} textColor={accentText}>
        {title}
      </ResultBanner>
      <ResultMessage>{resultMessage}</ResultMessage>
      <ResultBreakdown>
        <h3>{versus ? 'Match Report' : 'Mission Report'}</h3>
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
            {state.players.map((player, index) => (
              <ResultRow
                key={player.id}
                slotColor={playerSlotColor(index)}
                winner={index === winnerSlot}
              >
                {/* Players may pick the same shinobi; the slot tells them apart. */}
                <td>{`${playerSlotLabel(index)} · ${player.name}`}</td>
                <td>{player.alive ? 'Standing' : 'Sealed'}</td>
                <td>{state.roundWinners.filter((id) => id === player.id).length}</td>
                <td>{player.deathReason ?? (player.alive ? 'Survived' : 'Unknown')}</td>
              </ResultRow>
            ))}
          </tbody>
        </table>
        {/* Mission intel only means something in the campaign; versus already
            has round wins in the table. */}
        {!versus && (
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
        )}
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
