# Support training checklist (paid pilots)

Use this for onboarding first-line support before handling live pilot incidents. Canonical workflow and templates: [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md).

## Before first on-call shift

- [ ] Read [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md) (customer `x-request-id` message).
- [ ] Read diagnostics matrix §2 in [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md).
- [ ] Know where **logs** and **metrics** live for the pilot environment ([OBSERVABILITY.md](./OBSERVABILITY.md)).
- [ ] Confirm access to support API (`x-support-api-key`) or internal console ([INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md)) on a **non-public** host only.
- [ ] Save escalation contacts and severity definitions ([SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md) §4).
- [ ] If you join **presales demos** or pilot kickoff calls: skim [DEMO_SALES_EXECUTION_PACKAGE.md](./DEMO_SALES_EXECUTION_PACKAGE.md) so floor language matches [VENUE_INSTALLATION_CUTOVER.md](./VENUE_INSTALLATION_CUTOVER.md) and [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) (avoid contradicting runbooks).

## Every ticket — minimum intake

Always collect what you can from §5.1 in [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md). **Non-negotiable for HTTP errors:** **`x-request-id`** (or “Support reference” from the app).

Copy-paste for the customer:

> Please send the **Support reference** from the error, or open Developer tools → Network → failed request → copy the **`x-request-id`** response header.

## First-response habit

Follow §5.2 in [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md): severity, blast radius, health, diagnostics (`version`/`gitSha`), then log search by `requestId`.

## After the incident

- [ ] Ticket updated with tenant/branch/order ids and resolution.
- [ ] If engineering was involved: handoff fields from §5.3 filled.
- [ ] No API keys or JWTs pasted into long-lived tickets.
