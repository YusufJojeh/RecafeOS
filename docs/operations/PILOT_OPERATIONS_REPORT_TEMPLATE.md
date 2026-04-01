# Pilot operations report (template)

Use **weekly** or **monthly** during paid pilots. Paste into your doc tool or ticket; attach metrics exports as needed.

## Header

| Field | Value |
|-------|--------|
| Reporting period | |
| Tenant(s) in scope | |
| Environment (API / ops-web URLs) | |
| Prepared by | |

## 1. Commercial posture

| Tenant | Plan | Billing status | Trial end | Notes |
|--------|------|----------------|-----------|-------|
| | | | | |

Sources: support `GET /api/v1/support/tenants/:id/summary`, audit `support.commerce_patch`, analytics `tenant.commerce_updated`.

## 2. Release / infra gate status

Reference [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md). Summarize any **waivers** or **open** items.

| Item | Status |
|------|--------|
| Redis / idempotency | |
| Socket.IO scaling | |
| Backups | |
| Observability | |

## 3. Operational health

| Metric / signal | Notes |
|-----------------|-------|
| Incidents (SEV) | |
| Open support tickets | |
| Top errors (from logs) | |

## 4. Product usage (snapshot)

From support summary where available: orders last 24h, branches, menu items, last order time.

| Tenant | Orders (24h) | Last activity | Notes |
|--------|--------------|---------------|-------|
| | | | |

## 5. Structured feedback

Query `AnalyticsEvent` where `name = 'pilot.feedback'` (see `POST /api/v1/tenants/pilot-feedback`). Summarize by category and severity.

| Theme | Count | Example |
|-------|-------|---------|
| | | |

## 6. Decisions and next period

- …
