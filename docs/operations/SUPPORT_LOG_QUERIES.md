# Support log queries (Loki / Grafana / vendor)

RestoCafe OS does **not** expose a per-tenant HTTP error stream on the API ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md) gaps). For pilot triage, use your **log aggregator** with structured fields from [OBSERVABILITY.md](./OBSERVABILITY.md) §2.

## Common fields (Pino JSON)

| Field | Use |
|-------|-----|
| `requestId` | Same as response header `x-request-id` — primary correlation |
| `tenantId` | After auth + branch guard |
| `branchId` | Branch-scoped routes |
| `msg` | `http_exception`, `unhandled_exception`, `slow_request`, … |
| `level` | `error` for failures |

## Example queries (adapt to your query language)

**By customer-reported request id**

```txt
requestId == "paste-from-customer"
```

**Unhandled errors in a time window**

```txt
msg = "unhandled_exception"
```

**HTTP 5xx (handled exception path)**

```txt
msg = "http_exception" and status >= 500
```

**Tenant-scoped errors (when field exists)**

```txt
tenantId == "cuid-here" and level == "error"
```

**Slow requests**

```txt
msg = "slow_request"
```

## Grafana Loki (LogQL-style)

Labels and line filters depend on your pipeline. Typical pattern:

```logql
{app="restocafe-api"} |= "unhandled_exception" | json | tenantId="YOUR_TENANT_ID"
```

Replace `{app=...}` with how you label the API deployment. Prefer **label** selectors that match your scrape/agent config; avoid high-cardinality labels like raw `requestId` in stream labels.

## Saved views

Create a dashboard or saved search with:

1. Last 1h `unhandled_exception` + `http_exception` with status ≥ 500.
2. Filter slot for `requestId` (line filter / JSON field).
3. Link to [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md) in the dashboard description.

## Related

- [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md) — first-line steps.
- [OBSERVABILITY.md](./OBSERVABILITY.md) — metrics and health.
