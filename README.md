# TMX

**eXtensible Tournament Manager** — the operations client of the CourtHive platform. TMX is the
screen a tournament desk actually runs the day on: draws, entries, the order of play, the court grid,
scores as they come in.

## Overview

TMX is a browser application (and a desktop build) powered by the **Competition Factory** — the same
rules engine that runs on the server and in the ingest pipeline. Everything it reads and writes is a
**CODES** record, CourtHive's canonical competition data standard, which the engine stores natively
rather than exporting to. One record flows unchanged from entry through scheduling to the public
viewer, which is why a draw made here is the same object a spectator sees.

That shared-engine design is the reason TMX can run local-first and still agree with everyone else on
the tournament: the client executes the same mutations the server does, so the desk keeps working when
the network does not. **[How CourtHive works](https://courthive.com/#/how-it-works)** walks through
the whole picture — the one engine, the three deployment lanes, and where TMX sits among the other
surfaces.

## What it does

**Draws and events** — generation and management across elimination, round-robin and tiered
structures, with entry management for singles, doubles and teams.

**Scheduling** — the largest surface, and the one that has grown the most:

- a court grid with drag-and-drop placement, schedule locks, and court-time-order conflict detection
- a **Now strip** — one cell per court showing what is live, suspended or called, with call-to-court
  and start-all bulk actions
- **readiness**: for any scheduled matchUp, whether it can actually start at the time written — an
  upstream match that will not finish in time, a participant due on court elsewhere, a recovery window
  that is not met. The scheduled time is coloured by what it finds
- **rest and recovery** tracking per player, including the side of a matchUp still being played for
  upstream
- **plan mode** — draft a day as a scenario without touching the official schedule
- venue and court availability, reserved cells, and printable court cards
- check-in, with a configurable prompt before a match is called to court
- order-of-play publishing

**Scoring** — several input paths for different desk habits, including hotkey entry from the matchUps
table, plus **delegated scoring**: nominate a scorekeeper and take a live relay from the court.

**Participants** — import from delimited files or Google Sheets with column auto-mapping, rating
parsing and draft merging before anything is committed.

**Officials** — an assignment board with eligibility rules and conflict-of-interest detection.

**Publishing** — per-event and per-draw publish state, so a tournament reveals itself in the order the
organiser chooses.

**Collaboration** — mutations travel over a WebSocket queue, so several people can run one tournament
at once and each sees the others' work as it lands. With chat and notifications alongside.

**Reports and PDFs** — draws, schedules, sign-in sheets and court cards, plus structure audits.

**Localisation** — English is bundled for instant first paint; other locales, including right-to-left
ones, are delivered at runtime and cached by content hash.

## [Online demo](https://courthive.github.io/TMX)

Runs entirely in the browser against local storage — import players from a spreadsheet, build a draw,
schedule it. Tracks released versions rather than every commit.

## Getting started

```bash
# Install dependencies (pnpm only — npm is blocked by `packageManager`)
pnpm install

# Development server
pnpm start

# Build for production
pnpm build

# Checks (what CI runs)
pnpm lint && pnpm format:check && pnpm attr-audit --ci && pnpm i18n-audit --ci
pnpm check-types
pnpm test --run

# Playwright journeys — 121 specs, not run by CI
pnpm test:e2e
```

## Technology

| | |
|---|---|
| **Data standard** | CODES — CourtHive's canonical competition record, written natively by the engine |
| **Business logic** | [tods-competition-factory](https://github.com/CourtHive/tods-competition-factory) |
| **UI components** | [courthive-components](https://github.com/CourtHive/courthive-components) |
| **Framework** | Vanilla TypeScript — no React/Vue/Angular |
| **Build** | Vite · Electron for the desktop build |
| **Storage** | IndexedDB (Dexie) for tournament records, localStorage for preferences |
| **Transport** | Socket.IO to the competition factory server |
| **Tables / PDF** | Tabulator · pdfMake |
| **Testing** | Vitest · Playwright · Storybook |

## Related projects

- **[How CourtHive works](https://courthive.com/#/how-it-works)** — the platform in one page: the
  shared engine, the CODES record, and how the surfaces fit together
- **[Competition Factory](https://github.com/CourtHive/tods-competition-factory)** — the rules engine
  TMX and the server both run
- **[courthive-components](https://github.com/CourtHive/courthive-components)** — shared UI components

## License

See LICENSE file for details.

## Archive

Historical documentation has been moved to `docs/archive/` for reference.
