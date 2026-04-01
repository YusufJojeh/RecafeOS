# Deployment (API container)

## Build image

From the **monorepo root**:

```bash
docker build -f apps/api/Dockerfile -t restocafe-api:local .
```

## Run (example)

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e CORS_ORIGIN="https://ops.example.com" \
  -e TRUST_PROXY=true \
  restocafe-api:local
```

Apply DB schema in your pipeline **before** traffic: `npx prisma migrate deploy` (or your migration strategy).

## Post-deploy smoke

- `GET /api/v1/health/live` → 200
- `GET /api/v1/health/ready` → 200 only when the API is ready to serve traffic. Payload includes `status` (`healthy` or `degraded`) plus DB/Redis detail; `503` means `not_ready`.
- Optional: one authenticated request against staging with a test tenant.

## Metrics

When `METRICS_ENABLED=true`, scrape `GET /api/v1/internal/metrics` only from your observability network (firewall or private listener).
