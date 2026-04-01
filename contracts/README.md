# API contract artifacts

## OpenAPI snapshot (offline)

Generate the Swagger document **without** a running HTTP server (uses an in-memory Nest app + stubbed Prisma):

```bash
pnpm run contract:openapi:export
```

Output: `openapi.json` in this directory (ignored by git by default). Use it for:

- `openapi-typescript contracts/openapi.json -o …` in any consumer app
- Diffing against a previous export in release review

Regenerate after changing controllers, DTOs, or global Swagger configuration.
