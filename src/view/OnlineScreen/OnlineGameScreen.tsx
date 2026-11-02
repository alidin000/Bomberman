import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import { Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_KEY_BINDINGS } from '../../constants/props';
import { GameEngineState } from '../../engine';
import { EngineSelector, useEngineSelector } from '../../hooks/engineStore';
import { useOnlineEngine, useOnlineInput, useOnlineStatusSnapshot } from '../../hooks/useOnlineGame';
import { useTouchMode } from '../../input/touchMode';
import { getOnlineSession } from '../../network/onlineSession';
import { useEngineFeedback } from '../GameScreen/useGameFeedback';
import { applyDocumentPreferences, loadGamePreferences } from '../GameScreen/gamePreferences';
import { MatchAnnouncer, MatchHud, MatchScene } from '../GameScreen/MatchLeaves';
import { GameBackground, GameSceneContainer } from '../GameScreen/GameScreen.styles';
import { TouchControls } from '../GameScreen/TouchControls';
import { VillageOverlay } from '../GameScreen/village/VillageOverlay';
import { squareBombPress } from '../../input/villageInteract';
import type { VillageInteractable } from '../../content/villageSquare';
import { MAIN_MENU_LABEL } from '../ConfigScreen/menuCopy';
import {
  CompactButton, ConnectionCurtain, ErrorActions, MatchNetworkBar, OnlineError, OnlinePage,
  OnlineShell, ResultPanel, RoomSkeleton,
} from './OnlineScreen.styles';
import { JOINING_MATCH_MESSAGE, describeOnlineError, findOnlineProblem } from './onlineCopy';

type OnlineMatchStatus = (
  Pick<GameEngineState, 'phase' | 'paused' | 'resultMessage'> & { campaign: boolean }
) | null;

const selectOnlineMatchStatus: EngineSelector<OnlineMatchStatus> = (state, previous) => {
  if (!state) return null;
  if (
    previous
    && previous.phase === state.phase
    && previous.paused === state.paused
    && previous.resultMessage === state.resultMessage
    && previous.campaign === Boolean(state.campaign)
  ) return previous;
  return {
    phase: state.phase,
    paused: state.paused,
    resultMessage: state.resultMessage,
    campaign: Boolean(state.campaign),
  };
};

type SquareUse = { playerId: string; item: VillageInteractable };

export function OnlineGameScreen() {
  const navigate = useNavigate();
  const { roomId = '' } = useParams();
  const session = useMemo(getOnlineSession, []);
  const online = useOnlineStatusSnapshot(session);
  const engine = useOnlineEngine(session);
  const [preferences] = useState(loadGamePreferences);
  const state = useEngineSelector(engine.store, selectOnlineMatchStatus);
  const feedback = useEngineFeedback(engine.store, preferences);
  const touchMode = useTouchMode();
  const canPlay = online.connected && !!state && state.phase === 'playing' && !state.paused;
  // A co-op square's villagers, shrine and gate: the room plays on (no
  // pause), and this seat stands still while its overlay is open.
  const [squareUse, setSquareUse] = useState<SquareUse | null>(null);
  const { seat } = online;
  const squareBomb = useCallback(() => {
    const live = engine.getState();
    const player = live && seat !== null ? live.players[seat] : undefined;
    const press = live && player ? squareBombPress(live, player.id) : null;
    if (!press || !player) return false;
    if (press.item) setSquareUse({ playerId: player.id, item: press.item });
    return true;
  }, [engine, seat]);
  useEffect(() => {
    if (!canPlay) setSquareUse(null);
  }, [canPlay]);

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

  useOnlineInput(session, canPlay && !squareUse, squareBomb);

  const leave = () => {
    session.leave();
    navigate('/');
  };

  // Before the first snapshot: a skeleton of the match, or why it failed.
  if (!state) {
    const problem = online.error ? describeOnlineError(online.error) : null;
    return (
      <OnlinePage>
        <OnlineShell>
          {problem ? (
            <OnlineError role="alert" aria-labelledby="online-match-problem">
              <h1 id="online-match-problem">{problem.title}</h1>
              <p>{problem.detail}</p>
              <ErrorActions>
                <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate(`/online/${roomId.toUpperCase()}`)}>
                  Back to the room
                </Button>
                <Button variant="outlined" onClick={leave}>{MAIN_MENU_LABEL}</Button>
              </ErrorActions>
            </OnlineError>
          ) : (
            <RoomSkeleton role="status">
              <span>{JOINING_MATCH_MESSAGE}</span>
              <div className="skeleton" aria-hidden="true" style={{ width: '100%', height: 48 }} />
              <div
                className="skeleton"
                aria-hidden="true"
                style={{ width: 'min(100%, calc(100dvh - 240px))', aspectRatio: '1 / 1', justifySelf: 'center' }}
              />
              <CompactButton color="inherit" startIcon={<ExitToAppIcon />} onClick={leave} sx={{ justifySelf: 'center' }}>
                Leave room
              </CompactButton>
            </RoomSkeleton>
          )}
        </OnlineShell>
      </OnlinePage>
    );
  }

  const curtainProblem = online.error ? findOnlineProblem(online.error) : undefined;
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
          localSeat={online.seat}
        />
      </GameSceneContainer>
      <MatchAnnouncer store={engine.store} caption={feedback.caption} eventId={feedback.eventId} roundOver={roundOver} held={state.paused || state.phase !== 'playing'} hudScale={preferences.hudScale} campaign={state.campaign} />
      {touchMode && online.seat !== null && (
        // Online has one local control set; the server seat only selects the
        // fighter whose kit and ultimate charge the overlay displays.
        <TouchControls
          store={engine.store}
          slot={online.seat}
          keys={DEFAULT_KEY_BINDINGS['1']}
          enabled={canPlay && !squareUse}
        />
      )}
      {squareUse && (
        <VillageOverlay
          store={engine.store}
          item={squareUse.item}
          playerId={squareUse.playerId}
          onClose={() => setSquareUse(null)}
          closeOnEscape
        />
      )}
      {online.error && state.phase === 'playing' && (
        // The match waits on a dropped seat; the way out stays in reach.
        <ConnectionCurtain>
          <ResultPanel>
            <p role="status"><strong>{curtainProblem?.title ?? online.error}</strong></p>
            {curtainProblem && <p>{curtainProblem.detail}</p>}
            <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={leave}>Leave room</Button>
          </ResultPanel>
        </ConnectionCurtain>
      )}
      {state.phase === 'game_over' && (
        <ConnectionCurtain>
          <ResultPanel role="dialog" aria-label="online match result">
            <h2>{state.resultMessage || 'Match over'}</h2>
            <p>Every player must request a rematch.</p>
            <Button variant="contained" startIcon={<ReplayIcon />} onClick={() => session.setRematch(true)}>Ready for rematch</Button>
            <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={leave}>Leave room</Button>
          </ResultPanel>
        </ConnectionCurtain>
      )}
    </GameBackground>
  );
}
