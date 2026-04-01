# Pilot escalation matrix (RestoCafe OS)

Who owns what, how fast, and what reaches **product/engineering**. Works with [PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md) and [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md).

## Ownership

| Item | Owner | Notes |
|------|--------|--------|
| Pilot relationship & health narrative | CS (`csOwner` in metadata) | Single name on the account |
| First-line incidents | Support | Uses `x-request-id` discipline |
| Taxonomy dispute | Pilot lead | Escalation path when CS/Support disagree on type |
| Product prioritization | Product | `product_gap`, `feature_request`, promoted items |
| Engineering build queue | Eng lead | From verified bugs and approved gaps |
| Commercial exit / renewal | Commercial | CS provides input |

Optional **`engineeringLiaison`** in `Tenant.metadata` names a default eng contact for escalations (not auto-routing in v1).

## SLAs (defaults — tune per contract)

| Stage | Target |
|-------|--------|
| Intake categorized (`feedbackType` set) | 24 business hours |
| Support first response (incidents) | Per severity matrix in [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md) |
| Engineering triage (items allowed into eng queue) | Next weekly review unless SEV1/2 |

## What gets a CS/support ticket only

- `training_issue` (resolution = training/docs)
- `support_issue` with no code change
- `nice_to_have` (logged for theme rollup unless promoted)

## What gets an engineering / product artifact

| Condition | Artifact |
|-----------|----------|
| Verified `bug` or high-impact defect | Engineering issue (GitHub/Jira) with `requestId`, tenant/branch ids, repro |
| `product_gap` approved in weekly review | Product epic or engineering issue with scope |
| `feature_request` **promoted** | Roadmap item; not automatic |
| SEV1/2 incident | Immediate eng involvement per observability playbook |

## What does **not** go to engineering standup

- `nice_to_have` and unverified `verbal_only` bugs (until verified)
- Raw WhatsApp threads (must be transcribed into structured intake)

## Engineering handoff minimum

See [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md) §5.3. Include: `requestId(s)`, `tenantId` / `branchId` / `orderId`, `gitSha`, hypothesis, customer impact window, what support already tried.

## API reference

- Portfolio: `GET /api/v1/support/pilots`
- Feedback: `POST /api/v1/support/tenants/:tenantId/pilot-feedback`, `GET /api/v1/support/tenants/:tenantId/pilot-feedback`

Keys: [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md).
