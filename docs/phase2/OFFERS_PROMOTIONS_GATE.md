# Gate for feature H: narrow offers / promotions

Work on **automated or rule-based** price changes (beyond today’s ad-hoc order discount in [`order-billing`](apps/api/src/modules/orders/order-billing.service.ts) flows) **must not start** until this gate is satisfied.

## Gate checklist (all required)

| # | Deliverable | Owner | Done |
|---|-------------|--------|------|
| 1 | **Pricing test matrix** below agreed and automated tests planned (unit + integration) | Eng | ☐ |
| 2 | **Permission model** below agreed and new codes added to [`GLOBAL_PERMISSION_CODES`](apps/api/src/provisioning/provisioning.constants.ts) + seed | Eng + product | ☐ |
| 3 | **Audit** — every applied promotion writes to [`AuditLog`](apps/api/prisma/schema.prisma) or equivalent with `entity`, `entityId`, `metadata` (rule id, amounts) | Eng | ☐ |
| 4 | **Rollback story** — how to disable a rule in &lt; 5 minutes without deploy (feature flag or DB flag) | Eng | ☐ |

---

## 1. Pricing test matrix (minimum)

Rows are scenarios; columns are **expected totals** (minor units) and **invariants** after apply.

Assume a **narrow** H scope: e.g. one of — (a) menu-item percentage cap, (b) order subtotal threshold − fixed minor, (c) time-window flag stored in `Branch.settings` — **not** stacking with multiple independent engines.

### Fixture base cases

| ID | Scenario | Setup | Expected |
|----|----------|--------|----------|
| P1 | No promotion | Subtotal 10000, no rule | Pay 10000; `discountMinor` 0 |
| P2 | Single line item rule | 10% off one `menuItemId` | Line and order totals match `order-pricing` single source of truth |
| P3 | Subtotal threshold | Subtotal ≥ X → −500 minor | Applies once; not double-applied on reconfirm |
| P4 | Incompatible with existing manual discount | Order already has `discountPercent` from staff | **Defined behavior** — either reject rule or take minimum discount (document one rule only) |
| P5 | Rounding | Odd minor units, percent discount | Bankers vs floor documented; matches [`order-pricing`](apps/api/src/modules/orders/order-pricing.ts) |
| P6 | Cancelled / unpaid | Order DRAFT then CANCELLED | No promotion side effects on stock or ledger |
| P7 | Paid order immutability | Promotion applied pre-PAID | Cannot change totals after PAID without explicit new flow (should fail) |

### Negative / abuse

| ID | Scenario | Expected |
|----|----------|----------|
| N1 | Role without permission calls apply API | 403 |
| N2 | Cross-tenant / cross-branch rule id | 404 or 403 |
| N3 | Backdated rule effective date | Rejected or no retroactive change on already-PAID orders |

---

## 2. Permission model (recommended)

Today: **`orders.discount`** gates ad-hoc discount on orders ([`permissions.map`](apps/api/src/common/security/permissions.map.ts)).

For H, **split responsibilities**:

| Permission code | Purpose | Default roles |
|-----------------|---------|----------------|
| `orders.discount` | **Existing** — manual discount on a specific order (staff) | owner, manager, cashier |
| `promotions.manage` *(new)* | Create/edit/disable **promotion rules** (per branch or tenant scope as designed) | owner, manager only |
| `promotions.apply` *(optional)* | If rules can be toggled per order by staff, separate from manage | manager only, or fold into `orders.edit` with caution |

**Rule:** Cashiers must **not** create global rules; they may only trigger applies if product explicitly wants that — then use `promotions.apply` with audit.

**Implementation note:** Add codes to `GLOBAL_PERMISSION_CODES`, run seed/migration for `Permission` rows, update `ROLE_TEMPLATE_PERMISSIONS` so cashier does **not** receive `promotions.manage`.

---

## 3. Sign-off

| Role | Name | Date |
|------|------|------|
| Product | | |
| Engineering | | |

Until signed, **H** implementation is blocked; ad-hoc `orders.discount` behavior remains unchanged.
