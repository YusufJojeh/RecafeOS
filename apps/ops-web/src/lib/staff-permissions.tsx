import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import type { StaffAuthMeResponse } from '@/lib/contract/auth-api';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export const STAFF_ME_QUERY_KEY = ['auth', 'me'] as const;

type StaffPermissionsValue = {
  permissions: string[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const StaffPermissionsContext = createContext<StaffPermissionsValue | null>(
  null,
);

export function StaffPermissionsProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);

  const q = useQuery({
    queryKey: STAFF_ME_QUERY_KEY,
    queryFn: () =>
      apiFetch<StaffAuthMeResponse>('/auth/me').then((r) => ({
        permissions: r.permissions,
      })),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const value = useMemo<StaffPermissionsValue>(
    () => ({
      permissions: q.data?.permissions ?? [],
      isLoading: q.isLoading,
      isError: q.isError,
      refetch: () => {
        void q.refetch();
      },
    }),
    [q],
  );

  return (
    <StaffPermissionsContext.Provider value={value}>
      {children}
    </StaffPermissionsContext.Provider>
  );
}

export function useStaffPermissions(): StaffPermissionsValue {
  const ctx = useContext(StaffPermissionsContext);
  if (!ctx) {
    throw new Error('useStaffPermissions must be used under StaffPermissionsProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. tests); returns empty permissions. */
export function useStaffPermissionsOptional(): StaffPermissionsValue {
  const ctx = useContext(StaffPermissionsContext);
  const noop = useCallback(() => {}, []);
  if (!ctx) {
    return {
      permissions: [],
      isLoading: false,
      isError: false,
      refetch: noop,
    };
  }
  return ctx;
}
