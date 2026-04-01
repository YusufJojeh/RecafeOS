# Pilot feedback intake template (copy-paste)

Use this for **Notion**, **Jira**, **Linear**, or email to CS. The system of record for structured data is **`POST /api/v1/support/tenants/:tenantId/pilot-feedback`** ([PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md)). Do not treat WhatsApp threads as the backlog.

## Required

- **Tenant id** (cuid) or **slug** (resolve via `GET /api/v1/support/lookup/tenant-slug/:slug`)
- **Branch id** (optional; if issue is branch-specific)
- **feedbackType** (one of): `bug` | `onboarding_issue` | `training_issue` | `support_issue` | `product_gap` | `feature_request` | `nice_to_have`
- **severity**: `sev1` | `sev2` | `sev3` | `sev4` | `low`
- **title** (short)
- **description** (what happened, expected vs actual)
- **evidenceQuality**: `logged_request_id` | `screenshot` | `verbal_only`

## Strongly recommended

- **requestId** — `x-request-id` from the failed HTTP response ([SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md))
- **moduleTag** — e.g. `kitchen`, `pos`, `floor`, `payments`
- **blastRadius** — `single_branch` | `tenant_wide` | `unknown`
- **externalIncidentUrl** — link to external ticket if any

## Triage (CS / weekly review)

- **themeKey** — merge repeated pain points (e.g. `printer-network`, `qr-setup`)
- **businessCritical** — true only if contract/UAT or revenue path blocked
- **status** — usually `open` at intake; move to `triaged` | `resolved` | `closed` in review
- **triageNotes** — internal only

## Example (JSON for API)

```json
{
  "feedbackType": "bug",
  "severity": "sev3",
  "title": "Pay button spins after network blip",
  "description": "Steps: … Expected: … Actual: …",
  "evidenceQuality": "logged_request_id",
  "requestId": "req_abc123",
  "moduleTag": "payments",
  "blastRadius": "single_branch",
  "branchId": "clx…"
}
```
