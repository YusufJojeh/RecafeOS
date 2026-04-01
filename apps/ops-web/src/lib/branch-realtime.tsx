import {
  BranchRealtimeEvent,
  STAFF_WS,
  STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY,
} from '@restocafe/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './auth-store';
import { getBranchId, getSocketBaseUrl } from './api';
import { BranchRealtimeConnectedContext } from './use-branch-realtime-connected';

const DEBOUNCE_MS = 320;

/** Random 0–3 s jitter before reconnect resync to stagger HTTP storms when many clients reconnect simultaneously (e.g. venue Wi-Fi blip). */
const RECONNECT_JITTER_MS = 3_000;

/** Skip reconnect resync if all operational queries are still fresh (avoids redundant HTTP on brief disconnects). */
const RECONNECT_FRESHNESS_MS = 4_000;

/** Which React Query roots to invalidate for a given realtime event (narrower = less HTTP load). */
const EVENT_INVALIDATION: Partial<
  Record<(typeof BranchRealtimeEvent)[keyof typeof BranchRealtimeEvent], string[]>
> = {
  [BranchRealtimeEvent.ORDER_CREATED]: [
    'tickets',
    'tables',
    'open-orders',
    'ops-snapshot',
  ],
  [BranchRealtimeEvent.ORDER_UPDATED]: [
    'tickets',
    'tables',
    'open-orders',
    'reports',
    'ops-snapshot',
  ],
  [BranchRealtimeEvent.ORDER_SENT_TO_PREPARATION]: [
    'tickets',
    'tables',
    'open-orders',
  ],
  [BranchRealtimeEvent.ORDER_PAID]: [
    'tickets',
    'tables',
    'open-orders',
    'reports',
    'ops-snapshot',
  ],
  [BranchRealtimeEvent.ORDER_MOVED]: [
    'tickets',
    'tables',
    'open-orders',
  ],
  [BranchRealtimeEvent.ORDER_CANCELLED]: [
    'tickets',
    'tables',
    'open-orders',
    'reports',
    'ops-snapshot',
  ],
  [BranchRealtimeEvent.TICKET_UPDATED]: ['tickets', 'tables', 'open-orders'],
  [BranchRealtimeEvent.WAITER_CALL]: ['tickets', 'tables', 'open-orders'],
};

/** If a new `BranchRealtimeEvent` is added server-side but not listed above, avoid five-root fan-out in production. */
const FALLBACK_INVALIDATION_PROD = [
  'tickets',
  'tables',
  'open-orders',
] as const;
const FALLBACK_INVALIDATION_DEV = [
  'tickets',
  'tables',
  'reports',
  'open-orders',
  'ops-snapshot',
] as const;

/**
 * Maintains a branch-scoped Socket.IO connection and invalidates React Query caches on
 * server-pushed events. When connected, kitchen/bar can disable HTTP polling.
 */
