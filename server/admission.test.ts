// @vitest-environment node
import { IncomingMessage } from 'node:http';
import {
  addressKey, clientAddress, normalizeOrigin, siteKey,
} from './admission';

function request(remoteAddress: string, headers: Record<string, string> = {}) {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe('client address keys', () => {
  it('counts an IPv4-mapped address as the IPv4 address', () => {
    expect(addressKey('::ffff:198.51.100.9')).toBe(addressKey('198.51.100.9'));
    expect(addressKey('198.51.100.9')).toBe('198.51.100.9');
  });

  it('counts IPv6 by its /64 whatever the spelling', () => {
    const key = addressKey('2001:db8:1:2::1');
    expect(addressKey('2001:0DB8:0001:0002:ffff:0:0:9')).toBe(key);
    expect(addressKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(key);
    expect(addressKey('2001:db8:1:3::1')).not.toBe(key);
    expect(addressKey('::1')).not.toBe(key);
  });

  it('groups IPv6 by its /48 as well, and IPv4 not at all', () => {
    const site = siteKey('2001:db8:1:2::1');
    expect(siteKey('2001:0DB8:0001:ffff::9')).toBe(site);
    expect(siteKey('2001:db8:2::1')).not.toBe(site);
    expect(siteKey('198.51.100.9')).toBeNull();
    expect(siteKey('::ffff:198.51.100.9')).toBeNull();
  });

  it('reads the configured hop and falls back to the socket for anything else', () => {
    const proxied = request('10.0.0.5', { 'x-forwarded-for': '198.51.100.7, 203.0.113.9' });
    expect(clientAddress(proxied, 'socket')).toBe('10.0.0.5');
    expect(clientAddress(proxied, 'xff-left')).toBe('198.51.100.7');
    expect(clientAddress(proxied, 'xff-right:1')).toBe('203.0.113.9');
    expect(clientAddress(proxied, 'xff-right:2')).toBe('198.51.100.7');
    // Fewer hops than configured: the header cannot be trusted.
    expect(clientAddress(proxied, 'xff-right:3')).toBe('10.0.0.5');
    expect(clientAddress(request('10.0.0.5'), 'xff-left')).toBe('10.0.0.5');
    // xff-left reads past entries that are not addresses, and drops a port.
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': 'unknown, 198.51.100.7' }),
      'xff-left'
    )).toBe('198.51.100.7');
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': '198.51.100.7:4433, 203.0.113.9' }),
      'xff-left'
    )).toBe('198.51.100.7');
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': '[2001:db8::7]:443' }),
      'xff-left'
    )).toBe('2001:db8::7');
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': 'unknown, _hidden' }),
      'xff-left'
    )).toBe('10.0.0.5');
    // The hop a trusted proxy wrote is never traded for one the client wrote.
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': '198.51.100.7, unknown' }),
      'xff-right:1'
    )).toBe('10.0.0.5');
    expect(clientAddress(
      request('10.0.0.5', { 'x-forwarded-for': '198.51.100.7, 203.0.113.9:80' }),
      'xff-right:1'
    )).toBe('203.0.113.9');
    expect(clientAddress(
      request('10.0.0.5', { 'cf-connecting-ip': ' 2001:db8::7 ' }),
      'header:cf-connecting-ip'
    )).toBe('2001:db8::7');
    expect(clientAddress(
      request('10.0.0.5', { 'cf-connecting-ip': 'unknown' }),
      'header:cf-connecting-ip'
    )).toBe('10.0.0.5');
  });
});

describe('origin normalisation', () => {
  it('compares the scheme, host and port that a browser sends', () => {
    expect(normalizeOrigin('https://Bomberman.example/')).toBe('https://bomberman.example');
    expect(normalizeOrigin('https://bomberman.example:443')).toBe('https://bomberman.example');
    expect(normalizeOrigin('http://localhost:5173/path')).toBe('http://localhost:5173');
    expect(normalizeOrigin('null')).toBeNull();
    expect(normalizeOrigin('bomberman.example')).toBeNull();
    expect(normalizeOrigin('ftp://bomberman.example')).toBeNull();
  });
});
