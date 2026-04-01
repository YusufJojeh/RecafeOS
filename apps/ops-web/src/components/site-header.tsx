import { Loader2, WifiOff } from "lucide-react"
import { matchPath, useLocation } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLanguage } from "@/i18n/context"
import { useAuthStore } from "@/lib/auth-store"
import { navGroups } from "@/lib/nav"
import { useOperationalPwa } from "@/lib/pwa-support"
import { useBranchRealtimeConnected } from "@/lib/use-branch-realtime-connected"

export function SiteHeader() {
  const { t, locale, setLocale } = useLanguage()
  const location = useLocation()
  const branchId = useAuthStore((s) => s.branchId)
  const accessToken = useAuthStore((s) => s.accessToken)
  const { online } = useOperationalPwa()
  const realtimeConnected = useBranchRealtimeConnected()
  const showBranchSurface = Boolean(accessToken && branchId)
  const showRealtimeCatchup =
    showBranchSurface && online && !realtimeConnected

  const current = navGroups
    .flatMap((group) => group.items)
    .find((item) =>
      matchPath({ path: item.to, end: item.end ?? false }, location.pathname)
    )

  const title = current ? t.nav[current.titleKey] : t.nav.floor

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="min-w-0 flex-1 truncate text-base font-medium">{title}</h1>
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          {!online ? (
            <Badge
              variant="outline"
              className="inline-flex max-w-[9.5rem] gap-1 border-amber-500/45 px-1.5 py-0 text-[0.65rem] text-amber-100 sm:max-w-[12rem]"
              title={t.pwa.offlineBody}
            >
              <WifiOff className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{t.pwa.connectionOffline}</span>
            </Badge>
          ) : null}
          {showRealtimeCatchup ? (
            <Badge
              variant="outline"
              className="hidden max-w-[9.5rem] gap-1 border-border/70 px-1.5 py-0 text-[0.65rem] text-muted-foreground sm:inline-flex sm:max-w-[14rem]"
              title={t.pwa.connectionRecovering}
            >
              <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
              <span className="truncate">{t.pwa.connectionRecovering}</span>
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            aria-label={t.header.locale}
          >
            {locale === "en" ? t.header.localeAr : t.header.localeEn}
          </Button>
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            {t.header.command}
          </Button>
        </div>
      </div>
    </header>
  )
}
