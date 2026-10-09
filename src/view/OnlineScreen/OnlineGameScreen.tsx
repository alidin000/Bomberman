import React, { useEffect, useMemo, useState } from 'react';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import { Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useEngineSelector } from '../../hooks/engineStore';
import { useOnlineEngine, useOnlineInput, useOnlineSessionSnapshot } from '../../hooks/useOnlineGame';
import { getOnlineSession } from '../../network/onlineSession';
import { useEngineFeedback } from '../GameScreen/useGameFeedback';
import { applyDocumentPreferences, loadGamePreferences } from '../GameScreen/gamePreferences';
import { MatchAnnouncer, MatchHud, MatchScene } from '../GameScreen/MatchLeaves';
import { GameBackground, GameSceneContainer, LoadingMessage } from '../GameScreen/GameScreen.styles';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  CompactButton, ConnectionCurtain, MatchNetworkBar, ResultPanel
} from './OnlineScreen.styles';

export function OnlineGameScreen() {
  const navigate = useNavigate();
  const { roomId = '' } = useParams();
  const session = useMemo(getOnlineSession, []);
  const online = useOnlineSessionSnapshot(session);
  const engine = useOnlineEngine(session);
  const [preferences] = useState(loadGamePreferences);
  const state = useEngineSelector(engine.store, (current) => current);
  const feedback = useEngineFeedback(engine.store, preferences);

  useEffect(() => applyDocumentPreferences(preferences), [preferences]);
  useEffect(() => {
    if (
      !online.connected
      && roomId
      && !session.resumeStored(roomId.toUpperCase())
    ) {
      navigate(`/online/${roomId.toUpperCase()}`, { replace: true });
    }
  }, [navigate, online.connected, roomId, session]);

  useOnlineInput(session, online.connected && !!state && state.phase === 'playing' && !state.paused);

  const leave = () => {
    session.leave();
    navigate('/');
  };

  if (!state) {
    return (
      <StyledBackground>
        <LoadingMessage>{online.error || 'Joining online match...'}</LoadingMessage>
        <CompactButton color="inherit" onClick={leave}>Back home</CompactButton>
      </StyledBackground>
    );
  }

  const roundOver = state.phase === 'playing' ? null : {
    text: state.resultMessage || (state.phase === 'game_over' ? 'Match over' : 'Round over'),
    accent: 'var(--anime-mustard)',
  };

  return (
    <GameBackground>
      <MatchHud store={engine.store} scale={preferences.hudScale} />
      <MatchNetworkBar aria-label="online match status">
        <strong>{online.roomId}</strong>
        <span>{online.seat === null ? '' : `P${online.seat + 1}`}</span>
        <span>{online.connected ? 'Connected' : 'Reconnecting'}</span>
        <CompactButton size="small" color="inherit" startIcon={<ExitToAppIcon />} onClick={leave}>Leave</CompactButton>
      </MatchNetworkBar>
      <GameSceneContainer>
        <MatchScene
          store={engine.store}
          preferences={preferences}
          impact={feedback.impact}
          motion={engine.motion}
          advanceFrame={engine.advanceFrame}
          liveState={engine.getState}
          idle={!online.connected || state.paused}
        />
      </GameSceneContainer>
      <MatchAnnouncer store={engine.store} caption={feedback.caption} eventId={feedback.eventId} roundOver={roundOver} held={state.paused || state.phase !== 'playing'} hudScale={preferences.hudScale} campaign={false} />
      {online.error && state.phase === 'playing' && <ConnectionCurtain role="status"><strong>{online.error}</strong></ConnectionCurtain>}
      {state.phase === 'game_over' && (
        <ConnectionCurtain>
          <ResultPanel role="dialog" aria-label="online match result">
            <h2>{state.resultMessage || 'Match over'}</h2>
            <p>Both players must request a rematch.</p>
            <Button variant="contained" startIcon={<ReplayIcon />} onClick={() => session.setRematch(true)}>Ready for rematch</Button>
            <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={leave}>Leave room</Button>
          </ResultPanel>
        </ConnectionCurtain>
      )}
    </GameBackground>
  );
}
