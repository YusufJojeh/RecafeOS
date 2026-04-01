import { Outlet } from "react-router-dom"

import { PwaNoticeStack } from "@/components/pwa-notice-stack"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"

export function AuthLayout() {
  const { t, locale, setLocale } = useLanguage()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow"
      >
        {t.common.skipToMain}
      </a>
      <main id="app-main" className="grid min-h-svh gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden flex-col justify-between border-e border-border/60 bg-muted/20 p-10 lg:flex">
          <div>
            <Badge variant="outline" className="mb-6">
              {t.auth.staffAccess}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t.app.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.auth.subtitle}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {t.app.tagline}
          </div>
        </div>
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                aria-label={t.header.locale}
              >
                {locale === "en" ? t.header.localeAr : t.header.localeEn}
              </Button>
            </div>
            <PwaNoticeStack mode="auth" />
            <Card className="w-full border-border/60 bg-card/80 p-6 shadow-lg">
              <Outlet />
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
