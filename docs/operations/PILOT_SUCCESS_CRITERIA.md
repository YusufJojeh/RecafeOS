# Pilot success criteria (RestoCafe OS)

A pilot **succeeds** when **operational**, **usage**, and **business** signals align. Use a **balanced scorecard**; thresholds may be adjusted per contract. Technical go-live gates remain in [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md).

**Tracking fields** live in `Tenant.metadata` (see [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md)) and in support **`GET /api/v1/support/tenants/:id/summary`** under `pilot` and `counts`.

## Operational (must-haves)

- **Stability:** No open **SEV1**; **SEV2** within agreed MTTR; incident trend not worsening week over week ([SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md)).
- **Go-live:** `venueStatus` reaches at least `live` by agreed date, or a **signed waiver** with new date and risk owner.
- **Onboarding:** All branches in pilot scope show onboarding complete per **`GET .../onboarding-status`**, or an **explicit exception list** with owner and date.
- **Limitations:** Known limitations from release gate / cutover are **acknowledged** in metadata (`limitationsAcknowledged`) or linked worksheet ([PILOT_CUTOVER_CHECKLIST.md](./PILOT_CUTOVER_CHECKLIST.md)).

## Usage (where available)

- **Orders:** Non-zero order flow on expected trading days; optional week-over-week **consistency** (not vanity growth targets).
- **Adoption:** Staff actively using core flows (proxy via active users or sessions when instrumentation exists).

## Business

- **Exit decision:** Conversion to production contract, extension, or controlled exit—owned by **commercial** with CS input.

## Health rubric (green / yellow / red)

| Signal | Green | Yellow | Red |
|--------|-------|--------|-----|
| Incidents | No SEV1/2 open | SEV2 open within MTTR | SEV1 or repeat SEV2 |
| Blockers | None or support-owned | One `product_gap`/`bug` past internal SLA | Business-critical blocker open past threshold |
| Onboarding | Complete or dated exceptions | One branch lagging | Multiple branches stuck |
| Engagement | Steady usage | Declining usage | Silence + near-zero usage |

## At-risk triggers (examples)

Any of these may flip a tenant to **yellow** or **red**:

- Repeated **business-critical blocker** (`product_gap` or verified `bug`) unresolved past the agreed threshold.
- **Training** or **onboarding** issues dominating **after two weeks** post go-live (failed enablement).
- **Disengagement:** no meaningful usage and poor communication.
