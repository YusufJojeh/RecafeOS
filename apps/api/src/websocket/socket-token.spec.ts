import type { Socket } from 'socket.io';
import { tokenFromSocket } from './socket-token';

function mockSocket(partial: {
  auth?: unknown;
  headers?: { authorization?: string };
}): Socket {
  return {
    handshake: {
      auth: partial.auth,
      headers: partial.headers ?? {},
    },
  } as Socket;
}

describe('tokenFromSocket', () => {
  it('returns token from handshake.auth.token', () => {
    const s = mockSocket({
      auth: { token: 'jwt-from-auth' },
      headers: {},
    });
    expect(tokenFromSocket(s)).toBe('jwt-from-auth');
  });

  it('prefers auth.token over Authorization header', () => {
    const s = mockSocket({
      auth: { token: 'from-auth' },
      headers: { authorization: 'Bearer from-header' },
    });
    expect(tokenFromSocket(s)).toBe('from-auth');
  });

  it('returns Bearer token from Authorization when auth.token missing', () => {
    const s = mockSocket({
      auth: {},
      headers: { authorization: 'Bearer header-token' },
    });
    expect(tokenFromSocket(s)).toBe('header-token');
  });

  it('trims Bearer token value', () => {
    const s = mockSocket({
      headers: { authorization: 'Bearer   spaced   ' },
    });
    expect(tokenFromSocket(s)).toBe('spaced');
  });

  it('returns undefined when no token', () => {
    expect(tokenFromSocket(mockSocket({}))).toBeUndefined();
    expect(
      tokenFromSocket(mockSocket({ headers: { authorization: 'Basic x' } })),
    ).toBeUndefined();
  });

  it('ignores non-string auth.token', () => {
    const s = mockSocket({ auth: { token: 123 } });
    expect(tokenFromSocket(s)).toBeUndefined();
  });
});
