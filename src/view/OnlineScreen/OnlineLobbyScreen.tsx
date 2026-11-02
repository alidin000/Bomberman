import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
import ReplayIcon from '@mui/icons-material/Replay';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import {
  Button, MenuItem, Select, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CHARACTER_DEFINITIONS, CharacterId, STAGE_DEFINITIONS, StageId, getStageDefinition,
} from '../../content';
import { getOnlineSession } from '../../network/onlineSession';
import {
  ONLINE_ROUND_OPTIONS, OnlineRoomMode, OnlineRounds,
} from '../../network/protocol';
import { useOnlineSessionSnapshot } from '../../hooks/useOnlineGame';
import { MAIN_MENU_LABEL } from '../ConfigScreen/menuCopy';
import {
  CharacterButton, CharacterGrid, ChoiceCopy, ChoiceHint, CompactButton, ErrorActions,
  ExperienceChoice, ExperienceGrid, Field, InviteLink, OnlineError, OnlineHeader, OnlinePage,
  OnlinePanel, OnlineShell, PlayerList, RoomCode, RoomSkeleton, RoundToggles, SetupGrid,
} from './OnlineScreen.styles';
import { CONNECTING_MESSAGE, describeOnlineError } from './onlineCopy';

function savedName(): string {
  try {
    return localStorage.getItem('shinobiOnlineName') ?? '';
  } catch {
    return '';
  }
}

type Attempt = 'create' | 'join';
type CopyState = 'idle' | 'copied' | 'failed';

/** While a socket opens: the room's invite and seat panels as skeletons. */
function RoomLoading({ message }: { message: string }) {
  const bar = (width: string, height: number) => (
    <div className="skeleton" aria-hidden="true" style={{ width, height }} />
  );
  return (
    <RoomSkeleton role="status">
      <span>{message}</span>
      <SetupGrid aria-hidden="true">
        <OnlinePanel>
          {bar('45%', 32)}
          {bar('70%', 48)}
          {bar('100%', 44)}
          {bar('60%', 20)}
        </OnlinePanel>
        <OnlinePanel>
          {bar('35%', 32)}
          {[0, 1, 2, 3].map((seat) => <React.Fragment key={seat}>{bar('100%', 48)}</React.Fragment>)}
          {bar('100%', 44)}
        </OnlinePanel>
      </SetupGrid>
    </RoomSkeleton>
  );
}

