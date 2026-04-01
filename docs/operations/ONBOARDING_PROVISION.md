# Venue onboarding and provision (pilot)

Fast path for creating a tenant and first branch uses the existing support API:

- `POST /api/v1/support/tenants/provision` (header `x-support-api-key`)

## Script (recommended)

From the repo root, with API reachable and `SUPPORT_API_KEY` matching the server:

```bash
set API_BASE_URL=https://your-api.example.com
set SUPPORT_API_KEY=your-secret
node deploy/scripts/provision-pilot-tenant.mjs --tenant-name "Pilot Cafe" --tenant-slug pilot-cafe --owner-email owner@venue.com --trial
```

Defaults in the script: `Main` / `main` branch, `Europe/Istanbul`, `TRY`, 2 tables, sample menu on. See `provision-pilot-tenant.mjs --help` is not implemented — read the file header for flags.

## Secure credential handoff

- If you omit `--owner-password`, the API may return `generatedPassword` **once**. Treat it like a reset link: store in a password manager and transmit to the venue through a secure channel (not email body alone if your policy forbids it).
- Prefer setting `--owner-password` when the venue owner chooses a password on a call, then have them change it after first login if policy requires.

## Deep link to staff setup

After provision, send the owner:

- **Login URL:** your ops-web origin, e.g. `https://ops.yourcompany.com/login`
- **After login / branch select:** `https://ops.yourcompany.com/setup` — shows plan, onboarding checklist (menu, tables, QR, smoke payment), and pilot feedback (if enabled).

Replace the origin with your real staff app host.

## Welcome email template (copy/paste)

Subject: Your RestoCafe OS account — [Venue name]

Body:

> You’ve been set up on RestoCafe OS.  
> **Login:** [OPS_WEB_ORIGIN]/login  
> Use email: [owner email]  
> Password: [sent separately / chosen on onboarding call]  
>  
> After you sign in, choose your branch, then open **[OPS_WEB_ORIGIN]/setup** to complete the checklist (menu, tables, QR test order).  
>  
> If anything fails, reply with the **request id** shown on the error (or from browser devtools Network response headers as `x-request-id`).

See [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md) for support correlation.

**Same-day venue path:** [ONE_DAY_PILOT_RUNBOOK.md](./ONE_DAY_PILOT_RUNBOOK.md). **Explicitly deferred features:** [ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md).
