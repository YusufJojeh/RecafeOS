# Internal support console (ops-web)

## Purpose

Reduce raw `curl` usage against support APIs by providing a **browser UI** that uses the server-side **support UI gateway** under `/api/v1/internal/support-ui/*`. The browser no longer stores or sends support API keys.

Full use-case matrix, gaps, and risk controls: [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md). **Per-tenant HTTP errors** are not shown in-app; use your log pipeline ([SUPPORT_LOG_QUERIES.md](./SUPPORT_LOG_QUERIES.md), [OBSERVABILITY.md](./OBSERVABILITY.md), [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md)).

## Enable

Build or run ops-web with:

```bash
VITE_SUPPORT_CONSOLE=true
```

The routes **`/internal/support`**, **`/internal/pilots`** (portfolio), **`/internal/pilots/weekly`** (weekly health table), and **`/internal/pilots/:tenantId`** (detail, feedback triage) are registered only when this flag is set.

## Access model

| Layer | Requirement |
|-------|-------------|
| **Browser** | Staff JWT session only |
| **API** | `SUPPORT_UI_ENABLED=true` to expose the gateway |
| **Production** | `SUPPORT_UI_ALLOWED_EMAILS` allowlist is required |
| **Audit** | Mutating calls still send `x-support-operator` so audit trails keep operator attribution |

Support API keys stay on the server side. The browser never reads them from `localStorage`, `sessionStorage`, or user input.

## Mapped API routes (console + curl)

| UI action | Method | Route |
|-----------|--------|--------|
| Pilot portfolio | GET | `/api/v1/internal/support-ui/pilots` |
| Weekly report | GET | `/api/v1/internal/support-ui/pilots/weekly-report?since=` |
| Snapshots list | GET | `/api/v1/internal/support-ui/pilots/snapshots?tenantId=&weekStart=` |
| Pilot feedback list / create / triage | GET, POST, PATCH | `/api/v1/internal/support-ui/tenants/:tenantId/pilot-feedback`, `.../pilot-feedback/:feedbackId` |
| Weekly snapshot upsert | POST | `/api/v1/internal/support-ui/tenants/:tenantId/pilot-weekly-snapshot` |
| Lookup tenant id | GET | `/api/v1/internal/support-ui/lookup/tenant-slug/:slug` |
| Tenant summary | GET | `/api/v1/internal/support-ui/tenants/:tenantId/summary` |
| List branches | GET | `/api/v1/internal/support-ui/tenants/:tenantId/branches` |
| Onboarding status (support) | GET | `/api/v1/internal/support-ui/tenants/:tenantId/branches/:branchId/onboarding-status` |
| Audit log (paginated) | GET | `/api/v1/internal/support-ui/tenants/:tenantId/audit-log?limit=&cursor=&actionPrefix=&branchId=` |
| Order lookup | GET | `/api/v1/internal/support-ui/tenants/:tenantId/orders/:orderId` |
| Reset demo branch | POST | `/api/v1/internal/support-ui/tenants/:tenantId/reset-demo` |
| Process diagnostics | GET | `/api/v1/internal/support-ui/diagnostics` |

Commerce changes (`PATCH .../commerce`) and metadata (`PATCH .../metadata`) remain **documented for API clients**; use Swagger or a REST client for those to avoid accidental edits in a fat-finger UI.

## Staging verification (manual)

After deploy or access-list rotation:

1. [ ] Sign in as an allowlisted operator and open `/internal/support`.
2. [ ] `GET /api/v1/internal/support-ui/diagnostics` returns `status`, `version`, `gitSha`, `db`, and `redis`.
3. [ ] `GET /api/v1/internal/support-ui/lookup/tenant-slug/<known-slug>` resolves.
4. [ ] Mutating call with `x-support-operator: test-op` leaves `supportOperator` in audit metadata for that action.

## Security

- Keep `SUPPORT_UI_ENABLED` off on public hosts that should not expose internal tooling.
- In production, enforce `SUPPORT_UI_ALLOWED_EMAILS` and keep the host behind VPN or IP allowlist when possible.
- Legacy support API keys remain server-side secrets; they are not part of the browser flow anymore.
- Do not enable `VITE_SUPPORT_CONSOLE` on a **public** marketing host; use an internal hostname or separate deployment.

## Future: IdP-backed operators

Optional SSO for operators is out of scope for v1; staff JWT + server-side allowlist is the current gate.

## Alternatives

- Scripts: [ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md) (`provision-pilot-tenant.mjs`).
- Direct HTTP: [support.controller.ts](../../apps/api/src/modules/support/support.controller.ts).
