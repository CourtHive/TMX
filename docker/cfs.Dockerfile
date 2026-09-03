FROM node:22-bookworm-slim AS build

ARG CFS_REPOSITORY=https://github.com/CourtHive/competition-factory-server.git
ARG CFS_REF=8307af5c17a52bebb62c8705293a9f65b2386e7f

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
COPY --from=build /app/seeds/ ./seeds/
COPY --from=build /app/src/storage/postgres/migrations/ ./src/storage/postgres/migrations/
COPY --from=build /app/src/scripts/admin-user.mjs ./src/scripts/admin-user.mjs

EXPOSE 8383

CMD ["node", "build/src/main.js"]
