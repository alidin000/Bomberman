import React, { useCallback, useMemo, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { DOJO_PATH, dojoRoomPath, isDojoRoomId } from '../../content/dojo';
import {
  DojoRoom, createDojoConfig, getDojoRoom, getNextDojoRoom,
} from '../../content/dojoRooms';
import { recordDojoRoomCleared, recordDojoRoomSkipped } from '../../story/dojoProgress';
import { GameScreen, GameScreenMatch } from '../GameScreen/GameScreen';
import { DojoGoalBand } from './DojoGoalBand';
import { DojoDebrief } from './DojoDebrief';

/**
 * One Training Dojo room: the ordinary match screen (pause, settings, pads)
 * running the room's config, with the goal line over the arena, a debrief in
 * place of the round result, and Skip room in the pause menu.
 */
function DojoRoomMatch({ room }: { room: DojoRoom }) {
  const navigate = useNavigate();
  // Read through a ref so the match object, and with it the running room,
  // never changes for a new navigate function.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const nextRoom = getNextDojoRoom(room.id);

  const goNext = useCallback(() => {
    navigateRef.current(nextRoom ? dojoRoomPath(nextRoom) : DOJO_PATH);
  }, [nextRoom]);
  const skip = useCallback(() => {
    recordDojoRoomSkipped(room.id);
    goNext();
  }, [goNext, room.id]);
  const leave = useCallback(() => navigateRef.current(DOJO_PATH), []);
  const cleared = useCallback(() => recordDojoRoomCleared(room.id), [room.id]);

  const config = useMemo(() => createDojoConfig(room), [room]);
  const match = useMemo<GameScreenMatch>(() => ({
    config,
    exitTo: DOJO_PATH,
    pauseActions: [{ label: 'Skip room', onSelect: skip }],
    renderOverlay: ({
      store, keyBindings, hudScale, showHud,
    }) => (showHud ? (
      <DojoGoalBand room={room} store={store} keyBindings={keyBindings} hudScale={hudScale} />
    ) : null),
    renderResult: ({ open, state, restart }) => (
      <DojoDebrief
        room={room}
        nextRoom={nextRoom}
        open={open}
        state={state}
        restart={restart}
        onNext={goNext}
        onSkip={skip}
        onLeave={leave}
        onCleared={cleared}
      />
    ),
  }), [cleared, config, goNext, leave, nextRoom, room, skip]);

  return <GameScreen match={match} />;
}

export const DojoRoomScreen = () => {
  const { roomId } = useParams();
  if (!isDojoRoomId(roomId)) return <Navigate to={DOJO_PATH} replace />;
  // A new room is a new match: remount, so the next room starts fresh.
  return <DojoRoomMatch key={roomId} room={getDojoRoom(roomId)} />;
};
