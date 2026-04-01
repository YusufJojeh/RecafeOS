import { type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { PwaNoticeStack } from "@/components/pwa-notice-stack"
import { SiteHeader } from "@/components/site-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useLanguage } from "@/i18n/context"
import { canAccessRoute } from "@/lib/nav-permissions"
import { BranchTenantGate } from "@/lib/branch-tenant-gate"
import { StaffPermissionsProvider, useStaffPermissions } from "@/lib/staff-permissions"

const supportConsole =
  import.meta.env.VITE_SUPPORT_CONSOLE === "true" ||
  import.meta.env.VITE_SUPPORT_CONSOLE === "1"

function DashboardShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage()

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background text-foreground">
        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow"
        >
          {t.common.skipToMain}
        </a>
        <AppSidebar />
        <SidebarInset className="flex w-full flex-col">
          <SiteHeader />
          <div className="px-4 pt-4 lg:px-6">
            <PwaNoticeStack mode="dashboard" />
          </div>
          <main
            id="app-main"
            className="flex-1 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] lg:px-6"
          >
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function PermissionOutlet() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const { permissions, isLoading, isError, refetch } = useStaffPermissions()

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {t.common.loading}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Card className="max-w-md border-border/60 p-6 text-center text-sm">
          <p className="text-muted-foreground">{t.common.forbiddenBody}</p>
          <Button type="button" className="mt-4" variant="secondary" onClick={() => refetch()}>
            {t.common.retry}
          </Button>
        </Card>
      </div>
    )
  }

  if (pathname.startsWith("/internal/")) {
    if (!supportConsole) {
      return <Navigate to="/forbidden" replace />
    }
    return (
      <BranchTenantGate>
        <Outlet />
      </BranchTenantGate>
    )
  }

  if (!canAccessRoute(pathname, permissions)) {
    return <Navigate to="/forbidden" replace />
  }

  return (
    <BranchTenantGate>
      <Outlet />
    </BranchTenantGate>
  )
}

export function DashboardLayout() {
  return (
    <StaffPermissionsProvider>
      <DashboardShell>
        <PermissionOutlet />
      </DashboardShell>
    </StaffPermissionsProvider>
  )
}
