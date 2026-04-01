import type { Socket } from 'socket.io';
import {
  STAFF_AUTH_SCHEME,
  STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY,
} from '@restocafe/types';

export function tokenFromSocket(client: Socket): string | undefined {
  const auth = client.handshake.auth as
    | Record<string, string | undefined>
    | undefined;
  const fromAuth = auth?.[STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY];
  if (fromAuth && typeof fromAuth === 'string') {
    return fromAuth;
  }
  const h = client.handshake.headers?.authorization;
  if (
    typeof h === 'string' &&
    h.startsWith(STAFF_AUTH_SCHEME.BEARER_PREFIX)
  ) {
    return h.slice(STAFF_AUTH_SCHEME.BEARER_PREFIX.length).trim();
  }
  return undefined;
}
