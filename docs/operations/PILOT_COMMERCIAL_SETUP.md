# Paid pilot — commercial fields (copy-paste playbook)

Use after provisioning a tenant ([ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md)). Replace placeholders:

| Placeholder | Meaning |
|-------------|---------|
| `API_BASE` | e.g. `https://api.example.com/api/v1` |
| `KEY` | `SUPPORT_API_KEY` value |
| `TENANT_ID` | Tenant cuid from `GET /support/lookup/tenant-slug/:slug` |

## 1. Plan, billing, and limits (paid pilot)

```bash
curl -sS -X PATCH "${API_BASE}/support/tenants/${TENANT_ID}/commerce" \
  -H "x-support-api-key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionPlan": "growth",
    "billingStatus": "active",
    "maxBranches": 3,
    "maxUsers": 25
  }'
```

Adjust `subscriptionPlan` (`starter` | `growth` | `scale` | `trial`), `maxBranches`, and `maxUsers` per contract. Omit overrides to use plan defaults from [`plan-limits.config.ts`](../../apps/api/src/commerce/plan-limits.config.ts).

## 2. Customer success metadata (pilot tag + notes)

```bash
curl -sS -X PATCH "${API_BASE}/support/tenants/${TENANT_ID}/metadata" \
  -H "x-support-api-key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "commercialEngagement": "pilot",
      "pilotPhase": "live",
      "csOwner": "you@company.com",
      "pilotNotes": "Contract ref; internal only."
    }
  }'
```

See [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md) for all keys.

## 3. Verify support view

```bash
curl -sS "${API_BASE}/support/tenants/${TENANT_ID}/summary" \
  -H "x-support-api-key: ${KEY}"
```

Confirm `commercial.effectiveLimits`, `commercial.access`, and `pilot` / `commercial.metadata` match expectations.

## 4. Pause or close (when needed)

**Suspend** (blocks staff + guest flows):

```bash
curl -sS -X POST "${API_BASE}/support/tenants/${TENANT_ID}/suspend" \
  -H "x-support-api-key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"reasonCode":"customer_request","note":"Pilot paused per customer."}'
```

**Reactivate** (restores prior `billingStatus` when stored):

```bash
curl -sS -X POST "${API_BASE}/support/tenants/${TENANT_ID}/reactivate" \
  -H "x-support-api-key: ${KEY}"
```

**Close account** (`billingStatus: canceled`):

```bash
curl -sS -X PATCH "${API_BASE}/support/tenants/${TENANT_ID}/commerce" \
  -H "x-support-api-key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"billingStatus":"canceled"}'
```

Full lifecycle: [COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md).
