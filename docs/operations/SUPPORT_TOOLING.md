# Internal support tooling (pilot operators)

Operator-facing design: **not** a venue feature. Access is via **`x-support-api-key`** on `/api/v1/support/*` plus network controls (VPN, IP allowlist).

- **Legacy:** set **`SUPPORT_API_KEY`** only — authorizes all support routes (GET and POST/PATCH).
- **Split:** set **`SUPPORT_API_KEY_READ`** and **`SUPPORT_API_KEY_WRITE`** together (do **not** also set `SUPPORT_API_KEY`). GET routes accept the read key **or** the write key; mutating routes accept the **write** key only.

Optional **`x-support-operator`** on mutating calls is stored in `AuditLog.metadata.supportOperator` for traceability.

See [INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md) for the ops-web console. **End-to-end triage workflow:** [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md). **Log query examples:** [SUPPORT_LOG_QUERIES.md](./SUPPORT_LOG_QUERIES.md).

**Multi-branch rollout (canonical):** Stages, `branchRollouts` metadata, sequencing branch #2/#3, and staff model are in [BRANCH_ROLLOUT_MODEL.md](../growth/BRANCH_ROLLOUT_MODEL.md). This file lists the **APIs** you use; that file is the **process** source of truth.

## Multi-branch rollout (CS quick reference)

| Action | Where |
|--------|--------|
| Process, gates, `Tenant.metadata.branchRollouts` | [BRANCH_ROLLOUT_MODEL.md](../growth/BRANCH_ROLLOUT_MODEL.md) |
| Headroom (`expansion.branchesRemaining`, `seatsRemaining`), enriched `branchRollouts` | `GET /support/tenants/:id/summary` (below) |
| Add branch (same tenant, new slug) | `POST /support/tenants/provision` — [ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md) |
| Staff default site | `POST /support/tenants/:id/members` with optional `defaultBranchId` |
| Tenant rollup vs branch daily numbers | [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) § CS playbook |
| Deferred menu catalog copy (not built) | [SUPPORT_ONLY_MENU_CLONE_SPEC.md](../growth/SUPPORT_ONLY_MENU_CLONE_SPEC.md) |

## Use case matrix

| UC | Need | Endpoint / tool |
|----|------|-----------------|
| Resolve tenant | Slug → id | `GET /support/lookup/tenant-slug/:slug` |
| Tenant health | Plan, counts, pilot fields, onboarding rollup, feedback count | `GET /support/tenants/:id/summary` |
| Pilot portfolio | All tenants with `commercialEngagement=pilot` | `GET /support/pilots` |
| Weekly health report | Aggregated pilots + feedback window + support audit counts | `GET /support/pilots/weekly-report?since=` |
| Pilot weekly snapshots (SQL history) | Optional persisted week rows | `GET /support/pilots/snapshots?tenantId=&weekStart=`, `POST /support/tenants/:id/pilot-weekly-snapshot` |
| Pilot feedback intake / triage | Categorized items; PATCH for status/theme | `GET /support/tenants/:id/pilot-feedback?limit=&status=&feedbackType=&promotedToEngineering=`, `POST .../pilot-feedback`, `PATCH .../pilot-feedback/:feedbackId` ([PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md)) |
| Branch inventory | Ids for reset / onboarding | `GET /support/tenants/:id/branches` |
| Add staff user (no self-serve invite) | Second login without shared owner creds | `POST /support/tenants/:id/members` (body: `email`, optional `password`, `role` manager\|cashier\|kitchen, optional `defaultBranchId`) — [ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md) |
| Onboarding (support) | Blocking steps without staff JWT | `GET /support/tenants/:id/branches/:branchId/onboarding-status` |
| Order triage | Status snapshot | `GET /support/tenants/:id/orders/:orderId` |
| Audit / support history | Operational and support actions | `GET /support/tenants/:id/audit-log?limit=&cursor=&actionPrefix=&branchId=` |
| Demo reset | Safe transactional wipe | `POST /support/tenants/:id/reset-demo` (see [DEMO_TENANT.md](./DEMO_TENANT.md)) |
| Process diagnostics | Host snapshot | `GET /support/diagnostics` |
| Commerce / lifecycle | Trial, suspend, etc. | `PATCH .../commerce`, `POST .../suspend` (JSON body `reasonCode`, optional `note`), `POST .../reactivate`, `POST .../jobs/expire-trials`, … ([COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md)) |
| Guarded commerce/metadata PATCH | Reduce typo risk vs raw curl | [`deploy/scripts/support-guarded-patch.mjs`](../../deploy/scripts/support-guarded-patch.mjs) — dry-run without `--confirm`; requires `API_BASE_URL`, `SUPPORT_API_KEY`; optional `SUPPORT_OPERATOR` for audit |
| Multi-branch expansion | Stages + limits + provision | [BRANCH_ROLLOUT_MODEL.md](../growth/BRANCH_ROLLOUT_MODEL.md); summary `GET .../summary` → `expansion`, `branchRollouts`; provision `POST .../tenants/provision` |

## Gaps (by design for v1)

| Topic | Position |
|-------|----------|
| **Per-tenant error stream** | Not in API. Use log search by `tenantId` / `requestId` ([OBSERVABILITY.md](./OBSERVABILITY.md), [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md)). |
| **QR regeneration** | No server QR image. New guest URL = new table session on Floor. |
| **Staff invite** | Self-serve email invites still deferred; **support-only** member create is available (`POST .../members`). |

## Audit requirements

- Support **mutations** write to `AuditLog` (e.g. `support.commerce_patch`, `support.metadata_patch`, `support.reset_demo`).
- **Read** `GET .../audit-log` is support-key only, read-only, paginated. Use `actionPrefix=support.` to narrow to support actions.
- Key-based calls have **no `actorId`**; optional **`x-support-operator`** header is copied into audit `metadata.supportOperator` on mutating routes.

## Risk controls

| Risk | Mitigation |
|------|------------|
| Key leak | Rotate key; restrict console to internal hostnames; see INTERNAL_SUPPORT_CONSOLE |
| Wrong tenant | Process: only query after customer identifies slug/tenant |
| Destructive reset | Demo tag or `acknowledgeProductionReset` ([provisioning.service.ts](../../apps/api/src/provisioning/provisioning.service.ts)) |
| Over-collection | Audit read returns stored fields only; no payment PAN |

## Implementation status

1. Read APIs: branches, onboarding (support), audit tail ([`support.controller.ts`](../../apps/api/src/modules/support/support.controller.ts)).
2. Console ([`SupportConsolePage`](../../apps/ops-web/src/pages/SupportConsolePage.tsx)): read/write key fields, optional operator id, reset-demo.
3. Read/write key split ([`SupportKeyService`](../../apps/api/src/modules/support/support-key.service.ts)) and `@SupportAccess` on each route.
4. Later: IdP-backed operators (see INTERNAL_SUPPORT_CONSOLE).