export function BranchRealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useAuthStore((s) => s.branchId);
  const [connected, setConnected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRootsRef = useRef<Set<string>>(new Set());
  /** Merged per debounce window: narrow ticket invalidation when server sends `station` on `ticket.updated`. */
  const ticketInvRef = useRef<
    | { mode: 'all' }
    | { mode: 'narrow'; stations: Set<'KITCHEN' | 'BAR'> }
  >({ mode: 'narrow', stations: new Set() });

  useEffect(() => {
    if (!accessToken || !branchId) {
      setConnected(false);
      return;
    }

    const base = getSocketBaseUrl();
    const socket: Socket = io(`${base}${STAFF_WS.NAMESPACE}`, {
      auth: { [STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY]: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      path: STAFF_WS.ENGINE_PATH,
    });

    const noteTicketsScope = (
      eventName: string,
      roots: string[],
      payload?: unknown,
    ) => {
      if (!roots.includes('tickets')) {
        return;
      }
      if (
        eventName === BranchRealtimeEvent.TICKET_UPDATED &&
        payload &&
        typeof payload === 'object' &&
        'station' in payload
      ) {
        const st = (payload as { station?: string }).station;
        if (st === 'KITCHEN' || st === 'BAR') {
          const cur = ticketInvRef.current;
          if (cur.mode === 'narrow') {
            cur.stations.add(st);
          }
          return;
        }
      }
      ticketInvRef.current = { mode: 'all' };
    };

    const flushInvalidation = () => {
      const bid = getBranchId();
      const roots = pendingRootsRef.current;
      pendingRootsRef.current = new Set();
      const ticketSnap = ticketInvRef.current;
      ticketInvRef.current = { mode: 'narrow', stations: new Set() };

      if (!bid) {
        return;
      }
      if (roots.size === 0) {
        return;
      }

      if (roots.has('tickets')) {
        if (
          ticketSnap.mode === 'all' ||
          (ticketSnap.mode === 'narrow' && ticketSnap.stations.size === 0)
        ) {
          void qc.invalidateQueries({
            predicate: (q) => q.queryKey[0] === 'tickets',
          });
        } else {
          for (const st of ticketSnap.stations) {
            void qc.invalidateQueries({ queryKey: ['tickets', st, bid] });
          }
        }
      }

      for (const root of roots) {
        if (root === 'tickets') {
          continue;
        }
        if (root === 'reports') {
          void qc.invalidateQueries({
            predicate: (q) => q.queryKey[0] === 'reports' && q.queryKey[1] === bid,
          });
          continue;
        }
        void qc.invalidateQueries({ queryKey: [root, bid] });
      }
    };

    const scheduleInvalidation = (eventName: string, payload?: unknown) => {
      const mapped =
        EVENT_INVALIDATION[eventName as keyof typeof EVENT_INVALIDATION];
      const roots =
        mapped ??
        (import.meta.env.PROD
          ? [...FALLBACK_INVALIDATION_PROD]
          : [...FALLBACK_INVALIDATION_DEV]);
      if (mapped == null && import.meta.env.DEV) {
        console.warn(
          `[branch-realtime] Missing EVENT_INVALIDATION for "${eventName}"; using development fallback`,
        );
      }
      noteTicketsScope(eventName, roots, payload);
      for (const r of roots) {
        pendingRootsRef.current.add(r);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        flushInvalidation();
      }, DEBOUNCE_MS);
    };

    const eventHandlers: Partial<Record<string, (payload: unknown) => void>> = {};
    for (const ev of Object.values(BranchRealtimeEvent)) {
      const handler = (payload: unknown) => scheduleInvalidation(ev, payload);
      eventHandlers[ev] = handler;
      socket.on(ev, handler);
    }

    const join = () => {
      const bid = getBranchId();
      if (bid) {
        socket.emit(STAFF_WS.CLIENT_EVENT_JOIN_BRANCH, { branchId: bid });
      }
    };

    /**
     * After automatic reconnect, refetch branch ops data once (events may have been missed).
     * Random jitter staggers HTTP load when many clients reconnect simultaneously
     * (e.g. after brief WiFi outage in the venue). Critical operational queries
     * (tickets, tables, open-orders) invalidate first; reports after a short delay.
     */
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;
    const resyncAfterReconnect = () => {
      const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS);
      resyncTimer = setTimeout(() => {
        resyncTimer = null;
        const bid = getBranchId();
        if (!bid) return;

        // Skip resync if operational queries are still fresh (brief disconnect < 4s).
        const opsRoots = ['tickets', 'tables', 'open-orders', 'ops-snapshot'];
        const now = Date.now();
        const cache = qc.getQueryCache();
        const allFresh = opsRoots.every((root) => {
          const matches = cache.findAll({ predicate: (q) => q.queryKey[0] === root });
          return matches.length > 0 && matches.every((q) =>
            now - q.state.dataUpdatedAt < RECONNECT_FRESHNESS_MS,
          );
        });
        if (allFresh) return;

        // Phase 1: operational queries (immediate after jitter)
        void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tickets' });
        void qc.invalidateQueries({ queryKey: ['open-orders', bid] });
        void qc.invalidateQueries({ queryKey: ['tables', bid] });
        void qc.invalidateQueries({ queryKey: ['ops-snapshot', bid] });
        // Phase 2: reports (staggered 500ms later — less urgent, heavier queries)
        setTimeout(() => {
          void qc.invalidateQueries({
            predicate: (q) => q.queryKey[0] === 'reports' && q.queryKey[1] === bid,
          });
        }, 500);
      }, jitter);
    };

    socket.on('connect', () => {
      setConnected(true);
      join();
    });
    socket.on('reconnect', resyncAfterReconnect);
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      if (resyncTimer) {
        clearTimeout(resyncTimer);
        resyncTimer = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      pendingRootsRef.current.clear();
      ticketInvRef.current = { mode: 'narrow', stations: new Set() };
      for (const ev of Object.values(BranchRealtimeEvent)) {
        const h = eventHandlers[ev];
        if (h) {
          socket.off(ev, h);
        }
      }
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [accessToken, branchId, qc]);

  return (
    <BranchRealtimeConnectedContext.Provider value={connected}>
      {children}
    </BranchRealtimeConnectedContext.Provider>
  );
}
