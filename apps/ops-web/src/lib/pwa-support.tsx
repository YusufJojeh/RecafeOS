import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { useLanguage } from '@/i18n/context';
import { getStaffBranchIdFromHeaders } from '@restocafe/types';
import {
  ApiError,
  apiFetch,
  isNetworkError,
} from '@/lib/api';
import {
  OFFLINE_QUEUE_EVENT,
  countQueuedMutations,
  drainMutationQueue,
} from '@/lib/offline-queue';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useAuthStore } from './auth-store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type OperationalPwaContextValue = {
  canInstall: boolean;
  dismissInstallNotice: () => void;
  dismissMobileNotice: () => void;
  installDismissed: boolean;
  isInstalled: boolean;
  mobileNoticeDismissed: boolean;
  online: boolean;
  promptInstall: () => Promise<boolean>;
  queueCount: number;
  queueSyncing: boolean;
};

const INSTALL_NOTICE_DISMISSED_KEY = 'restocafe-pwa-install-dismissed';
const MOBILE_NOTICE_DISMISSED_KEY = 'restocafe-pwa-mobile-dismissed';

const OperationalPwaContext = createContext<OperationalPwaContextValue | null>(null);

function readBooleanPreference(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeBooleanPreference(key: string, value: boolean) {
  try {
    if (value) {
      localStorage.setItem(key, '1');
      return;
    }
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readStandaloneMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

export function OperationalPwaProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const online = useOnlineStatus();
  const hadOfflineRef = useRef(false);
  const syncingRef = useRef(false);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(readStandaloneMode);
  const [queueCount, setQueueCount] = useState(0);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(() =>
    readBooleanPreference(INSTALL_NOTICE_DISMISSED_KEY),
  );
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(() =>
    readBooleanPreference(MOBILE_NOTICE_DISMISSED_KEY),
  );

  const refreshQueueCount = useCallback(async () => {
    setQueueCount(await countQueuedMutations());
  }, []);

  const invalidateQueuedBranches = useCallback(
    async (branchIds: Set<string>) => {
      await Promise.all(
        [...branchIds].map((branchId) =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: ['open-orders', branchId] }),
            queryClient.invalidateQueries({ queryKey: ['tables', branchId] }),
            queryClient.invalidateQueries({ queryKey: ['ops-snapshot', branchId] }),
            queryClient.invalidateQueries({
              predicate: (query) =>
                query.queryKey[0] === 'reports' && query.queryKey[1] === branchId,
            }),
          ]),
        ),
      );
    },
    [queryClient],
  );

  const syncQueuedMutations = useCallback(async () => {
    if (!online || !accessToken || syncingRef.current) {
      return;
    }

    const queued = await countQueuedMutations();
    setQueueCount(queued);
    if (queued === 0) {
      return;
    }

    syncingRef.current = true;
    setQueueSyncing(true);
    const branchIdsToInvalidate = new Set<string>();
    let synced = 0;
    let dropped = 0;

    try {
      await drainMutationQueue(async (mutation) => {
        try {
          await apiFetch(mutation.path, {
            method: mutation.method,
            body: mutation.body,
            headers: mutation.headers,
          });
          const branchId = getStaffBranchIdFromHeaders(mutation.headers);
          if (branchId) {
            branchIdsToInvalidate.add(branchId);
          }
          synced += 1;
        } catch (error) {
          if (
            error instanceof ApiError &&
            [404, 409, 422].includes(error.status)
          ) {
            const branchId = getStaffBranchIdFromHeaders(mutation.headers);
            if (branchId) {
              branchIdsToInvalidate.add(branchId);
            }
            dropped += 1;
            return;
          }
          throw error;
        }
      });

      if (synced > 0) {
        toast.success(
          t.pwa.queueSynced.replace('{count}', String(synced)),
        );
      }
      if (dropped > 0) {
        toast.warning(
          t.pwa.queueDropped.replace('{count}', String(dropped)),
        );
      }
    } catch (error) {
      if (!isNetworkError(error)) {
        toast.error(t.pwa.queueStillWaiting);
      }
    } finally {
      await invalidateQueuedBranches(branchIdsToInvalidate);
      await refreshQueueCount();
      syncingRef.current = false;
      setQueueSyncing(false);
    }
  }, [
    accessToken,
    invalidateQueuedBranches,
    online,
    refreshQueueCount,
    t.pwa.queueDropped,
    t.pwa.queueStillWaiting,
    t.pwa.queueSynced,
  ]);

  useEffect(() => {
    void refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    const onQueueChange = () => {
      void refreshQueueCount();
      void syncQueuedMutations();
    };

    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueueChange);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueueChange);
  }, [refreshQueueCount, syncQueuedMutations]);

  useEffect(() => {
    void syncQueuedMutations();
  }, [syncQueuedMutations]);

  useEffect(() => {
    if (!online) {
      hadOfflineRef.current = true;
      return;
    }
    if (hadOfflineRef.current) {
      hadOfflineRef.current = false;
      toast.message(t.pwa.connectionBack, { duration: 6_000 });
    }
  }, [online, t.pwa.connectionBack]);

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const updateStandalone = () => setIsInstalled(readStandaloneMode());
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const handleInstalled = () => {
      installPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
      setInstallDismissed(true);
      writeBooleanPreference(INSTALL_NOTICE_DISMISSED_KEY, true);
      toast.success(t.pwa.installAccepted);
    };

    updateStandalone();
    media?.addEventListener?.('change', updateStandalone);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      media?.removeEventListener?.('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [t.pwa.installAccepted]);

  const promptInstall = useCallback(async () => {
    const prompt = installPromptRef.current;
    if (!prompt) {
      return false;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') {
      installPromptRef.current = null;
      setCanInstall(false);
      setInstallDismissed(true);
      writeBooleanPreference(INSTALL_NOTICE_DISMISSED_KEY, true);
      return true;
    }
    return false;
  }, []);

  const dismissInstallNotice = useCallback(() => {
    setInstallDismissed(true);
    writeBooleanPreference(INSTALL_NOTICE_DISMISSED_KEY, true);
  }, []);

  const dismissMobileNotice = useCallback(() => {
    setMobileNoticeDismissed(true);
    writeBooleanPreference(MOBILE_NOTICE_DISMISSED_KEY, true);
  }, []);

  const value = useMemo(
    () => ({
      canInstall,
      dismissInstallNotice,
      dismissMobileNotice,
      installDismissed,
      isInstalled,
      mobileNoticeDismissed,
      online,
      promptInstall,
      queueCount,
      queueSyncing,
    }),
    [
      canInstall,
      dismissInstallNotice,
      dismissMobileNotice,
      installDismissed,
      isInstalled,
      mobileNoticeDismissed,
      online,
      promptInstall,
      queueCount,
      queueSyncing,
    ],
  );

  return (
    <OperationalPwaContext.Provider value={value}>
      {children}
    </OperationalPwaContext.Provider>
  );
}

export function useOperationalPwa() {
  const context = useContext(OperationalPwaContext);
  if (!context) {
    throw new Error('useOperationalPwa must be used within OperationalPwaProvider');
  }
  return context;
}
