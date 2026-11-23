// Who may connect and how often: origin checks, the client address that
// per-address limits count against, and the token buckets behind them.
import { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';

/**
 * Where the client address comes from. 'socket' is the TCP peer. Behind a
 * proxy every socket comes from the proxy, so a forwarded value is read
 * instead: the leftmost or the nth-from-right X-Forwarded-For entry, or one
 * single-value header.
 */
export type ClientIpSource =
  | 'socket' | 'xff-left' | `xff-right:${number}` | `header:${string}`;

const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
// Some proxies write the port too: 'a.b.c.d:port' or '[v6]:port'.
const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/;
const BRACKETED_IPV6 = /^\[([^\]]+)\](?::\d+)?$/;
// An address unseen this long, with no socket or room, is forgotten.
const PEER_IDLE_MS = 10 * 60_000;
const MAX_PEERS = 10_000;

export function parseClientIpSource(value: string): ClientIpSource | null {
  const text = value.trim();
  if (text === 'socket' || text === 'xff-left') return text;
  const hops = /^xff-right:(\d+)$/.exec(text);
  if (hops) {
    const count = Number(hops[1]);
    return Number.isSafeInteger(count) && count >= 1 ? `xff-right:${count}` : null;
  }
  const header = /^header:(.+)$/.exec(text);
  if (!header) return null;
  const name = header[1].toLowerCase();
  return HEADER_NAME.test(name) ? `header:${name}` : null;
}

function validAddress(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  const bare = IPV4_WITH_PORT.exec(text)?.[1] ?? BRACKETED_IPV6.exec(text)?.[1] ?? text;
  return bare && isIP(bare) ? bare : null;
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

/** The client's address as `source` says to read it; with none there, the socket's. */
export function clientAddress(request: IncomingMessage, source: ClientIpSource): string {
  const socketAddress = request.socket.remoteAddress ?? 'unknown';
  if (source === 'socket') return socketAddress;
  if (source.startsWith('header:')) {
    return validAddress(headerValue(request, source.slice('header:'.length))) ?? socketAddress;
  }
  const entries = (headerValue(request, 'x-forwarded-for') ?? '').split(',');
  if (source === 'xff-left') {
    // A proxy that hides who it serves writes 'unknown': the next entry,
    // that proxy's own address, keys its users better than our proxy's.
    return entries.map((entry) => validAddress(entry)).find(Boolean) ?? socketAddress;
  }
  // Only the configured hop is trusted; anything left of it is the client's word.
  const index = entries.length - Number(source.slice('xff-right:'.length));
  return (index >= 0 ? validAddress(entries[index]) : null) ?? socketAddress;
}

function ipv6Groups(address: string): string[] {
  const [bare] = address.split('%');
  const [head, tail] = bare.split('::');
  const groupsOf = (part: string | undefined) => (part ? part.split(':') : []);
  // An embedded IPv4 address fills the last two groups.
  const width = (groups: string[]) => groups.reduce(
    (sum, group) => sum + (group.includes('.') ? 2 : 1),
    0
  );
  const front = groupsOf(head);
  const back = groupsOf(tail);
  const zeros = tail === undefined ? [] : Array(8 - width(front) - width(back)).fill('0');
  return [...front, ...zeros, ...back]
    .map((group) => (group.includes('.') ? group : parseInt(group, 16).toString(16)));
}

/**
 * The key per-address limits count against: an IPv4 address as is (also
 * when IPv4-mapped), an IPv6 address by its /64, which one household or
 * phone usually holds whole.
 */
export function addressKey(address: string): string {
  const mapped = IPV4_MAPPED.exec(address);
  if (mapped) return mapped[1];
  if (isIP(address) !== 6) return address;
  return `${ipv6Groups(address).slice(0, 4).join(':')}::/64`;
}

/**
 * The wider key an IPv6 address also counts against: its /48, which one
 * site, such as a home or a tunnel, may hold whole. Null for IPv4.
 */
export function siteKey(address: string): string | null {
  if (IPV4_MAPPED.test(address) || isIP(address) !== 6) return null;
  return `${ipv6Groups(address).slice(0, 3).join(':')}::/48`;
}

/** The scheme, host and port a browser sends as Origin, or null for anything else. */
export function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function isLocalhostOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN.test(origin);
}

export type TokenBucket = {
  /** Whether a token is there, without spending it. */
  has: (now: number) => boolean;
  take: (now: number) => boolean;
};

/** An allowance of `burst` at once that refills one token every `refillMs`. */
export function createTokenBucket(burst: number, refillMs: number, startedAt: number): TokenBucket {
  let tokens = burst;
  let updatedAt = startedAt;
  const has = (now: number) => {
    const elapsed = now - updatedAt;
    if (elapsed > 0) {
      tokens = Math.min(burst, tokens + elapsed / refillMs);
      updatedAt = now;
    }
    return tokens >= 1;
  };
  return {
    has,
    take: (now) => {
      if (!has(now)) return false;
      tokens -= 1;
      return true;
    },
  };
}

export type PeerLimits = {
  connectBurst: number;
  connectRefillMs: number;
  createBurst: number;
  createRefillMs: number;
  joinFailBurst: number;
  joinFailRefillMs: number;
};

/** Everything the server counts against one client address. */
export type Peer = {
  key: string;
  /** Keyed digest of the address: the only form that reaches the logs. */
  tag: string;
  sockets: number;
  rooms: number;
  connect: TokenBucket;
  create: TokenBucket;
  joinFail: TokenBucket;
  lastCreateAt: number | null;
  seenAt: number;
  /** Per log line kind: when it was last written, and how many were held back since. */
  logWindows: Map<string, { at: number; suppressed: number }>;
};

/** Per-address state, oldest first, bounded so a spoofed flood cannot grow it without end. */
export class PeerTable {
  private readonly peers = new Map<string, Peer>();

  private readonly limits: PeerLimits;

  private readonly tagOf: (key: string) => string;

  constructor(limits: PeerLimits, tagOf: (key: string) => string) {
    this.limits = limits;
    this.tagOf = tagOf;
  }

  get(key: string, now: number): Peer {
    const known = this.peers.get(key);
    const peer = known ?? {
      key,
      tag: this.tagOf(key),
      sockets: 0,
      rooms: 0,
      connect: createTokenBucket(this.limits.connectBurst, this.limits.connectRefillMs, now),
      create: createTokenBucket(this.limits.createBurst, this.limits.createRefillMs, now),
      joinFail: createTokenBucket(this.limits.joinFailBurst, this.limits.joinFailRefillMs, now),
      lastCreateAt: null,
      seenAt: now,
      logWindows: new Map(),
    };
    peer.seenAt = now;
    // Re-inserting keeps the map ordered by last use.
    this.peers.delete(key);
    this.peers.set(key, peer);
    if (!known && this.peers.size > MAX_PEERS) this.evict(this.peers.size - MAX_PEERS);
    return peer;
  }

  /** Forgets addresses idle past the window; ones holding a socket or a room stay. */
  prune(now: number): void {
    Array.from(this.peers.values()).some((peer) => {
      if (now - peer.seenAt < PEER_IDLE_MS) return true;
      if (peer.sockets === 0 && peer.rooms === 0) this.peers.delete(peer.key);
      return false;
    });
  }

  private evict(count: number): void {
    let left = count;
    Array.from(this.peers.values()).some((peer) => {
      if (peer.sockets === 0 && peer.rooms === 0) {
        this.peers.delete(peer.key);
        left -= 1;
      }
      return left <= 0;
    });
  }
}
