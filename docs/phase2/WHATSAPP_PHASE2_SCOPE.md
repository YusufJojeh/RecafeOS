# Phase-2: WhatsApp order scope decision

## Decision (default for RestoCafe OS Phase-2)

| Track | In scope | Out of scope |
|--------|-----------|----------------|
| **Phase-2 (this release train)** | **Manual WhatsApp workflow** — staff creates orders with `OrderType.WHATSAPP_MANUAL`, structured fields (e.g. pickup time, delivery notes) via `sourceNote` or additive nullable columns, faster ops UX, kitchen/rider-facing clarity | Meta WhatsApp Business / Cloud API webhooks, template messaging, automated inbound parsing, async conversation state machines |
| **Phase-3 (separate program)** | Cloud API integration, idempotent webhook handlers, Meta app review, template policies | — |

## Rationale

- Phase-2 improvements compound daily operations (fewer wrong orders, faster entry) without new async boundaries or third-party SLA.
- Cloud API work splits **B** into a different risk class (signatures, retries, duplicate messages) and belongs on its own milestone with dedicated QA and observability.

## Implementation implications (when building B)

- All order creation stays **synchronous** on existing NestJS order flows; no coupling of HTTP handlers to WhatsApp delivery receipts.
- If product later approves API track, introduce a dedicated **integration module** with webhook ingress, idempotency keys, and mapping to the same `createOrder` / lifecycle services — do not extend manual paths with API-specific branches in controllers.

## Stakeholder sign-off

Record agreement here before investing in B beyond manual UX.

| Role | Name | Date | Notes |
|------|------|------|-------|
| Product / owner | | | |
| Engineering lead | | | |

**Status:** Pending sign-off — until signed, engineering assumes **manual-only** Phase-2 scope for WhatsApp.
