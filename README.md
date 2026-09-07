# TMX

Tournament Management exTreme, or, because it works with data standards (**[TODS](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)**) and an ethos of collaborative development: **eXtensible Tournament Manager**.

## Overview

TMX is a Progressive Web App for tennis tournament management built on the TODS data standard and powered by the Competition Factory.

### Key Features

- ✅ TODS-compliant tournament data management
- ✅ Draw generation and management
- ✅ Real-time score entry with multiple input approaches
- ✅ Entry management with Singles/Doubles support
- ✅ PDF generation for draws, schedules, and sign-in sheets
- ✅ Google Sheets integration for player imports
- ✅ Offline-capable PWA

## [Online Demo](https://courthive.github.io/TMX)

Try TMX in your browser - import players from Google Sheets or TODS tournament files.

## Getting Started

```bash
# Install dependencies (pnpm only — npm is blocked by `packageManager`)
pnpm install

# Development server
pnpm start

# Build for production
pnpm build
```

## Docker with server persistence

The Compose stack serves TMX and Competition Factory Server from one origin,
with tournament data persisted in PostgreSQL and Redis used as a cache:

```bash
docker compose up --build -d
```

Open <http://localhost:8080/tmx/>. The first build downloads a pinned revision
of `CourtHive/competition-factory-server`; subsequent builds use Docker's cache.

For automatic first-start provisioning, copy `.env.docker.example` to `.env`,
set `TMX_ADMIN_EMAIL` and `TMX_ADMIN_PASSWORD`, then start the stack. The account
is created after database migrations; later restarts do not reset its password.
You can also create an administrator manually after the stack is healthy:

```bash
docker compose exec cfs node src/scripts/admin-user.mjs create \
  --email admin@example.com \
  --password change-me-now
```

Replace all example secrets before making the service reachable outside a
trusted development machine. PostgreSQL
data survives container replacement in the `tmx_postgres-data` named volume.
Normal shutdown preserves it:

```bash
docker compose down
```

Passing `--volumes` to `docker compose down` deliberately deletes the database.
Anonymous/demo tournaments remain browser-local; authenticated provider-owned
tournaments use CFS's server-first persistence.

### Publishing Docker images

An image built normally on an Apple Silicon machine contains only
`linux/arm64` and cannot run on a typical `linux/amd64` server. Publish both
architectures with Buildx (replace the example registry names):

```bash
docker buildx create --name tmx-builder --driver docker-container --use
docker buildx inspect --bootstrap

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ghcr.io/your-user/tmx:latest \
  --push .

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --file docker/cfs.Dockerfile \
  --build-arg CFS_REF=525571e5f8110376d6c8534c37cc3d975a2f0f15 \
  --tag ghcr.io/your-user/tmx-cfs:latest \
  --push .
```

For an AMD64-only deployment, use `--platform linux/amd64` instead. Set
`TMX_IMAGE` and `TMX_CFS_IMAGE` in `.env` to those published tags, then deploy
without rebuilding them on the server:

```bash
docker compose pull tmx cfs
docker compose up --no-build -d
```

## Technology Stack

- **Data Standard:** TODS (Tennis Open Data Standards)
- **Business Logic:** tods-competition-factory (npm package)
- **UI Components:** courthive-components (shared library)
- **PDF Generation:** pdfMake
- **Build:** Vite
- **Framework:** Vanilla TypeScript

## Related Projects

- **[Competition Factory](https://github.com/CourtHive/tods-competition-factory)** - Business rules and data validation
- **[courthive-components](https://github.com/CourtHive/courthive-components)** - Shared UI components
- **[TODS Specification](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)** - Tennis data standard

## License

See LICENSE file for details.

## Archive

Historical documentation has been moved to `docs/archive/` for reference.
