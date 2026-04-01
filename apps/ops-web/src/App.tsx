import { lazy, Suspense, type ReactNode } from "react"
import { Link, Navigate, Route, Routes } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "./lib/auth-store"
import { BranchSelectPage } from "./pages/BranchSelectPage"
import { ForbiddenPage } from "./pages/ForbiddenPage"
import { FloorPage } from "./pages/FloorPage"
import { KitchenPage } from "./pages/KitchenPage"
import { LoginPage } from "./pages/LoginPage"
import { OpenOrdersPage } from "./pages/OpenOrdersPage"
import { DashboardLayout } from "./layouts/DashboardLayout"
import { AuthLayout } from "./layouts/AuthLayout"
import { useLanguage } from "./i18n/context"
import { OperationalPwaProvider } from "./lib/pwa-support"
import { SessionBootstrapGate } from "./lib/session-bootstrap-gate"
import { SessionProactiveRefresh } from "./lib/session-proactive-refresh"

// Lazy-load pages that are outside the hottest operational loop.
const MenuPage = lazy(() =>
  import("./pages/MenuPage").then((m) => ({ default: m.MenuPage }))
)
const PublicMenuPage = lazy(() =>
  import("./pages/PublicMenuPage").then((m) => ({ default: m.PublicMenuPage }))
)
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
)
const SetupPage = lazy(() =>
  import("./pages/SetupPage").then((m) => ({ default: m.SetupPage }))
)
const MenuBrandingPage = lazy(() =>
  import("./pages/MenuBrandingPage").then((m) => ({
    default: m.MenuBrandingPage,
  }))
)
const StockPage = lazy(() =>
  import("./pages/StockPage").then((m) => ({ default: m.StockPage }))
)
const WeeklyDigestPage = lazy(() =>
  import("./pages/WeeklyDigestPage").then((m) => ({
    default: m.WeeklyDigestPage,
  }))
)
const ShiftHandoffPage = lazy(() =>
  import("./pages/ShiftHandoffPage").then((m) => ({
    default: m.ShiftHandoffPage,
  }))
)
const CustomerLookupPage = lazy(() =>
  import("./pages/CustomerLookupPage").then((m) => ({
    default: m.CustomerLookupPage,
  }))
)
const PilotDetailPage = lazy(() =>
  import("./pages/PilotDetailPage").then((m) => ({
    default: m.PilotDetailPage,
  }))
)
const PilotPortfolioPage = lazy(() =>
  import("./pages/PilotPortfolioPage").then((m) => ({
    default: m.PilotPortfolioPage,
  }))
)
const PilotWeeklyPage = lazy(() =>
  import("./pages/PilotWeeklyPage").then((m) => ({
    default: m.PilotWeeklyPage,
  }))
)
const SupportConsolePage = lazy(() =>
  import("./pages/SupportConsolePage").then((m) => ({
    default: m.SupportConsolePage,
  }))
)

function LazyFallback() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <Card className="w-full max-w-lg border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
        {t.common.loading}
      </Card>
    </div>
  )
}

function NotFoundPage() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <Card className="w-full max-w-lg border-border/60 bg-card/80 p-6">
        <h2 className="text-lg font-semibold">{t.common.notFound}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.notFoundBody}</p>
        <div className="mt-4">
          <Button asChild>
            <Link to="/floor">{t.common.goToFloor}</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}

const supportConsole =
  import.meta.env.VITE_SUPPORT_CONSOLE === "true" ||
  import.meta.env.VITE_SUPPORT_CONSOLE === "1"

function RequireToken({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const branchId = useAuthStore((s) => s.branchId)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  if (!branchId) {
    return <Navigate to="/branch" replace />
  }
  return <>{children}</>
}

export function App() {
  return (
    <OperationalPwaProvider>
      <SessionBootstrapGate>
        <SessionProactiveRefresh>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/branch"
                element={
                  <RequireToken>
                    <BranchSelectPage />
                  </RequireToken>
                }
              />
            </Route>
            <Route
              path="/m/:tenantSlug/:branchSlug/t/:token"
              element={<PublicMenuPage />}
            />
            <Route
              element={
                <RequireAuth>
                  <DashboardLayout />
                </RequireAuth>
              }
            >
              <Route path="/floor" element={<FloorPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/kitchen" element={<KitchenPage station="KITCHEN" />} />
              <Route path="/bar" element={<KitchenPage station="BAR" />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/shift-handoff" element={<ShiftHandoffPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/weekly-digest" element={<WeeklyDigestPage />} />
              <Route path="/orders" element={<OpenOrdersPage />} />
              <Route path="/customers" element={<CustomerLookupPage />} />
              <Route path="/branding/menu" element={<MenuBrandingPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/forbidden" element={<ForbiddenPage />} />
              {supportConsole ? (
                <>
                  <Route path="/internal/support" element={<SupportConsolePage />} />
                  <Route path="/internal/pilots" element={<PilotPortfolioPage />} />
                  <Route
                    path="/internal/pilots/weekly"
                    element={<PilotWeeklyPage />}
                  />
                  <Route
                    path="/internal/pilots/:tenantId"
                    element={<PilotDetailPage />}
                  />
                </>
              ) : null}
            </Route>
            <Route path="/" element={<Navigate to="/floor" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        </SessionProactiveRefresh>
      </SessionBootstrapGate>
    </OperationalPwaProvider>
  )
}
