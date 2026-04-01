# Demo tenant tagging and reset (pilot)

## Metadata convention

Set on the tenant (support `PATCH /api/v1/support/tenants/:tenantId/metadata`):

```json
{
  "metadata": {
    "demo": true
  }
}
```

- **`demo: true`** — marks a tenant intended for sales demos or training. Operational resets are allowed **without** the production acknowledgement flag (see below).

Optional related keys (see [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md)):

- `pilotPhase`, `csOwner`, `goLiveDate`, `pilotNotes` — for paid pilots and customer success, not required for demos.

## Reset transactional data

Support API: `POST /api/v1/support/tenants/:tenantId/reset-demo` with body:

```json
{
  "branchId": "<branch cuid>"
}
```

For **demo-tagged** tenants (`metadata.demo === true`), this clears orders, sessions, stock movements for that branch, and keeps menu, tables, and staff. Audit logs `support.reset_demo`.

## Production / non-demo tenants

If `metadata.demo` is not `true`, the API requires:

```json
{
  "branchId": "<branch cuid>",
  "acknowledgeProductionReset": true
}
```

This prevents accidental wipes on live pilot venues. Prefer tagging true demo tenants with `demo: true` so day-to-day resets do not need the acknowledgement.

## Safe reset SOP

1. Confirm tenant id and branch id (support summary or internal console).
2. If not a demo tenant, get written approval from the venue or use only on a dedicated sandbox stack.
3. Call reset-demo; verify response counts.
4. Optionally re-smoke: open session → small order → pay (see [QA_STRATEGY.md](../qa/QA_STRATEGY.md) / onboarding checklist).
