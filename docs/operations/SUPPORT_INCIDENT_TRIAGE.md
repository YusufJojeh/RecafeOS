# Support incident triage (pilot)

Aligned with [OBSERVABILITY.md](./OBSERVABILITY.md) §5 (incident playbook). This page adds **customer ↔ correlation id** discipline for first-line support. **Full pilot workflow:** intake fields, diagnostics matrix, escalation, and templates — [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md).

## Customer-facing message (request id)

When the staff app shows an error, ask the venue to send:

> Please copy the **Support reference** from the error, or from the browser:  
> Open **Developer tools → Network**, click the failed request, and copy the **`x-request-id`** response header (or the same value in the error JSON if shown).

That value matches API logs (`requestId`) and Pino structured fields.

## First-line checklist

1. **Blast radius** — one branch vs all tenants (logs filtered by `tenantId`).
2. **Health** — `GET /api/v1/health/live` then `/api/v1/health/ready` (through the same URL the venue uses, including TLS/proxy).
3. **Logs** — search `requestId` from the customer; then `unhandled_exception` / `http_exception` with status ≥ 500 for the same window.
4. **Metrics** — if enabled, `http_unhandled_errors_total`, latency histogram, business counters ([OBSERVABILITY.md](./OBSERVABILITY.md)).
5. **WebSocket** — stale UI: JWT expiry, Redis adapter for multi-replica ([socket-io-scaling.md](./socket-io-scaling.md)).
6. **Tenant state** — trial expired / suspended: support `GET .../summary` and commerce read model; reactivate or extend trial per policy.

## Escalation payload

Include: tenant id or slug, branch id, order id (if any), **request id**, timestamp (venue local + UTC), user action (e.g. “tapped Pay”).

## Related

- Process snapshot (no tenant PII): `GET /api/v1/support/diagnostics` with `x-support-api-key`.
- Strict go-live gate: [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md).
