import { useEffect, useRef, type ReactNode } from 'react';
import { refreshAccessSession, RESTOCAFE_SESSION_RESTORED_EVENT } from './api';
import { getAccessTokenExpiryMs, msUntilProactiveRefresh } from './jwt-expiry';
import { useAuthStore } from './auth-store';

/**
 * Schedules access-token rotation before JWT `exp` so long-lived tabs and Socket.IO
 * stay aligned with HTTP auth (see docs/operations/socket-io-scaling.md).
 */
export function SessionProactiveRefresh({ children }: { children: ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const arm = () => {
      clearTimer();
      const { accessToken, refreshToken } = useAuthStore.getState();
      if (!accessToken?.trim() || !refreshToken?.trim()) {
        return;
      }
      if (getAccessTokenExpiryMs(accessToken) == null) {
        return;
      }
      const wait = msUntilProactiveRefresh(accessToken);
      if (wait == null) {
        return;
      }
      timerRef.current = setTimeout(() => {
        void refreshAccessSession();
      }, wait);
    };

    arm();
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (
        state.accessToken !== prev.accessToken ||
        state.refreshToken !== prev.refreshToken
      ) {
        arm();
      }
    });

    const onRestored = () => {
      arm();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(RESTOCAFE_SESSION_RESTORED_EVENT, onRestored);
    }

    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener(RESTOCAFE_SESSION_RESTORED_EVENT, onRestored);
      }
      clearTimer();
    };
  }, []);

  return <>{children}</>;
}
