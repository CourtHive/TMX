# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mentat Orchestration (READ FIRST)

Before doing anything else, read `../Mentat/CLAUDE.md`, `../Mentat/TASKS.md`, `../Mentat/standards/coding-standards.md`, and every file in `../Mentat/in-flight/`. Mentat is the orchestration layer for the entire CourtHive ecosystem; its standards override per-repo conventions when they conflict. If you are about to start **building** (not just planning), you must claim a surface in `../Mentat/in-flight/` and run the air-traffic-control conflict check first. See the parent `../CLAUDE.md` "Mentat Orchestration" section for the full protocol.

## Branching — cut from `dev`, not `main` (CA, 2026-09-28)

`dev` is this repo's integration branch. **Branch from `origin/dev` and open PRs against `dev`.** `main`
advances only at checkpoints, by merging `dev` into it. This follows `factory` (since 2026-09-12) and
`courthive-components` (2026-09-28); CA: *"We should do the same for TMX, come to think of it."*

`dev` was created from `main` at `7116f4cb` on 2026-09-28, byte-identical, after the four open renovate
PRs were merged so none was orphaned. **Renovate targets `dev`** (`baseBranches` in `renovate.json`), so
dependency PRs arrive on the integration branch rather than on the release branch.

**A checkpoint merge does NOT publish.** Read from the workflows rather than assumed:

| workflow | trigger | consequence |
|---|---|---|
| `ci.yml` | bare `pull_request:` + `push: [main]` | a PR into `dev` gets the full gate. A direct push to `dev` gets **no** run, so land work by PR |
| `electron.yml` | bare `pull_request:` + `push: [main]` | same |
| `release-please.yml` | `push: [main]` ONLY | a checkpoint merge **refreshes** the release PR. Nothing is tagged or published |
| `deploy-pages.yml` | `release: published` | unaffected |
| `sync-i18n.yml` | `push: [main]`, path-filtered on `src/i18n/locales/en.json` | **an i18n change on `dev` does not sync until it reaches `main`** at a checkpoint |

**`delete_branch_on_merge` is false, deliberately.** A checkpoint PR has `dev` as its HEAD, so auto-delete
would delete the integration branch every time — and GitHub silently **retargets open PRs** whose base is
deleted, which is how work reaches `main` with nobody choosing it. The factory hit exactly this on
2026-09-13. The cost is that merged branches no longer self-delete: prune on PR **state**, never ancestry,
because a squash-merged branch never looks merged.

```bash
gh pr list --repo CourtHive/TMX --state merged --head <branch>
```

The checkpoint merge itself must be a **merge commit**, not a squash — squashing collapses every
conventional commit into one and guts the release-please changelog.

### After a release: the back-merge (CA, 2026-10-05)

release-please's `chore(main): release X.Y.Z` commit (version, CHANGELOG, manifest) lands on `main` only,
so every release is followed by merging `main` back into `dev`. **`back-merge.yml` opens that PR** on
`release: published` (`chore: merge main back into dev after vX.Y.Z`), with the `courthive-release-bot`
App token so CI runs on it (a PR opened by `GITHUB_TOKEN` gets no workflow runs). **Merge it with a merge
commit, never a squash.** It is not auto-merged. If a release's run was missed:
`gh workflow run back-merge.yml -R CourtHive/TMX`.

**The release path takes the light path in CI**, as the factory's release PRs do (#5169(factory)).
`.github/scripts/release-scope.sh` marks a PR light when it is the release-please PR into `main` or the
back-merge PR (`main` -> `dev`) AND its diff is only the version files: `package.json`'s `"version"`
line, `CHANGELOG.md`, `.release-please-manifest.json`. `ci.yml`'s `lint` (the required check) and
`electron.yml`'s `build + smoke` then skip their gates but still report. Any other change gets the full
run.

**`staging` was deleted on 2026-09-28** (CA authorised). It was an ORPHAN history — no merge base with
`main` — last touched March 2024, and the only thing it held that the live `docs` branch does not was six
commits of built site output from one afternoon. `docs` continues that same line. Restore, if ever needed:
`git push origin 1b4b25f623bfcc0a84e9465fabaf82e372af2ea8:refs/heads/staging`.

## Project Overview

TMX is a Progressive Web App for tennis tournament management built on CODES, CourtHive's competition data standard. It is a **vanilla TypeScript** application — no React, Vue, or Angular. All UI is direct DOM manipulation via `document.createElement`, `innerHTML`, and `morphdom`.

## Commands

```bash
pnpm install              # Install dependencies (npm is blocked — use pnpm only)
pnpm start                # Dev server with Vite (opens browser)
pnpm build                # Type-check + production build
pnpm check-types          # TypeScript type-check only (tsc --noEmit)
pnpm lint                 # ESLint — non-mutating, fails on any warning
pnpm lint:fix             # ESLint with auto-fix (rewrites source)
pnpm format               # Prettier on src/
pnpm test                 # Vitest (TZ=UTC, watch mode)
pnpm test --run           # Single test run (no watch)
pnpm storybook            # Storybook dev server on :6006
pnpm commit               # Interactive conventional commit (cz-git)
pnpm test:e2e             # Playwright E2E journey tests (against dev server)
pnpm test:e2e:ui          # Playwright with interactive UI
pnpm test:e2e:prod        # Playwright against production build
```

### E2E Testing (Playwright)

E2E tests live in `e2e/`. See `Mentat/planning/PLAYWRIGHT_E2E_TESTING.md` for the full strategy.

Three-layer assertion architecture:
1. **Mutation log** — `dev.context({ internal: true })` logs every mutation to console; tests capture via `page.on('console')`
2. **Server audit trail** (future) — full-stack mutation verification against the server's audit log
3. **DOM** — targeted assertions on `tmxConstants` IDs + ARIA roles

