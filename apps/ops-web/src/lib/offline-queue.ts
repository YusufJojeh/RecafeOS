import Dexie, { type Table } from 'dexie';
import { STAFF_HTTP_HEADER } from '@restocafe/types';

/** See repo docs: docs/operations/idempotency-and-offline.md (scope and client contract). */
export const OFFLINE_QUEUE_EVENT = 'restocafe:offline-queue-change';

const CLOSE_BILL_PATH = /^\/branches\/([^/]+)\/orders\/([^/]+)\/close$/;

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const v = headers[name] ?? headers[lower];
  const t = typeof v === 'string' ? v.trim() : '';
  return t.length > 0 ? t : undefined;
}

/** Validates Dexie enqueue rules — throws on policy violation (developer / caller bug). */
export function assertEnqueueAllowed(m: Omit<QueuedMutation, 'id' | 'createdAt'>): void {
  if (m.kind !== 'close-bill') {
    throw new Error(
      'offline_queue: only kind "close-bill" may be enqueued (see OFFLINE_REPLAY_BY_OPERATION / idempotency-and-offline.md)',
    );
  }
  if (m.method !== 'POST') {
    throw new Error('offline_queue: close-bill enqueue must use POST');
  }
  const match = CLOSE_BILL_PATH.exec(m.path);
  if (!match) {
    throw new Error(
      'offline_queue: path must be /branches/:branchId/orders/:orderId/close (relative to /api/v1 base)',
    );
  }
  if (!getHeader(m.headers, STAFF_HTTP_HEADER.IDEMPOTENCY_KEY)) {
    throw new Error(
      'offline_queue: Idempotency-Key header is required for queued close-bill replay safety',
    );
  }
  const pathBranchId = match[1];
  const headerBranch = getHeader(m.headers, STAFF_HTTP_HEADER.BRANCH_ID);
  if (!headerBranch || headerBranch !== pathBranchId) {
    throw new Error(
      'offline_queue: X-Branch-Id header must match the branchId segment in the path',
    );
  }
}

export type QueuedMutationKind = 'close-bill';

export type QueuedMutation = {
  id?: number;
  path: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  kind?: QueuedMutationKind;
  label?: string;
  createdAt: number;
};

class OfflineDB extends Dexie {
  mutations!: Table<QueuedMutation, number>;

  constructor() {
    super('restocafe-ops');
    this.version(1).stores({
      mutations: '++id, createdAt',
    });
  }
}

export const offlineDb = new OfflineDB();

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  }
}

export async function enqueueMutation(m: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  assertEnqueueAllowed(m);
  await offlineDb.mutations.add({ ...m, createdAt: Date.now() });
  notifyQueueChanged();
}

export async function drainMutationQueue(runner: (m: QueuedMutation) => Promise<void>) {
  const rows = await offlineDb.mutations.orderBy('createdAt').toArray();
  for (const row of rows) {
    if (row.id == null) {
      continue;
    }
    await runner(row);
    await offlineDb.mutations.delete(row.id);
    notifyQueueChanged();
  }
}

export async function countQueuedMutations(): Promise<number> {
  return offlineDb.mutations.count();
}
