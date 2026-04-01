# Pilot cutover checklist (venue + branch record)

Link each paid pilot to infrastructure and product gates. **Canonical blocking criteria** remain in [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md); this document is a **worksheet** you can copy per venue. **Same-day staff sequence:** [ONE_DAY_PILOT_RUNBOOK.md](./ONE_DAY_PILOT_RUNBOOK.md). **Venue devices, Wi‑Fi, QR, printers, fallback, and day-one signoff:** [VENUE_INSTALLATION_CUTOVER.md](./VENUE_INSTALLATION_CUTOVER.md).

## Identifiers (fill in)

| Field | Value |
|-------|--------|
| Venue / trade name | |
| Tenant id | |
| Tenant slug | |
| Branch id (primary) | |
| Branch slug | |
| Go-live target date | |
| API public base URL (pilot) | |
| Ops-web (staff app) origin | |

## Cross-reference to release gate

| Gate id (see PILOT_RELEASE_GATE) | Owner | Done (date) | Evidence / link |
|----------------------------------|-------|-------------|-----------------|
| B1 Redis / idempotency | Eng | | |
| B2 Socket.IO + Redis | Eng | | |
| B3 Health / smoke script | Ops | | |
| B4 CI green | Eng | | |
| B6 E2E critical | Eng | | |
| B8 Backup before cutover | Ops | | |
| B10 Observability | Ops | | |
| B14 Venue UAT | Pilot | | |
| B16 k6 staging gate | Eng | | |

## Venue-side readiness (product)

Tracked in-app for staff: **Setup** page checklist (`/setup`) — menu, tables, QR settings, session, smoke payment. Record sign-off:

| Check | Owner | Date |
|-------|-------|------|
| Setup checklist green or waived | | |

## Metadata (optional)

Sync key dates into `Tenant.metadata` (`goLiveDate`, `pilotPhase`, `csOwner`) via support API so `GET /api/v1/support/tenants/:tenantId/summary` reflects pilot fields.
