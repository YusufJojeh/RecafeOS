# Build from monorepo root:
#   docker build -f apps/api/Dockerfile .
#
# Uses pnpm workspaces (@restocafe/types + api). Lockfile: pnpm-lock.yaml only.
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /w

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/ops-web/package.json apps/ops-web/
COPY apps/landing/package.json apps/landing/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/types packages/types
COPY apps/api apps/api
RUN pnpm --filter @restocafe/types build && pnpm --filter api build

# Standalone production bundle (api + prod node_modules + workspace deps)
FROM build AS bundle
RUN pnpm --filter api deploy --prod /deploy

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r nestjs -g 1001 && useradd -r -u 1001 -g nestjs nestjs

COPY --from=bundle /deploy/ ./
# Prisma schema/migrations and bootstrap scripts are not part of deploy fileset
COPY --from=build /w/apps/api/prisma ./prisma
COPY --from=build /w/apps/api/scripts ./scripts
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chown -R nestjs:nestjs /app \
  && chmod +x /docker-entrypoint.sh

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
