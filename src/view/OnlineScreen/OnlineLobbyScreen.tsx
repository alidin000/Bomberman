import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
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
import {
  CharacterButton, CharacterGrid, CompactButton, ExperienceChoice,
  ExperienceGrid, Field, OnlineHeader,
  OnlineNotice, OnlinePage, OnlinePanel, OnlineShell, PlayerList, RoomCode, SetupGrid,
} from './OnlineScreen.styles';

function savedName(): string {
  try {
    return localStorage.getItem('shinobiOnlineName') ?? '';
  } catch {
    return '';
  }
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
  const [copied, setCopied] = useState(false);

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
    session.create(name, characterId, roomMode, stageId, totalRounds);
  };

  const joinRoom = () => {
    if (!name.trim() || roomCode.length !== 6) return;
    rememberName();
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
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const leave = () => {
    session.leave();
    navigate('/');
  };

  return (
    <OnlinePage>
      <OnlineShell>
        <OnlineHeader>
          <div>
            <h1>Online Room</h1>
            <p>Fight together in a mission or face one another in the arena.</p>
          </div>
          <CompactButton startIcon={<ArrowBackIcon />} color="inherit" onClick={leave}>Home</CompactButton>
        </OnlineHeader>
        {online.status !== 'lobby' ? (
          <>
            <OnlinePanel>
              <h2>Your fighter</h2>
              <Field>
                Display name
                <input aria-label="display name" value={name} maxLength={16} autoComplete="nickname" onChange={(event) => setName(event.target.value)} />
              </Field>
              <CharacterGrid aria-label="choose fighter">
                {CHARACTER_DEFINITIONS.map((character) => (
                  <CharacterButton key={character.id} variant="outlined" chosen={characterId === character.id} onClick={() => chooseCharacter(character.id)}>
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
                <strong>Solo Campaign</strong>
                <span>Continue your own village journey.</span>
              </ExperienceChoice>
              <ExperienceChoice
                variant={roomMode === 'coop' ? 'contained' : 'outlined'}
                startIcon={<GroupIcon />}
                onClick={() => setRoomMode('coop')}
              >
                <strong>Co-op Campaign</strong>
                <span>Share missions, lives, enemies, and bosses.</span>
              </ExperienceChoice>
              <ExperienceChoice
                variant={roomMode === 'arena' ? 'contained' : 'outlined'}
                startIcon={<SportsKabaddiIcon />}
                onClick={() => setRoomMode('arena')}
              >
                <strong>Online Arena</strong>
                <span>Last shinobi standing wins the round.</span>
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
                )}
                <p>Invite anyone you like. The room holds up to four shinobi.</p>
                <Button variant="contained" startIcon={<PublicIcon />} disabled={!name.trim() || online.status === 'connecting'} onClick={createRoom}>Create room</Button>
              </OnlinePanel>
              <OnlinePanel>
                <h2>Join a room</h2>
                <Field>
                  Room code
                  <input aria-label="room code" value={roomCode} maxLength={6} autoCapitalize="characters" onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
                </Field>
                <Button variant="outlined" disabled={!name.trim() || roomCode.length !== 6 || online.status === 'connecting'} onClick={joinRoom}>Join room</Button>
              </OnlinePanel>
            </SetupGrid>
          </>
        ) : (
          <SetupGrid>
            <OnlinePanel>
              <h2>Invite code</h2>
              <RoomCode>{online.roomId}</RoomCode>
              <Button startIcon={<ContentCopyIcon />} variant="outlined" onClick={copyInvite}>{copied ? 'Copied' : 'Copy invite link'}</Button>
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
                    <li key={seat}>
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
        )}
        <OnlineNotice role="status">{online.error || (online.status === 'connecting' ? 'Connecting...' : '')}</OnlineNotice>
      </OnlineShell>
    </OnlinePage>
  );
}
