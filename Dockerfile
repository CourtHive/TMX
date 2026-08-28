FROM node:22-bookworm-slim AS build

WORKDIR /app

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

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
