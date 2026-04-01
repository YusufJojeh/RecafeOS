# Weekly pilot review (RestoCafe OS)

**Cadence:** 30–45 minutes, same weekday and time each week. **Goal:** decide portfolio health, merge duplicate themes, and choose what enters the engineering backlog—without treating chat apps as the roadmap.

**Related:** [PILOT_SUCCESS_CRITERIA.md](./PILOT_SUCCESS_CRITERIA.md), [PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md), [PILOT_ESCALATION_MATRIX.md](./PILOT_ESCALATION_MATRIX.md).

## Roles

| Role | Responsibility |
|------|------------------|
| **Pilot lead** | Runs the meeting; resolves taxonomy disagreements |
| **CS** | Portfolio health (green/yellow/red), onboarding and limitations |
| **Support** | Incident summary, SEV themes, links to tickets |
| **Product** | Feedback triage, product_gap / feature_request prioritization |
| **Eng lead** | What gets a build this cycle; defers or closes noise |

## Agenda

| Step | Owner | Output |
|------|--------|--------|
| 1. Roll call | Pilot lead | Attendance; timeboxed blockers |
| 2. Portfolio health | CS | Per-tenant green/yellow/red using success criteria |
| 3. Incidents | Support | Count; SEV1/2 themes; ticket links |
| 4. Feedback triage | Product + CS | Re-tag misclassified items; merge duplicates into **themes** |
| 5. Escalation | Eng lead | New engineering items; explicit deferrals |
| 6. Limitations & training | CS | New limitation acknowledgments; training gaps |
| 7. Usage | Ops/analytics | Orders/adoption signals from support summary (`ordersLast24h`, etc.) using the **same URL/env** the venue uses |

## Artifact: weekly pilot health summary

One page (wiki, doc, or ticket comment) containing:

- **Date range** (e.g. last 7 days).
- **Per-tenant table:** `venueStatus`, go-live, branch count, incident count, open blockers, top 3 feedback themes, one-line usage.
- **Decisions:** what entered eng backlog; what was deferred with reason.

Optional: run [`deploy/scripts/pilot-weekly-snapshot.mjs`](../../deploy/scripts/pilot-weekly-snapshot.mjs) for a JSON/Markdown snapshot of pilot tenants and open feedback counts.

## Inputs

- Support **`GET /api/v1/support/pilots`** (portfolio) and **`GET /api/v1/support/tenants/:id/summary`** (detail).
- Pilot feedback list: **`GET /api/v1/support/tenants/:tenantId/pilot-feedback`**.
- Logs/metrics per [OBSERVABILITY.md](./OBSERVABILITY.md) when validating bugs.
