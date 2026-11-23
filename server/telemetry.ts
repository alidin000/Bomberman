// Operator diagnostics: one JSON line per event and a few counters. Lines
// never carry seat tokens, player names, raw addresses or message bodies.
import { createHmac, randomBytes } from 'node:crypto';

export type LogEntry = { ts: string; event: string; [field: string]: unknown };

export type ProtocolErrorKind = 'parse' | 'version' | 'frame' | 'state';

/** Counts since boot. */
export type OnlineServerCounters = {
  roomsCreated: number;
  matchesStarted: number;
  matchesFinished: number;
  /** By close detail, such as 'finished' or 'seat-timeout'. */
  roomsClosed: Record<string, number>;
  /** Refused handshakes, sockets and creates, by reason. */
  rejects: Record<string, number>;
  /** By scope: connect, create, create-cooldown, join or message. */
  rateLimits: Record<string, number>;
  protocolErrors: Record<ProtocolErrorKind, number>;
  /** Seated sockets that went away. */
  disconnects: number;
  /** Sockets that ended without a close frame. */
  abnormalCloses: number;
  reconnects: number;
  /** By the reason sent with 'seat-expired'. */
  resumeFailures: Record<string, number>;
  snapshotDrops: number;
  resyncs: number;
  matchDurationMs: { count: number; sum: number; max: number };
};

export type OnlineServerMetrics = {
  rooms: { waiting: number; active: number; finished: number };
  sockets: { seated: number; seatless: number };
} & OnlineServerCounters;

export function createCounters(): OnlineServerCounters {
  return {
    roomsCreated: 0,
    matchesStarted: 0,
    matchesFinished: 0,
    roomsClosed: {},
    rejects: {},
    rateLimits: {},
    protocolErrors: {
      parse: 0, version: 0, frame: 0, state: 0,
    },
    disconnects: 0,
    abnormalCloses: 0,
    reconnects: 0,
    resumeFailures: {},
    snapshotDrops: 0,
    resyncs: 0,
    matchDurationMs: { count: 0, sum: 0, max: 0 },
  };
}

/** The default sink: one JSON object per stdout line, which Render's log view keeps. */
export function writeLogLine(entry: LogEntry): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

/**
 * Turns an address key into a short keyed digest. The key changes every
 * boot, so lines can be correlated within one run but not reversed.
 */
export function createAddressTagger(): (key: string) => string {
  const secret = randomBytes(32);
  return (key) => createHmac('sha256', secret).update(key).digest('hex').slice(0, 10);
}
