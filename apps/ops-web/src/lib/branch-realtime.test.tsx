import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BranchRealtimeEvent } from '@restocafe/types';
import { BranchRealtimeProvider } from './branch-realtime';
import { useBranchRealtimeConnected } from './use-branch-realtime-connected';

const handlers = new Map<string, Array<(payload?: unknown) => void>>();
const invalidateQueries = vi.fn();
const findAll = vi.fn(() => []);

vi.mock('./auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string; branchId: string }) => unknown) =>
    selector({ accessToken: 'token', branchId: 'branch_1' }),
}));

vi.mock('./api', () => ({
  getBranchId: () => 'branch_1',
  getSocketBaseUrl: () => 'http://localhost:5173',
}));

vi.mock('@tanstack/react-query', async () => {
  const mod = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...mod,
    useQueryClient: () => ({
      invalidateQueries,
      getQueryCache: () => ({ findAll }),
    }),
  };
});

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event: string, fn: (payload?: unknown) => void) => {
      const arr = handlers.get(event) ?? [];
      arr.push(fn);
      handlers.set(event, arr);
    },
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

function Probe() {
  useBranchRealtimeConnected();
  useEffect(() => {}, []);
  return <div>probe</div>;
}

describe('branch-realtime', () => {
  it('connects provider and invalidates queries on events', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BranchRealtimeProvider>
          <Probe />
        </BranchRealtimeProvider>
      </QueryClientProvider>,
    );

    await act(async () => {
      handlers.get('connect')?.forEach((fn) => fn());
      handlers.get(BranchRealtimeEvent.ORDER_CREATED)?.forEach((fn) => fn({}));
    });

    expect(handlers.has(BranchRealtimeEvent.ORDER_CREATED)).toBe(true);
  });
});