The **`mocksEngine` superpower**: tests seed any tournament state programmatically via `dev.factory.mocksEngine.generateTournamentRecord()` + `dev.load()`, then assert the UI renders correctly. No UI clicking needed to create test data.

```
e2e/
├── playwright.config.ts    # Vite webServer config
├── helpers/
│   ├── dev-bridge.ts       # dev.context setup + state reset
│   ├── mutation-collector.ts  # Console-based mutation capture
│   ├── seed.ts             # mocksEngine tournament fixture generators
│   └── selectors.ts        # tmxConstants IDs as Playwright locators
├── pages/                  # Page Object Model
├── journeys/               # User journey smoke tests
└── fixtures/               # Snapshots + tournament JSON fixtures
```

## Architecture

### Entry Flow

`index.html` → `src/main.ts` → `setupTMX()` in `src/initialState.ts` → initializes theme, context, IndexedDB, router, subscriptions, navigation.

### Routing

Hash-based SPA routing via **Navigo** (`src/router/router.ts`). Router instance stored on `context.router`. All routes use `#/` prefix (e.g., `/#/tournament/:tournamentId`).

### State Management

No state library. State lives in three places:

1. **`context`** (`src/services/context.ts`) — mutable singleton for router, drawer, modal, tables, EventEmitter
2. **`env`** (`src/settings/env.ts`) — runtime config typed as `any` **intentionally**. Do NOT add TypeScript type constraints to this object.
3. **`tods-competition-factory`** — `tournamentEngine` holds authoritative tournament data in memory

Persistence: IndexedDB via Dexie (`src/services/storage/tmx2db.ts`), user prefs in localStorage (`tmx_settings`).

### Mutation Pattern

All data changes go through `mutationRequest()` (`src/services/mutation/mutationRequest.ts`):
- Validates auth/permissions
- Executes factory methods via `executionQueue()`
- Optionally emits to server via Socket.IO
- Saves locally to IndexedDB

With `env.serverFirst = true` (default), mutations execute on the server first, then locally on acknowledgement.

### Scheduling Workspace — Save Model Invariant (load-bearing)

The scheduling workspace at `/tournament/:id/scheduling/...` shares **one** save model across all three modes (Availability, Profile, Grid). Every mutation initiated from a workspace mode — including `MODIFY_COURT_AVAILABILITY` from the painter — flows through `queueService.executeMethods({ mode, methods })` in `src/services/schedulingWorkspace/queueService.ts`. The service:

- **Immediate mode** — dispatches via `mutationRequest` synchronously.
- **Bulk mode** — applies locally via `competitionEngine.executionQueue` and pushes the batch onto a shared `pendingBatches` queue. `savePending()` flushes all batches as one `mutationRequest`; `discardPending()` reloads the tournament from IndexedDB and clears the queue.

**Invariants that other code must not break:**

1. The standalone `/venues/availability` painter (no workspace) continues to dispatch `mutationRequest` directly. It does NOT participate in the workspace queue. The split is by route, not by component.
2. Availability mutations originating from the workspace painter route through `queueService.executeMethods({ mode: 'availability', ... })` via the painter's `onMutationMethods` hook, never `mutationRequest` directly. Bypassing this hook reintroduces the discard clobber race that Phase 0 closed.
3. `discardPending` must never silently dispatch queued methods. The IDB reload is the only path back to a clean state — if you find yourself wanting to "rescue" a batch on discard, you are violating the invariant.
4. Painter dirty state (`isAvailabilityDirty()`) is tracked separately from the bulk queue (`hasUnsavedChanges()`) because the painter buffers paint internally until its toolbar Save runs. Mode-switch guards and the workspace's sticky action bar consume both signals — do not collapse them.

Regression coverage lives in `src/services/schedulingWorkspace/queueService.test.ts`. If you change the save model, update those tests in the same PR.

### Key Conventions

- **Absolute imports** — `tsconfig.json` sets `baseUrl: "src/"`, so imports use `import { t } from 'i18n'`, `import { env } from 'settings/env'`, etc.
- **DOM IDs** — all element IDs are constants in `src/constants/tmxConstants.ts`. Use the constant, not raw strings.
- **Mutation constants** — factory method names are in `src/constants/mutationConstants.ts`. Use these when calling `mutationRequest()`.
- **Tables** — all data grids use Tabulator (`tabulator-tables`). Table instances stored in `context.tables`.
- **i18n** — `i18next` with 7 locales (en, fr, es, pt-BR, de, ar, zh-CN). Use `import { t } from 'i18n'`.
- **Commit messages** — Conventional Commits with emojis. Use `pnpm commit` for interactive prompt.

### Key Dependencies

| Package | Purpose |
|---|---|
| `tods-competition-factory` | Core business logic — tournament engine, draw generation, scheduling |
| `courthive-components` | Shared UI component library |
| `navigo` | Hash-based SPA router |
| `dexie` | IndexedDB wrapper |
| `tabulator-tables` | Data grid/table component |
| `socket.io-client` | Real-time server communication |

### Code Style Notes

- `@typescript-eslint/no-explicit-any` is OFF — the codebase uses `any` extensively
- `prefer-const` is OFF
- `noImplicitAny` is false in tsconfig
- Prettier: single quotes, trailing commas, 120 char width, 2-space indent

## Ecosystem Coding Standards

This project follows the CourtHive ecosystem coding standards.
See [CourtHive/Mentat/standards/coding-standards.md](https://github.com/CourtHive/Mentat/blob/main/standards/coding-standards.md) for the full reference.

Key repo-specific notes:
- Package manager: pnpm only
- Test runner: vitest
- Lint command: `pnpm lint`
