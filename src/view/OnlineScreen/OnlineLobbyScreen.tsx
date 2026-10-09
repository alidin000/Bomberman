import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import { Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { CHARACTER_DEFINITIONS, CharacterId } from '../../content';
import { getOnlineSession } from '../../network/onlineSession';
import { useOnlineSessionSnapshot } from '../../hooks/useOnlineGame';
import {
  CharacterButton, CharacterGrid, CompactButton, Field, OnlineHeader,
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
    session.create(name, characterId);
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
            <p>One room, two browsers, one server-controlled arena.</p>
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
            <SetupGrid>
              <OnlinePanel>
                <h2>Create a private room</h2>
                <p>You receive a six-character invite code.</p>
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
              <p>Hidden Leaf · Best of 3</p>
            </OnlinePanel>
            <OnlinePanel>
              <h2>Players</h2>
              <PlayerList aria-label="room players">
                {[0, 1].map((seat) => {
                  const player = online.players.find((item) => item.seat === seat);
                  let playerStatus = '';
                  if (player) playerStatus = player.ready ? 'Ready' : 'Choosing';
                  return (
                    <li key={seat}>
                      <span>{player ? `P${seat + 1} · ${player.name}` : `P${seat + 1} · Waiting...`}</span>
                      <span>{playerStatus}</span>
                    </li>
                  );
                })}
              </PlayerList>
              <Button variant={ownPlayer?.ready ? 'outlined' : 'contained'} disabled={!ownPlayer || !online.connected} onClick={() => session.setReady(!ownPlayer?.ready)}>
                {ownPlayer?.ready ? 'Not ready' : 'Ready'}
              </Button>
            </OnlinePanel>
          </SetupGrid>
        )}
        <OnlineNotice role="status">{online.error || (online.status === 'connecting' ? 'Connecting...' : '')}</OnlineNotice>
      </OnlineShell>
    </OnlinePage>
  );
}
