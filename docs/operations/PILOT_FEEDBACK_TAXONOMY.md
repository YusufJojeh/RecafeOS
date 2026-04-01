# Pilot feedback taxonomy (RestoCafe OS)

Canonical categories for **paid pilot** feedback. Every intake item must be assigned **one** primary type before it influences engineering backlog. Companion: [PILOT_ESCALATION_MATRIX.md](./PILOT_ESCALATION_MATRIX.md), [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md).

## Rules

1. **Type + severity + resolution path** are required before escalation to product/engineering.
2. **`verbal_only` evidence** does not get a GitHub/Jira engineering ticket until reproduced, logged with **`x-request-id`**, or otherwise verified ([SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md)).
3. **WhatsApp** (or similar) may carry **attachments** only; the **system of record** is the structured intake (API `POST .../pilot-feedback` or your ticket template mirroring these fields).

## Primary type (`feedbackType`) — mutually exclusive

| Type | Definition | Default owner | Escalates to product/eng when |
|------|------------|---------------|--------------------------------|
| `bug` | Behavior contradicts current product or documented runbook; reproducible or correlated with logs via `x-request-id` | Support → Eng | Confirmed defect or high customer impact (see severity in matrix) |
| `onboarding_issue` | Setup, config, migration, or data prep blocks progress | CS / onboarding | Playbook exhausted and still blocked |
| `training_issue` | User error or knowledge gap; product behaves as designed | CS / training | **Not** escalated as a feature; may spawn documentation or training task |
| `support_issue` | Account, access, billing, or operational request | Support | Only if a code or platform change is required |
| `product_gap` | Missing capability **required** for contract or signed UAT scope | Product | Weekly triage; may become an epic |
| `feature_request` | Valuable enhancement, not contract-blocking | Product | Roadmap only; no “drop everything” unless promoted |
| `nice_to_have` | Convenience or polish | Backlog | Does **not** escalate by default |

## Secondary tags

- **Module** (`moduleTag`): e.g. `pos`, `kitchen`, `floor`, `payments`, `inventory`, `qr`, `reports`, `integrations`.
- **Blast radius** (`blastRadius`): `single_branch` | `tenant_wide` | `unknown`.
- **Evidence quality** (`evidenceQuality`): `logged_request_id` | `screenshot` | `verbal_only`.

## Wrong-bucket corrections (examples)

| Reported as | Often actually | Action |
|-------------|----------------|--------|
| Bug | Training issue | Close as training; link runbook or short Loom |
| Feature request | Product gap | Reclassify if contract references that workflow |
| Product gap | Nice-to-have | Reclassify unless contract/UAT explicitly requires it |
| Bug | Support issue | Billing/access/config — resolve in support first |

## API

Structured items are stored via support API: `POST /api/v1/support/tenants/:tenantId/pilot-feedback` (see [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md)). Listed with `GET` on the same path prefix.
