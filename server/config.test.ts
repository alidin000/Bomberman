// @vitest-environment node
import { readServerConfig } from './config';

describe('server config from the environment', () => {
  it('leaves every limit to the server defaults when nothing is set', () => {
    expect(readServerConfig({})).toEqual({ port: 8787, host: '0.0.0.0', allowedOrigins: [] });
    // Render's dashboard can hold a key with an empty value.
    expect(readServerConfig({ MAX_ROOMS: '', CLIENT_IP_SOURCE: ' ' }))
      .toEqual({ port: 8787, host: '0.0.0.0', allowedOrigins: [] });
  });

  it('reads every setting it is given', () => {
    expect(readServerConfig({
      PORT: '10000',
      ALLOWED_ORIGINS: 'https://bomberman.example/, https://Other.Example:8443',
      ALLOW_LOCALHOST_ORIGINS: 'true',
      CLIENT_IP_SOURCE: 'header:CF-Connecting-IP',
      DEBUG_CLIENT_IP: '1',
      METRICS_TOKEN: 'a-metrics-token-of-length-32-ok!',
      MAX_ROOMS: '50',
      MAX_ROOMS_PER_IP: '3',
      MAX_SOCKETS: '200',
      MAX_SOCKETS_PER_IP: '12',
      CONNECT_BURST: '10',
      CONNECT_REFILL_MS: '2000',
      CREATE_BURST: '3',
      CREATE_REFILL_MS: '20000',
      CREATE_COOLDOWN_MS: '0',
      JOIN_FAIL_BURST: '5',
      JOIN_FAIL_REFILL_MS: '4000',
      MESSAGES_PER_SECOND: '40',
      UNSEATED_TIMEOUT_MS: '15000',
      LOBBY_TTL_MS: '300000',
      RECONNECT_GRACE_MS: '30000',
      EMPTY_ROOM_TTL_MS: '45000',
      FINISHED_ROOM_TTL_MS: '90000',
      IDLE_ROOM_MS: '420000',
      MAX_ROOM_AGE_MS: '7200000',
      SHUTDOWN_GRACE_MS: '0',
    })).toEqual({
      port: 10_000,
      host: '0.0.0.0',
      allowedOrigins: ['https://bomberman.example', 'https://other.example:8443'],
      allowLocalhostOrigins: true,
      clientIpSource: 'header:cf-connecting-ip',
      debugClientIp: true,
      metricsToken: 'a-metrics-token-of-length-32-ok!',
      maxRooms: 50,
      maxRoomsPerIp: 3,
      maxSockets: 200,
      maxSocketsPerIp: 12,
      connectBurst: 10,
      connectRefillMs: 2000,
      createBurst: 3,
      createRefillMs: 20_000,
      createCooldownMs: 0,
      joinFailBurst: 5,
      joinFailRefillMs: 4000,
      messagesPerSecond: 40,
      unseatedTimeoutMs: 15_000,
      lobbyTtlMs: 300_000,
      reconnectGraceMs: 30_000,
      emptyRoomTtlMs: 45_000,
      finishedRoomTtlMs: 90_000,
      idleRoomMs: 420_000,
      maxRoomAgeMs: 7_200_000,
      shutdownGraceMs: 0,
    });
  });

  it.each([
    'socket', 'xff-left', 'xff-right:1', 'xff-right:2',
  ])('accepts the client address source %s', (source) => {
    expect(readServerConfig({ CLIENT_IP_SOURCE: source }).clientIpSource).toBe(source);
  });

  it('fails at boot and names every invalid value', () => {
    const invalid = {
      PORT: '70000',
      MAX_ROOMS: 'ten',
      CONNECT_BURST: '0',
      UNSEATED_TIMEOUT_MS: '1e3',
      MAX_ROOM_AGE_MS: '9999999999',
      CREATE_COOLDOWN_MS: '-1',
      CLIENT_IP_SOURCE: 'xff-right:0',
      ALLOWED_ORIGINS: 'https://ok.example, bomberman.example',
      ALLOW_LOCALHOST_ORIGINS: 'maybe',
      DEBUG_CLIENT_IP: 'yes',
      METRICS_TOKEN: 'short',
    };
    expect(() => readServerConfig(invalid)).toThrow(Error);
    let message = '';
    try {
      readServerConfig(invalid);
    } catch (error) {
      message = (error as Error).message;
    }
    Object.keys(invalid).forEach((name) => expect(message).toContain(name));
  });

  it.each([
    'proxy', 'xff-right:', 'xff-right:1.5', 'header:', 'header:bad name',
  ])('rejects the client address source %s', (source) => {
    expect(() => readServerConfig({ CLIENT_IP_SOURCE: source })).toThrow('CLIENT_IP_SOURCE');
  });
});
