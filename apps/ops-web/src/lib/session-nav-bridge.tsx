import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RESTOCAFE_SESSION_EXPIRED_EVENT,
  RESTOCAFE_SESSION_RESTORED_EVENT,
} from '@/lib/api';
import { STAFF_ME_QUERY_KEY } from '@/lib/staff-permissions';

/**
 * Keeps routing and server-state caches aligned with JWT rotation and hard sign-outs.
 * - Session expiry: immediate navigation to sign-in (in addition to `RequireAuth`).
 * - Session restored: refetch staff identity and branch lists so permissions stay coherent.
 */
export function SessionNavBridge() {
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const onExpired = () => {
      nav('/login', { replace: true });
    };

    const onRestored = () => {
      void qc.invalidateQueries({ queryKey: STAFF_ME_QUERY_KEY });
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'branches' });
    };

    window.addEventListener(RESTOCAFE_SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(RESTOCAFE_SESSION_RESTORED_EVENT, onRestored);

    return () => {
      window.removeEventListener(RESTOCAFE_SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(RESTOCAFE_SESSION_RESTORED_EVENT, onRestored);
    };
  }, [nav, qc]);

  return null;
}
