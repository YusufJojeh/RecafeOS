# One-day pilot runbook (venue goes live)

Use this for a **single venue** on an environment that already passed [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) (or has documented waivers). This runbook is **product onboarding**; infra cutover identifiers live in [PILOT_CUTOVER_CHECKLIST.md](./PILOT_CUTOVER_CHECKLIST.md). For **on-site readiness, validation steps, paper fallback, and go-live signoff**, use [VENUE_INSTALLATION_CUTOVER.md](./VENUE_INSTALLATION_CUTOVER.md).

## Morning: create tenant and owner

1. **Provision** (support API + key): see [ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md).
   - From repo: `npm run pilot:provision` with `API_BASE_URL`, `SUPPORT_API_KEY`, `--tenant-name`, `--tenant-slug`, `--owner-email`, and usually `--trial`.
   - Defaults in the script: sample menu + floor tables + `Main` / `main` branch, `Europe/Istanbul`, `TRY` unless overridden.
2. **Hand off credentials** securely (generated password is shown once, or set `--owner-password` on the call).
3. **Deep links** to share with the owner:
   - Staff app login: `https://<ops-web-host>/login`
   - After branch select: `https://<ops-web-host>/setup` (checklist, blocking vs recommended, go-live readiness).

## Same day: staff path (owner or manager with `settings.manage`)

| Order | Action | Where |
|-------|--------|--------|
| 1 | Sign in, select branch | `/login`, `/branch` |
| 2 | Open **Setup** | `/setup` |
| 3 | Replace sample menu with real categories/items (or keep sample for smoke only) | `/menu` |
| 4 | Confirm tables match the floor | `/floor` |
| 5 | Ensure **APP_PUBLIC_URL** is set on the API so guest URLs work | Ops / deploy (see Setup page warning if missing) |
| 6 | Open a table session | `/floor` |
| 7 | Run a **smoke order** through kitchen/bar to **paid** | Floor → orders flow |

**Mandatory vs optional (product “venue ready” signal)**

- **Blocking for `readyForGoLive`:** menu items, tables, QR ordering enabled in branch settings, API public URL for guest links, completed smoke payment. **Open session** is **recommended** (training) but not required for the automated flag if other blocking items are done—see API `GET .../onboarding-status` for exact tiers.
- **Optional / process:** extra staff accounts (no self-serve invite in v1—see [ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md)); **CSV menu import** only after the threshold in [RETENTION_BACKLOG.md](../growth/RETENTION_BACKLOG.md) (policy section); full tax rules.

## Before turning on real service: ops gate

- Complete [PILOT_CUTOVER_CHECKLIST.md](./PILOT_CUTOVER_CHECKLIST.md) and [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) for **this** stack (Redis, backups, UAT signoff, etc.).
- Staff **Setup** page should show **ready for go-live** when blocking steps are green; that does **not** replace the release gate.

## If something breaks

- Customer/support correlation: [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md) (`x-request-id`).
