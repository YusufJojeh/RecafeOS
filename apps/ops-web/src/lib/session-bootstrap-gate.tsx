import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/i18n/context';
import { restoreSession } from './api';
import { useAuthStore } from './auth-store';

export function SessionBootstrapGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(() => !refreshToken || !!accessToken);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    if (accessToken || !refreshToken) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    void restoreSession().finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <Card className="w-full max-w-lg border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          {t.auth.restoringSession}
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
