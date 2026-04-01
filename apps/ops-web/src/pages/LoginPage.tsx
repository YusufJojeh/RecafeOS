import { useMutation } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError, apiFetch, consumeSessionReason } from "@/lib/api"
import type {
  StaffAuthLoginResponse,
  StaffTenantSummary,
} from "@/lib/contract/auth-api"
import { useAuthStore } from "@/lib/auth-store"
import { supportEmailHref, supportWhatsAppHref } from "@/lib/support-links"
import { useLanguage } from "@/i18n/context"

// Simple direct links for request-access CTA

type TenantInfo = StaffTenantSummary
type LoginResponse = StaffAuthLoginResponse
type AcceptInviteResponse = LoginResponse

 function formatLoginError(e: unknown): string {
  if (e instanceof ApiError && e.status === 403 && e.body && typeof e.body === "object") {
    const code = (e.body as { code?: string }).code
    const msg = (e.body as { message?: string }).message
    if (
      code === "TENANT_SUSPENDED" ||
      code === "TENANT_CANCELED" ||
      code === "TENANT_TRIAL_EXPIRED" ||
      code === "TENANT_PAST_DUE"
    ) {
      return typeof msg === "string" && msg.trim()
        ? msg
        : "Your organization cannot sign in right now. Contact support."
    }
  }
  return e instanceof Error ? e.message : String(e)
 }

export function LoginPage() {
  const nav = useNavigate()
  const { t } = useLanguage()
  const setSession = useAuthStore((s) => s.setSession)
  const preferredTenantSlug = useAuthStore((s) => s.preferredTenantSlug)
  const accessToken = useAuthStore((s) => s.accessToken)
  const branchId = useAuthStore((s) => s.branchId)
  const [email, setEmail] = useState(import.meta.env.DEV ? "owner@demo.local" : "")
  const [password, setPassword] = useState(import.meta.env.DEV ? "demo12345" : "")
  const [error, setError] = useState<string | null>(null)
  const [tenantPick, setTenantPick] = useState<TenantInfo[] | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteToken, setInviteToken] = useState("")
  const [invitePassword, setInvitePassword] = useState("")
  const [inviteName, setInviteName] = useState("")

  useEffect(() => {
    if (!accessToken) {
      return
    }
    nav(branchId ? "/floor" : "/branch", { replace: true })
  }, [accessToken, branchId, nav])

  useEffect(() => {
    if (accessToken) {
      return
    }
    const reason = consumeSessionReason()
    if (reason === "expired") {
      setError(t.auth.sessionExpired)
    }
  }, [accessToken, t.auth.sessionExpired])

  const login = useMutation({
    mutationFn: async (tenantSlug?: string) => {
      const body: Record<string, string> = { email, password }
      const slug = tenantSlug ?? preferredTenantSlug ?? undefined
      if (slug) {
        body.tenantSlug = slug
      }
      return apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    onSuccess: (res, tenantSlugArg) => {
      const slug =
        res.tenants.find((t) => t.id === res.tenantId)?.slug ??
        tenantSlugArg ??
        preferredTenantSlug ??
        undefined

      if (!tenantSlugArg && res.tenants.length > 1) {
        setTenantPick(res.tenants)
        return
      }

      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        tenantId: res.tenantId,
        tenantSlug: slug,
      })
      setTenantPick(null)
      nav("/branch")
    },
    onError: (e: Error) => setError(formatLoginError(e)),
  })

  const acceptInvite = useMutation({
    mutationFn: () =>
      apiFetch<AcceptInviteResponse>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          token: inviteToken.trim(),
          password: invitePassword,
          displayName: inviteName.trim() || undefined,
        }),
      }),
    onSuccess: (res) => {
      const slug =
        res.tenants.find((t) => t.id === res.tenantId)?.slug ??
        preferredTenantSlug ??
        undefined
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        tenantId: res.tenantId,
        tenantSlug: slug,
      })
      nav("/branch")
    },
    onError: (e: Error) => setError(formatLoginError(e)),
  })

  const signInDisabled = login.isPending || !email.trim() || !password
  const inviteDisabled = acceptInvite.isPending || !inviteToken.trim() || !invitePassword

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t.auth.title}</h2>
        <p className="text-sm text-muted-foreground">{t.auth.subtitle}</p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {error}
        </div>
      ) : null}

      {tenantPick ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.auth.tenantPick}</p>
          <div className="space-y-2">
            {tenantPick.map((tItem) => (
              <Button
                key={tItem.id}
                variant="outline"
                className="w-full justify-between"
                disabled={login.isPending}
                onClick={() => {
                  setError(null)
                  login.mutate(tItem.slug)
                }}
              >
                <span>{tItem.name}</span>
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setTenantPick(null)}>
            {t.common.back}
          </Button>
        </div>
      ) : showInvite ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (inviteDisabled) return
            setError(null)
            acceptInvite.mutate()
          }}
        >
          <FieldGroup>
            <FieldDescription>{t.auth.inviteHelp}</FieldDescription>
            <Field>
              <FieldLabel htmlFor="invite-token">{t.auth.inviteToken}</FieldLabel>
              <Input
                id="invite-token"
                value={inviteToken}
                onChange={(e) => {
                  setInviteToken(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-password">{t.auth.invitePassword}</FieldLabel>
              <Input
                id="invite-password"
                type="password"
                value={invitePassword}
                onChange={(e) => {
                  setInvitePassword(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-name">{t.auth.inviteName}</FieldLabel>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={inviteDisabled}>
              {acceptInvite.isPending ? t.auth.acceptingInvite : t.auth.acceptInvite}
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (signInDisabled) return
            setError(null)
            login.mutate(undefined)
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t.auth.email}</FieldLabel>
              <Input
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="username"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{t.auth.password}</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" disabled={signInDisabled}>
              {login.isPending ? t.auth.signingIn : t.auth.signIn}
            </Button>
          </FieldGroup>
        </form>
      )}

      <div className="flex items-center justify-between">
        {!tenantPick ? (
          <Button
            variant="ghost"
            onClick={() => {
              setShowInvite((value) => !value)
              setError(null)
            }}
          >
            {showInvite ? t.auth.backToLogin : t.auth.acceptInviteToggle}
          </Button>
        ) : null}
      </div>

      <FieldSeparator>{t.auth.requestAccess}</FieldSeparator>
      <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>{t.auth.requestAccessCopy}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={supportEmailHref}>{t.auth.requestEmail}</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={supportWhatsAppHref} target="_blank" rel="noreferrer">
              {t.auth.requestWhatsApp}
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
