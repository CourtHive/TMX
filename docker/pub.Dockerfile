FROM node:22-bookworm-slim AS build

ARG PUBLIC_REPOSITORY=https://github.com/CourtHive/courthive-public.git
ARG PUBLIC_REF=3190a0f4c295b0c22d3d171283c28f276884766b

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git init \
  && git remote add origin "$PUBLIC_REPOSITORY" \
  && git fetch --depth 1 origin "$PUBLIC_REF" \
  && git checkout --detach FETCH_HEAD

RUN corepack enable \
  && corepack prepare pnpm@12.3.4 --activate

# The upstream workspace normally links CourtHive sibling repositories. Use
# the published packages when building this standalone image instead.
# All services in this Compose deployment share one public origin. The runtime
# override is also honored by the public Socket.IO client, unlike VITE_SERVER,
# and keeps reusable images independent of a hostname.
RUN sed -i '/: link:\.\.\//d' pnpm-workspace.yaml \
  && rm pnpm-lock.yaml \
  && HUSKY=0 pnpm install --no-frozen-lockfile \
  && BASE_URL=pub pnpm build \
  && printf '%s\n' 'window.dev={...(window.dev||{}),baseURL:window.location.origin};' > dist/runtime-config.js \
  && sed -i 's#<script type="module"#<script src="/pub/runtime-config.js"></script><script type="module"#' dist/index.html


FROM nginx:1.29-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html/pub/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
