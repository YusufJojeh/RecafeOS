# OpenAPI → TypeScript contract layer

## Source

Nest exposes Swagger UI at `/api/docs` and JSON at **`/api/docs-json`** (global prefix `api/v1` is reflected in operation paths).

## Offline export (no running server)

From the repo root:

```bash
pnpm run contract:openapi:export
```

Writes **`contracts/openapi.json`** (gitignored; see [`contracts/README.md`](../../contracts/README.md)). Use this file with `openapi-typescript` or any OpenAPI consumer without starting HTTP.

## Generate TypeScript from a running API

1. Start the API: `pnpm run dev:api` (or any process that serves Swagger).
2. From the repo root:

```bash
pnpm run contract:openapi -w ops-web
```

Output: `apps/ops-web/src/generated/openapi-api.d.ts` (created on demand; see `apps/ops-web/src/generated/README.md`).

Override the URL if needed:

```bash
npx openapi-typescript https://staging.example.com/api/docs-json -o apps/ops-web/src/generated/openapi-api.d.ts
```

## Consumption (next steps)

- Import `paths` / `components` from the generated file and narrow `apiFetch<T>()` call sites, **or**
- Pair with `openapi-fetch` for typed path/method helpers.

## CI note

Generation is **not** wired into CI by default (avoids coupling builds to a running API). Hot-path response shapes are additionally pinned in [`apps/ops-web/src/lib/contract/staff-api.ts`](../../apps/ops-web/src/lib/contract/staff-api.ts). The durable mutation matrix lives in [`packages/types/src/mutation-safety.ts`](../../packages/types/src/mutation-safety.ts) with Vitest coverage in ops-web.
