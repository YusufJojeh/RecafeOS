# Secrets management (production checklist)

Use this as a gate before exposing the API to paying customers.

## Required secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Postgres connection string (no commit to git) |
| `JWT_ACCESS_SECRET` | Signing access tokens (long random, ≥32 bytes) |
| `JWT_REFRESH_SECRET` | Signing refresh tokens (distinct from access) |
| `SUPPORT_API_KEY` | Optional; enables support HTTP API (`x-support-api-key`) for all routes when used **alone** (legacy) |
| `SUPPORT_API_KEY_READ` | With `SUPPORT_API_KEY_WRITE`, split mode: GET-style support routes accept read or write key |
| `SUPPORT_API_KEY_WRITE` | With `SUPPORT_API_KEY_READ`: POST/PATCH support routes accept **write** key only |

Use **either** `SUPPORT_API_KEY` **or** both read+write keys—not both ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md)).

## Storage

- **Do not** bake secrets into Docker images or frontend bundles.
- Prefer your platform’s **secret manager** (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Doppler, etc.).
- Rotate JWT secrets with a **planned migration** (short overlap window or force logout).

## Production environment

- `NODE_ENV=production`
- `CORS_ORIGIN` must be a **comma-separated allowlist** (required at bootstrap).
- `TRUST_PROXY=true` when the app sits behind a reverse proxy / load balancer that terminates TLS.
- `HELMET_ENABLED` defaults to enabled; set to `false` only for narrow debugging.
- `METRICS_ENABLED=true` only on internal networks or scrape jobs; protect `/api/v1/internal/metrics` at the edge.

## CI

- CI should not echo secrets; use encrypted repository secrets.
- The default workflow runs `npm audit --audit-level=critical` (high/moderate advisories in devDependencies are reviewed separately).

## Deployment

See [`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md) for Docker, migrations, rollback, and backup expectations.
