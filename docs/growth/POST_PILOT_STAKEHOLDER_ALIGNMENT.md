# Post-pilot growth — stakeholder alignment (CS / sales / engineering)

Use this as a **single reference** for what RestoCafe OS will and will not pursue after pilot hardening. It mirrors the [post-pilot growth risk map](#risk-summary) derived from [PILOT_OPERATIONAL_READINESS_REPORT.md](../operations/PILOT_OPERATIONAL_READINESS_REPORT.md).

## Non-goals (explicit)

- **Microservices** or service extraction — the product stays a **modular monolith**.
- **Customer mobile apps** (native) — not in scope for this growth phase.
- **Marketplace, delivery platform, or aggregator logic** — out of scope.
- **Enterprise ERP** (full finance, multi-entity consolidation, etc.) — out of scope.
- **AI gimmicks** — no chatbots or speculative features; only **controlled, opt-in** assistance tied to existing data (see [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md)).

## Goals (explicit)

1. **Retention** — reduce churn from onboarding friction, weak multi-user support, and unclear value.
2. **Expansion readiness** — disciplined second/third branch and seat growth without support chaos.
3. **Branch rollout discipline** — stages, metadata, and runbooks — not “add branches everywhere” ([BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md)).
4. **Practical reporting** — numbers operators trust; tenant-level rollups where multi-site owners need them ([MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md)).
5. **Customer success visibility** — automatable health signals where possible ([CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md)).
6. **Plan clarity** — starter / growth / scale boundaries and upgrade paths ([PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md)).
7. **Operational scalability** — keep pilot-era simplicity: support keys, runbooks, scheduled jobs; no architecture drift.

## Risk summary

| Zone | What we watch | Mitigation owner |
|------|----------------|------------------|
| Product | Shared logins, manual menus, env misconfig (`APP_PUBLIC_URL`) | Product + CS playbooks |
| Commercial | Metadata-only “pilot” labels; trial jobs need cron | CS + DevOps |
| Expansion | Undisciplined branch adds | CS + [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) |
| Reporting | Single-branch vs tenant rollup semantics | Engineering + docs |
| AI | Expectations vs opt-in LLM features | Sales + [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) |

## Decision log (fill in with your org)

| Decision | Owner | Status |
|----------|-------|--------|
| Priority of invites vs support-only member API | | |
| When to ship menu CSV/import | | |
| Default branch cap for tenant rollup queries (25) | Accepted in API | shipped |

## Related documents

- [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md)
- [POST_PILOT_ROADMAP.md](./POST_PILOT_ROADMAP.md)
