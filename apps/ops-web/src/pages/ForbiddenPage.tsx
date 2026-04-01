import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"

export function ForbiddenPage() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <Card className="w-full max-w-lg border-border/60 bg-card/80 p-6">
        <h2 className="text-lg font-semibold">{t.common.forbidden}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.forbiddenBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link to="/floor">{t.common.goToFloor}</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