export function OnlineLobbyScreen() {
  const navigate = useNavigate();
  const { roomId: routeRoomId } = useParams();
  const session = useMemo(getOnlineSession, []);
  const online = useOnlineSessionSnapshot(session);
  const [name, setName] = useState(savedName);
  const [roomCode, setRoomCode] = useState(routeRoomId?.toUpperCase() ?? '');
  const [characterId, setCharacterId] = useState<CharacterId>('naruto');
  const [roomMode, setRoomMode] = useState<OnlineRoomMode>('coop');
  const [stageId, setStageId] = useState<StageId>('hiddenLeaf');
  const [totalRounds, setTotalRounds] = useState<OnlineRounds>(3);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  // The last create or join, so an error can offer the same try again.
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    if (routeRoomId && online.status === 'idle') session.resumeStored(routeRoomId.toUpperCase());
  }, [online.status, routeRoomId, session]);

  useEffect(() => {
    if (online.status === 'playing' && online.roomId) {
      navigate(`/online/${online.roomId}/play`, { replace: true });
    }
  }, [navigate, online.roomId, online.status]);

  const rememberName = () => {
    try {
      localStorage.setItem('shinobiOnlineName', name.trim());
    } catch {
      // The room can still open when storage is unavailable.
    }
  };

  const createRoom = () => {
    if (!name.trim()) return;
    rememberName();
    setAttempt('create');
    session.create(name, characterId, roomMode, stageId, totalRounds);
  };

  const joinRoom = () => {
    if (!name.trim() || roomCode.length !== 6) return;
    rememberName();
    setAttempt('join');
    session.join(roomCode, name, characterId);
  };

  const chooseCharacter = (next: CharacterId) => {
    setCharacterId(next);
    if (online.status === 'lobby') session.selectCharacter(next);
  };

  const ownPlayer = online.players.find((player) => player.seat === online.seat);
  const isHost = online.seat === 0;
  const allReady = online.players.length >= 2
    && online.players.every((player) => player.connected && player.ready);
  const openSeats = Math.max(0, online.capacity - online.players.length);
  const roomStage = getStageDefinition(online.stageId);
  const roomLabel = online.roomMode === 'coop' ? 'Co-op Campaign' : 'Online Arena';
  const inviteUrl = online.roomId ? `${window.location.origin}/online/${online.roomId}` : '';
  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // No clipboard (an insecure page, or permission refused): show the link.
      setCopyState('failed');
    }
  };
  const leave = () => {
    session.leave();
    navigate('/');
  };

  // Opening a socket, or rejoining after a drop: the room is on its way.
  const busy = online.status === 'connecting' || online.status === 'reconnecting';
  const problem = online.error && !busy ? describeOnlineError(online.error) : null;
  const canRetry = Boolean(problem?.retry && attempt);
  const retry = () => (attempt === 'join' ? joinRoom() : createRoom());

  let body: React.ReactNode;
  if (busy) {
    body = <RoomLoading message={online.status === 'reconnecting' && online.error ? online.error : CONNECTING_MESSAGE} />;
  } else if (online.status !== 'lobby') {
    body = (
      <>
        <OnlinePanel>
          <h2>Your fighter</h2>
          <Field>
            Display name
            <input aria-label="display name" value={name} maxLength={16} autoComplete="nickname" onChange={(event) => setName(event.target.value)} />
          </Field>
          <CharacterGrid aria-label="choose fighter">
            {CHARACTER_DEFINITIONS.map((character) => (
              <CharacterButton key={character.id} variant="outlined" chosen={characterId === character.id} aria-pressed={characterId === character.id} onClick={() => chooseCharacter(character.id)}>
                {character.name}
              </CharacterButton>
            ))}
          </CharacterGrid>
        </OnlinePanel>
        <ExperienceGrid>
          <ExperienceChoice
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={() => navigate('/config?mode=solo')}
          >
            <ChoiceCopy>
              <span>Solo Campaign</span>
              <ChoiceHint>Continue your own village journey.</ChoiceHint>
            </ChoiceCopy>
          </ExperienceChoice>
          <ExperienceChoice
            variant={roomMode === 'coop' ? 'contained' : 'outlined'}
            startIcon={<GroupIcon />}
            aria-pressed={roomMode === 'coop'}
            onClick={() => setRoomMode('coop')}
          >
            <ChoiceCopy>
              <span>Co-op Campaign</span>
              <ChoiceHint>Share missions, lives, enemies, and bosses.</ChoiceHint>
            </ChoiceCopy>
          </ExperienceChoice>
          <ExperienceChoice
            variant={roomMode === 'arena' ? 'contained' : 'outlined'}
            startIcon={<SportsKabaddiIcon />}
            aria-pressed={roomMode === 'arena'}
            onClick={() => setRoomMode('arena')}
          >
            <ChoiceCopy>
              <span>Online Arena</span>
              <ChoiceHint>Last shinobi standing wins the round.</ChoiceHint>
            </ChoiceCopy>
          </ExperienceChoice>
        </ExperienceGrid>
        <SetupGrid>
          <OnlinePanel>
            <h2>{`Create ${roomMode === 'coop' ? 'a co-op mission' : 'an arena'}`}</h2>
            <Field>
              Village
              <Select
                inputProps={{ 'aria-label': 'village' }}
                size="small"
                value={stageId}
                onChange={(event) => setStageId(event.target.value as StageId)}
              >
                {STAGE_DEFINITIONS.map((stage) => (
                  <MenuItem key={stage.id} value={stage.id}>{stage.name}</MenuItem>
                ))}
              </Select>
            </Field>
            {roomMode === 'arena' && (
              <RoundToggles>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={totalRounds}
                  aria-label="match rounds"
                  onChange={(_, value: OnlineRounds | null) => {
                    if (value) setTotalRounds(value);
                  }}
                >
                  {ONLINE_ROUND_OPTIONS.map((rounds) => (
                    <ToggleButton key={rounds} value={rounds} aria-label={`${rounds} rounds`}>
                      {rounds === 1 ? '1 Round' : `Best of ${rounds}`}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </RoundToggles>
            )}
            <p>Invite anyone you like. The room holds up to four shinobi.</p>
            <Button variant="contained" startIcon={<PublicIcon />} disabled={!name.trim()} onClick={createRoom}>Create room</Button>
          </OnlinePanel>
          <OnlinePanel>
            <h2>Join a room</h2>
            <Field>
              Room code
              <input aria-label="room code" value={roomCode} maxLength={6} autoCapitalize="characters" onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
            </Field>
            <p>Ask the host for the six character code on their invite.</p>
            <Button variant="outlined" disabled={!name.trim() || roomCode.length !== 6} onClick={joinRoom}>Join room</Button>
          </OnlinePanel>
        </SetupGrid>
      </>
    );
  } else {
    body = (
      <SetupGrid>
        <OnlinePanel>
          <h2>Invite code</h2>
          <RoomCode>{online.roomId}</RoomCode>
          <Button startIcon={<ContentCopyIcon />} variant="outlined" onClick={copyInvite}>
            {copyState === 'copied' ? 'Invite link copied' : 'Copy invite link'}
          </Button>
          {copyState === 'failed' && (
            <>
              <p role="alert">Could not copy the link. Select it below and copy it by hand.</p>
              <InviteLink>{inviteUrl}</InviteLink>
            </>
          )}
          <p>
            {`${roomLabel} · ${roomStage.name}`}
            {online.roomMode === 'arena' ? ` · Best of ${online.totalRounds}` : ''}
          </p>
        </OnlinePanel>
        <OnlinePanel>
          <h2>Players</h2>
          <PlayerList aria-label="room players">
            {Array.from({ length: online.capacity }, (_, seat) => {
              const player = online.players.find((item) => item.seat === seat);
              let playerStatus = '';
              if (player) playerStatus = player.ready ? 'Ready' : 'Choosing';
              return (
                <li key={seat} data-open={!player}>
                  <span>
                    {player ? `P${seat + 1} · ${player.name}${seat === 0 ? ' · Host' : ''}` : `P${seat + 1} · Open`}
                  </span>
                  <span>{playerStatus}</span>
                </li>
              );
            })}
          </PlayerList>
          <p>
            {online.players.length < 2
              ? 'Invite at least one teammate or rival.'
              : `${openSeats} open ${openSeats === 1 ? 'seat' : 'seats'}. The host starts when everyone is ready.`}
          </p>
          <Button variant={ownPlayer?.ready ? 'outlined' : 'contained'} disabled={!ownPlayer || !online.connected} onClick={() => session.setReady(!ownPlayer?.ready)}>
            {ownPlayer?.ready ? 'Not ready' : 'Ready'}
          </Button>
          {isHost && (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={!allReady || !online.connected}
              onClick={() => session.startMatch()}
            >
              {online.roomMode === 'coop' ? 'Start mission' : 'Start battle'}
            </Button>
          )}
        </OnlinePanel>
      </SetupGrid>
    );
  }

  return (
    <OnlinePage>
      <OnlineShell>
        <OnlineHeader>
          <div>
            <h1>Online Room</h1>
            <p>Fight together in a mission or face one another in the arena.</p>
          </div>
          <CompactButton startIcon={<ArrowBackIcon />} color="inherit" onClick={leave}>{MAIN_MENU_LABEL}</CompactButton>
        </OnlineHeader>
        {problem && (
          <OnlineError role="alert" aria-labelledby="online-problem-title">
            <h2 id="online-problem-title">{problem.title}</h2>
            <p>{problem.detail}</p>
            {/* In a room the panels below hold the next step. */}
            {online.status !== 'lobby' && (
              <ErrorActions>
                {canRetry && (
                  <Button variant="contained" startIcon={<ReplayIcon />} onClick={retry}>Try again</Button>
                )}
                <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={leave}>{MAIN_MENU_LABEL}</Button>
              </ErrorActions>
            )}
          </OnlineError>
        )}
        {body}
      </OnlineShell>
    </OnlinePage>
  );
}
