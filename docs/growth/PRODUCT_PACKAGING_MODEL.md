# Product packaging model (post-pilot)

**Purpose:** A simple, defensible commercial structure for RestoCafe OS after initial pilots—**without** requiring full billing automation until revenue and volume justify it. Enforcement today maps to `SubscriptionPlan` and [`plan-limits.config.ts`](../../apps/api/src/commerce/plan-limits.config.ts); commerce PATCH and contract remain the source of truth until Stripe (or equivalent) is wired end-to-end ([COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md)).

**Principle:** Few dimensions, obvious upgrades, no spreadsheet pricing logic for customers.

---

## 1. Product package proposal

Sell **three customer-facing packages** mapped to existing plans. Internally you still have `trial` | `starter` | `growth` | `scale` in the API—**do not add new plan enums** until billing automation exists; use **metadata + overrides** for edge deals.

| Customer-facing name | Maps to API plan | Who it is for |
|---------------------|------------------|---------------|
| **Core Operations** | `starter` (paid) | Single branch, day-to-day floor + menu + orders + payments + kitchen/bar; no API, no AI Insights flags. |
| **Multi-Site & Integrations** | `growth` | Multiple branches (up to default cap), more seats, **API access**, tenant-level reporting rollups as shipped. |
| **Enterprise / high scale** | `scale` | Same feature bundle as growth; **contract** sets real branch/seat limits and commercial terms. |

**Trial** remains a **time-boxed Core Operations** profile (`trial` plan): same core ops, tight caps (1 branch, 5 seats), no API/AI—used for pilots, not a permanent SKU in decks.

**Add-ons (conceptual, not separate SKUs until billing supports them):**

| Add-on | What it is | Tied to plan? |
|--------|------------|----------------|
| **AI Insights** | Advisory narratives on existing reports (already gated by `PlanFeatures` in code). | **Bundled on** `growth` / `scale`; **off** on `trial` / `starter` ([PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md)). Optional future: sell as line item only if legal/pricing needs separation—still one flag bundle in product. |
| **Branch expansion** | More sites than package default. | `maxBranches` override per tenant (audited), not a separate “module.” |
| **Setup / onboarding services** | Human-led rollout, training, cutover. | **Services**, not product flags—priced and scoped in SOW; tracked in `Tenant.metadata` / CS tools, not `plan-limits`. |
| **Support level** | Response time, named contact, after-hours. | **Commercial schedule** (contract/schedule table), not entitlements in `plan-limits.config.ts`—avoids “support as code.” |

This keeps **one** upgrade story: Core → Multi-Site & Integrations → Enterprise, plus optional **services** and **limits** on paper.

---

## 2. Feature grouping

| Group | Capabilities | Core (starter) | Growth+ |
|-------|----------------|----------------|--------|
| **Core operations** | QR ordering, floor/tables/sessions, menu, orders, payments, kitchen/bar, inventory as shipped, branch daily reports, `reports.view` scope | Yes | Yes |
| **Branch expansion** | Additional branches, per-branch isolation | Default 1 branch; overrides for paid deals | Default up to 5; `scale` uses high cap + contract |
| **Seats** | Staff logins | Default 10 | Default 50; scale per contract |
| **Reporting / insights (deterministic)** | Daily/weekly/demand reports, tenant rollups where implemented | Yes (role-gated) | Yes; multi-branch compare reads where applicable |
| **API & integrations** | `apiAccess` — programmatic access | No | Yes |
| **AI assistant (advisory)** | Daily summary, weekly digest, low-stock, underperformers, branch-compare narratives | No (`plan_not_eligible`) | Yes, plus tenant opt-in metadata ([PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md)) |
| **Reserved / off** | Promotion ideas, social drafts | Off | Off until product enables |

**Premium vs core:** Anything that **changes how money moves**, **integrations**, or **multi-site governance** is premium (growth+). **Running one venue operations** is core.

---

## 3. Rationale for each tier or add-on

| Tier / element | Rationale |
|----------------|-----------|
| **Core Operations** | Matches what the monolith does best: replace pen-and-paper and fragmented tools for one site. Price predictably; limit surface area (no API keys, no LLM spend). |
| **Multi-Site & Integrations (growth)** | Branches and seats drive support and infra cost; API access implies integration work and incident class—charge and staff for it. AI flags bundled here because value assumes **stable reporting** and multi-site operators who read numbers. |
| **Enterprise (scale)** | Same software; differentiation is **contract**, SLA narrative, and limits—not a fork. Avoids “custom enterprise build” unless paid for. |
| **AI as bundled on growth+** | Keeps pricing understandable (“smart reports included on Pro tier”) and aligns with existing gates—no separate micro-billing for each LLM route in v1. |
| **Setup services** | Reduces failed pilots and support chaos; revenue for CS/pro services without entangling product code. |
| **Support tiers (commercial)** | Customers understand “business hours vs priority”; engineering stays out of entitlement matrices. |

---

## 4. Operational implications

| Area | Implication |
|------|-------------|
| **CS** | Pitchbook uses **three** names + trial; every deal maps to one `subscriptionPlan` + documented overrides. No per-feature haggling in product. |
| **Onboarding** | Trial/starter: single-branch playbook. Growth+: branch rollout model ([BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md)), API expectations, opt-in for AI. |
| **Support load** | Starter should not expect integration or AI debugging at growth depth—set expectations in contract and [EXPANSION_GUARDRAILS.md](./EXPANSION_GUARDRAILS.md). |
| **Sales** | “Custom” = **limits + services + contract**, not feature forks. |

---

## 5. Plan enforcement implications

- **Single source of truth:** [`PLAN_LIMITS`](../../apps/api/src/commerce/plan-limits.config.ts) + `Tenant.maxBranches` / `Tenant.maxUsers` + commerce state ([SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)).
- **Do not** add parallel “package” strings in app logic—keep `SubscriptionPlan` enum until billing service owns a mapping table.
- **AI:** Plan flags **and** `Tenant.metadata.aiInsights` opt-in—both enforced in code today; packaging doc should not promise features that flags disable.
- **API:** `apiAccess` false on starter—integrations attempts get a clear `403` path; document for sales.
- **Overrides:** Any exception to defaults is **audited** support PATCH + CRM note—see [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md).

---

## 6. Rollout recommendation

1. **Now (post-pilot):** Align website/deck/CS one-pager to **Core / Multi-Site & Integrations / Enterprise** naming; map 1:1 to `starter` / `growth` / `scale`. Keep trial for pilots only.
2. **Before full billing automation:** Use **manual** commerce PATCH + invoice outside product for annual deals; track renewal dates in CRM, not only DB.
3. **When MRR and volume justify:** Introduce Stripe (or equivalent) **per plan** with minimal price points; avoid per-route AI metering until necessary.
4. **Quarterly:** Review [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) and `PlanFeatures`—tighten or loosen **bundled** AI only with cost and support data.
5. **Never by default:** Per-customer feature matrices, hidden SKUs, or “call us for price” on core table stakes—those create **everything custom** and unsupportable drift.

## Related

- [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) — AI bundling and opt-in
- [INCREMENTAL_PRODUCT_GATES.md](./INCREMENTAL_PRODUCT_GATES.md) — when to build more product surface
- [EXPANSION_GUARDRAILS.md](./EXPANSION_GUARDRAILS.md) — when expansion becomes risky
- [POST_PILOT_GROWTH_INDEX.md](./POST_PILOT_GROWTH_INDEX.md)
