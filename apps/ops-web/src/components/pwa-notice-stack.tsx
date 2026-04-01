import { Download, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/context';
import { isIosWebKitInstallSurface } from '@/lib/ios-pwa';
import { useOperationalPwa } from '@/lib/pwa-support';
import { cn } from '@/lib/utils';

const PHONE_LIMITED_PATHS = new Set([
  '/floor',
  '/orders',
  '/kitchen',
  '/bar',
  '/setup',
  '/stock',
  '/customers',
  '/reports',
  '/weekly-digest',
]);

const IOS_INSTALL_DISMISSED_KEY = 'restocafe-pwa-ios-install-dismissed';

function readIosInstallDismissed(): boolean {
  try {
    return localStorage.getItem(IOS_INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeIosInstallDismissed(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(IOS_INSTALL_DISMISSED_KEY, '1');
      return;
    }
    localStorage.removeItem(IOS_INSTALL_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

export function PwaNoticeStack({
  mode,
  className,
}: {
  mode: 'auth' | 'dashboard';
  className?: string;
}) {
  const { t } = useLanguage();
  const location = useLocation();
  const isMobile = useIsMobile();
  const {
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
  } = useOperationalPwa();
  const [installing, setInstalling] = useState(false);
  const [iosInstallDismissed, setIosInstallDismissed] = useState(readIosInstallDismissed);
  const iosSurface = isIosWebKitInstallSurface();

  const showIosManualInstall =
    iosSurface &&
    !isInstalled &&
    !iosInstallDismissed &&
    !canInstall;

  const showPhoneGuidance =
    mode === 'dashboard' &&
    isMobile &&
    !mobileNoticeDismissed &&
    PHONE_LIMITED_PATHS.has(location.pathname);

  const showInstallNotice =
    canInstall && !installDismissed && !isInstalled;

  const showQueueNotice =
    queueCount > 0 && (mode === 'dashboard' || mode === 'auth');

  if (
    !showInstallNotice &&
    !showPhoneGuidance &&
    !showQueueNotice &&
    !showIosManualInstall &&
    online
  ) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {!online ? (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-4 w-4 text-amber-200" />
            <div className="min-w-0">
              <h2 className="font-medium text-foreground">{t.pwa.offlineTitle}</h2>
              <p className="mt-1 text-muted-foreground">{t.pwa.offlineBody}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {showQueueNotice ? (
        <Card className="border-border/60 bg-card/80 p-4 text-sm">
          <div className="flex items-start gap-3">
            <RefreshCw
              className={cn(
                'mt-0.5 h-4 w-4 text-primary',
                queueSyncing ? 'animate-spin' : '',
              )}
            />
            <div className="min-w-0">
              <h2 className="font-medium text-foreground">
                {queueSyncing ? t.pwa.syncingTitle : t.pwa.queuedTitle}
              </h2>
              <p className="mt-1 text-muted-foreground">
                {(mode === 'auth'
                  ? t.pwa.queuedAuthBody
                  : queueSyncing
                    ? t.pwa.syncingBody
                    : t.pwa.queuedBody
                ).replace('{count}', String(queueCount))}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {showIosManualInstall ? (
        <Card className="border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-foreground">{t.pwa.installIosTitle}</h2>
              <p className="mt-1 text-muted-foreground">{t.pwa.installIosBody}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIosInstallDismissed(true);
                    writeIosInstallDismissed(true);
                  }}
                >
                  {t.common.dismiss}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {showInstallNotice ? (
        <Card className="border-primary/40 bg-primary/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-foreground">{t.pwa.installTitle}</h2>
              <p className="mt-1 text-muted-foreground">{t.pwa.installBody}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={installing}
                  onClick={async () => {
                    setInstalling(true);
                    try {
                      await promptInstall();
                    } finally {
                      setInstalling(false);
                    }
                  }}
                >
                  {t.pwa.installAction}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={dismissInstallNotice}
                >
                  {t.common.dismiss}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {showPhoneGuidance ? (
        <Card className="border-border/60 bg-card/80 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-foreground">{t.pwa.phoneTitle}</h2>
              <p className="mt-1 text-muted-foreground">{t.pwa.phoneBody}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={dismissMobileNotice}
                >
                  {t.common.dismiss}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
