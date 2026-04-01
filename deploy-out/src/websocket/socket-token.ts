import type { Socket } from 'socket.io';

export function tokenFromSocket(client: Socket): string | undefined {
  const auth = client.handshake.auth as { token?: string } | undefined;
  if (auth?.token && typeof auth.token === 'string') {
    return auth.token;
  }
  const h = client.handshake.headers?.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice(7).trim();
  }
  return undefined;
}
