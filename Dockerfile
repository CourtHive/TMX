FROM node:22-bookworm-slim AS build

WORKDIR /app

# Serve TMX below /tmx/ so every other same-origin route can be forwarded to
# competition-factory-server without enumerating its REST endpoints.
ENV BASE_URL=tmx
ARG VITE_SCORE_RELAY_URL=disabled
ENV VITE_SCORE_RELAY_URL=${VITE_SCORE_RELAY_URL}

RUN corepack enable \
  && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-workspace.yaml .npmrc ./
RUN sed -i '/: link:\.\.\//d' pnpm-workspace.yaml \
  && pnpm install --no-frozen-lockfile --ignore-scripts \
  && pnpm rebuild esbuild

COPY . .
RUN sed -i '/: link:\.\.\//d' pnpm-workspace.yaml \
  && pnpm build


FROM nginx:1.29-alpine

# The stock nginx entrypoint renders templates with container environment
# variables before startup. This keeps the CFS upstream port aligned with the
# same APP_PORT value passed to the cfs service by Compose.
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/tmx/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
