import clsx from "clsx"
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  SearchX,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/i18n/context"
import { cn } from "@/lib/utils"

type PageSize = 'narrow' | 'default' | 'wide';

const pageSizeClass: Record<PageSize, string> = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
}

type PageFrameProps = {
  children: ReactNode;
  className?: string;
  size?: PageSize;
};

export function PageFrame({
  children,
  className,
  size = 'default',
}: PageFrameProps) {
  return (
    <div className={cn("mx-auto w-full", pageSizeClass[size], className)}>
      {children}
    </div>
  )
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  status,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={clsx(
        "mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="space-y-3">
        {eyebrow ? (
          <Badge variant="outline" className="gap-2 text-xs uppercase tracking-[0.2em]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{eyebrow}</span>
          </Badge>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {status ? (
          <div className="flex flex-wrap items-center gap-2">{status}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  )
}

type SectionCardProps = {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionCard({
  children,
  title,
  description,
  actions,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("border-border/60 bg-card/80", className)}>
      {title || description || actions ? (
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <CardTitle className="text-base">{title}</CardTitle>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

type StateVariant = 'loading' | 'error' | 'empty' | 'info' | 'success';

type StatePanelProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  variant?: StateVariant;
  compact?: boolean;
};

const stateVariantClasses: Record<StateVariant, string> = {
  loading: "border-border/60 bg-card/70 text-foreground",
  error: "border-destructive/40 bg-destructive/10 text-foreground",
  empty: "border-border/60 bg-card/70 text-foreground",
  info: "border-border/60 bg-card/70 text-foreground",
  success: "border-primary/40 bg-primary/10 text-foreground",
}

function StateIcon({ variant }: { variant: StateVariant }) {
  if (variant === 'loading') {
    return <LoaderCircle className="h-5 w-5 animate-spin text-slate-300" />;
  }
  if (variant === 'error') {
    return <AlertTriangle className="h-5 w-5 text-red-200" />;
  }
  if (variant === 'success') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-200" />;
  }
  if (variant === 'empty') {
    return <SearchX className="h-5 w-5 text-slate-300" />;
  }
  return <Sparkles className="h-5 w-5 text-emerald-200" />;
}

export function StatePanel({
  title,
  description,
  action,
  className,
  variant = 'info',
  compact = false,
}: StatePanelProps) {
  return (
    <Card
      className={cn(
        "border-border/60 bg-card/70",
        stateVariantClasses[variant],
        compact ? "p-4" : "p-5",
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border/60 bg-muted p-2 text-muted-foreground">
          <StateIcon variant={variant} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {action ? (
            <div className="mt-4 flex flex-wrap gap-2">{action}</div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'emerald' | 'amber' | 'danger';
  className?: string;
};

const metricToneClass: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "border-border/60",
  emerald: "border-primary/40",
  amber: "border-amber-500/40",
  danger: "border-destructive/40",
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "min-h-32 border-border/60 bg-card/80 p-4",
        metricToneClass[tone],
        className
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {detail ? <div className="mt-1 text-sm text-muted-foreground">{detail}</div> : null}
    </Card>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-xl", className)} aria-hidden="true" />
}

type ConnectionBadgeProps = {
  realtimeConnected: boolean;
  online?: boolean;
  className?: string;
};

export function ConnectionBadge({
  realtimeConnected,
  online = true,
  className,
}: ConnectionBadgeProps) {
  const { t } = useLanguage()
  const degraded = !online || !realtimeConnected;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 border-border/60 text-xs",
        degraded ? "text-amber-200" : "text-emerald-200",
        className
      )}
    >
      {degraded ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
      <span>
        {!online
          ? t.pwa.connectionOffline
          : realtimeConnected
            ? t.pwa.connectionLive
            : t.pwa.connectionRecovering}
      </span>
    </Badge>
  )
}
