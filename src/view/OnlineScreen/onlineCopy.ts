// What the online screens say when a room cannot open or a match stops: a
// short title for what failed and one line on what to do next. Keyed by the
// session's error text (network/onlineSession), which for server errors is
// the error code with spaces for its dashes, and for a closed room or a lost
// seat the sentence the session maps its detail or reason to.

export type OnlineProblem = {
  title: string;
  detail: string;
  /** Whether trying the same create or join again can help. */
  retry: boolean;
};

const PROBLEMS: Record<string, OnlineProblem> = {
  'Online play is not configured on this build.': {
    title: 'Online play is off in this build',
    detail: 'This copy of the game has no online server set. Local battles and the campaign still work from the main menu.',
    retry: false,
  },
  'Could not connect to the online server.': {
    title: 'Could not reach the online server',
    detail: 'Check your connection, then try again in a moment.',
    retry: true,
  },
  'The room expired.': {
    title: 'The room expired',
    detail: 'Create a new room, or join with another code.',
    retry: false,
  },
  'The room was closed.': {
    title: 'The room was closed',
    detail: 'Create a new room, or join with another code.',
    retry: false,
  },
  'The host left the room.': {
    title: 'The host left the room',
    detail: 'Create a new room, or join with another code.',
    retry: false,
  },
  'A player left the match.': {
    title: 'A player left, so the match ended',
    detail: 'Create a new room to play again.',
    retry: false,
  },
  'The room closed while everyone was away.': {
    title: 'The room closed while everyone was away',
    detail: 'Create a new room, or join with another code.',
    retry: false,
  },
  'A player did not reconnect in time.': {
    title: 'A player did not reconnect in time',
    detail: 'The match ended. Create a new room to play again.',
    retry: false,
  },
  'The match was idle too long.': {
    title: 'The match was idle too long',
    detail: 'Nobody played for a while, so the room closed. Create a new room to play again.',
    retry: false,
  },
  'The room closed after the match.': {
    title: 'The room closed after the match',
    detail: 'Create a new room for another match.',
    retry: false,
  },
  'The room reached its time limit.': {
    title: 'The room reached its time limit',
    detail: 'Create a new room to keep playing.',
    retry: false,
  },
  'The server restarted.': {
    title: 'The server restarted for an update',
    detail: 'Your match ended. Create a new room to play again.',
    retry: false,
  },
  'Your seat moved to another tab.': {
    title: 'This room is open in another tab',
    detail: 'Your seat moved to another tab or window. Carry on playing there.',
    retry: false,
  },
  'Could not rejoin the room.': {
    title: 'Could not rejoin the room',
    detail: 'Check your connection, then try again.',
    retry: true,
  },
  'room full': {
    title: 'That room is full',
    detail: 'A room holds four shinobi. Ask the host for another code, or create your own room.',
    retry: false,
  },
  'room not found': {
    title: 'No room has that code',
    detail: 'Check the six character code with the host, then try again.',
    retry: true,
  },
  'seat expired': {
    title: 'Your seat was released',
    detail: 'You were away too long to keep your place. Join again with the room code.',
    retry: false,
  },
  'upgrade required': {
    title: 'This game is out of date',
    detail: 'The server runs a newer version. Reload the page, then join again.',
    retry: false,
  },
  'match started': {
    title: 'That match has already started',
    detail: 'Wait for the host to open a new room, or create your own.',
    retry: false,
  },
  'rate limited': {
    title: 'Too many tries at once',
    detail: 'Wait a few seconds, then try again.',
    retry: true,
  },
  'server busy': {
    title: 'The server is busy',
    detail: 'It cannot take more players right now. Try again in a minute.',
    retry: true,
  },
  'too many rooms': {
    title: 'Too many rooms from your network',
    detail: 'Finish or leave a room you opened, then try again.',
    retry: true,
  },
  'too many connections': {
    title: 'Too many connections from your network',
    detail: 'Close other game tabs, then try again.',
    retry: true,
  },
  'bad message': {
    title: 'The server could not read the request',
    detail: 'Reload the page, then try again.',
    retry: true,
  },
  'not host': {
    title: 'Only the host can start the match',
    detail: 'Mark yourself ready and wait for the host.',
    retry: false,
  },
  'not ready': {
    title: 'Not everyone is ready',
    detail: 'The match starts once every player in the room is ready.',
    retry: false,
  },
  'not enough players': {
    title: 'The match needs a second player',
    detail: 'Share the invite link, then start once someone joins.',
    retry: false,
  },
};

/** The known problem behind a session error, if it is one of ours. */
export function findOnlineProblem(error: string): OnlineProblem | undefined {
  return PROBLEMS[error];
}

/** A known problem, or the error itself with a next step. */
export function describeOnlineError(error: string): OnlineProblem {
  const known = findOnlineProblem(error);
  if (known) return known;
  const what = error.trim().replace(/\.$/, '');
  return {
    title: 'Online play stopped',
    detail: `${what.charAt(0).toUpperCase()}${what.slice(1)}. Try again, or go back to the main menu.`,
    retry: true,
  };
}

/** Shown while a socket opens; the session words its own rejoin message. */
export const CONNECTING_MESSAGE = 'Connecting to the online server...';
export const JOINING_MATCH_MESSAGE = 'Joining online match...';
