# Generated API types (optional)

**Offline OpenAPI JSON** (no server): from repo root, `pnpm run contract:openapi:export` → `contracts/openapi.json`, then point `openapi-typescript` at that file.

**From a live API** (Swagger enabled — default in non-production or when `SWAGGER_ENABLED=true`):

```bash
# from repo root
pnpm run contract:openapi -w ops-web
```

This writes `openapi-api.d.ts` (gitignored until you choose to commit snapshots).

Use paths with `openapi-fetch` or manual typing of `apiFetch` responses in a follow-up PR.

See [`docs/contracts/openapi.md`](../../../docs/contracts/openapi.md).
