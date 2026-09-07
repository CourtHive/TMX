FROM node:22-bookworm-slim AS build

ARG CFS_REPOSITORY=https://github.com/CourtHive/competition-factory-server.git
ARG CFS_REF=525571e5f8110376d6c8534c37cc3d975a2f0f15

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git init \
  && git remote add origin "$CFS_REPOSITORY" \
  && git fetch --depth 1 origin "$CFS_REF" \
  && git checkout --detach FETCH_HEAD \
  && rm -rf .git

RUN corepack enable \
  && corepack prepare pnpm@11.24.0 --activate

# The upstream checkout is optimized for CourtHive's sibling-repository
# workspace. Those links do not exist in this isolated image. All linked
# packages used at runtime have published versions in package.json; the one
# remaining direct link and its compile-time test preflight are test-only and
# are removed from the container copy.
RUN sed -i '/: link:\.\.\//d' pnpm-workspace.yaml \
  && node -e "const fs=require('node:fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.dependencies['courthive-ingest'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && rm pnpm-lock.yaml \
  && rm -rf src/tests \
  && HUSKY=0 pnpm install --no-frozen-lockfile \
  && pnpm build \
  && pnpm prune --prod --ignore-scripts


FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/build/ ./build/
COPY --from=build /app/i18n/ ./i18n/
# Provider-owned policy seeds reference provider rows from the upstream
# deployment and violate the foreign key on a fresh standalone database.
# Ship only portable, platform-owned catalog policies in the generic image.
COPY --from=build /app/seeds/policies/README.md ./seeds/policies/README.md
COPY --from=build /app/seeds/policies/_global/ ./seeds/policies/_global/
COPY --from=build /app/src/storage/postgres/migrations/ ./src/storage/postgres/migrations/
COPY --from=build /app/src/scripts/admin-user.mjs ./src/scripts/admin-user.mjs
COPY --chmod=755 docker/cfs-entrypoint.sh /usr/local/bin/cfs-entrypoint

CMD ["cfs-entrypoint"]
