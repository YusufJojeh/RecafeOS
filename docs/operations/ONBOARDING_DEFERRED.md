# Deferred onboarding features (pilot v1)

These are **intentionally out of scope** for the fastest one-day pilot unless a venue is blocked without them. See [ONE_DAY_PILOT_RUNBOOK.md](./ONE_DAY_PILOT_RUNBOOK.md).

## Menu CSV / bulk import

- **Today:** Menu is managed via **Menu** in ops-web (CRUD). Provision can seed a **sample menu** for smoke tests.
- **Defer:** A single `POST` CSV or JSON import endpoint until multiple pilots cannot enter menus manually in one day.
- **Workaround:** Duplicate items quickly from sample categories; support can re-provision a branch with `includeSampleMenu` for demos.

## Staff invite / self-serve signup

- **Today:** First **owner** (and linked user) comes from [support provision](./ONBOARDING_PROVISION.md). Role templates (owner, manager, cashier, kitchen) are created in `ensureRoleTemplatesForTenant` in the API provisioning helpers, but **additional users** are not exposed as a self-serve product flow in the pilot API surface.
- **Defer:** Email invite tokens and password-set flows (larger UX + security surface).
- **Workaround:** Share owner login for day-one smoke (policy permitting); or add users through a **future** support-only member-creation endpoint if you standardize it; avoid ad-hoc DB edits in production without a runbook.

## Support API: add tenant member

- **Status:** Shipped — **`POST /api/v1/support/tenants/:tenantId/members`** (support API key + write access). Creates staff with role `manager` | `cashier` | `kitchen` (not owner); idempotent when the email already belongs to the tenant. See [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md).
- **Requirements:** Audit log (`support.tenant_member_create`), validation, idempotent email handling — implemented in `apps/api/src/modules/support/`.

## Tax / service charge “defaults”

- **Today:** Pricing is on **menu items**; branch-level **settings** JSON can hold conventions later.
- **Defer:** Full tax/service engines until product rules are defined.

## QR image generation API

- **Today:** Guest flow uses a **URL** built from `APP_PUBLIC_URL`; print or generate QR in the browser or external tool.
- **Defer:** Server-side QR PNG/PDF unless a pilot cannot use browser print.
