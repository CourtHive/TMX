# TMX Development Guide

A practical guide for developers working on the CourtHive TMX tournament management application.

## Architecture at a Glance

TMX is a **vanilla TypeScript** single-page application with no framework (no React, Vue, or Angular). UI is built via direct DOM manipulation. Business logic lives in the `tods-competition-factory` engine; TMX is the rendering and interaction layer on top of it.

```text
Browser
  ├── Navigo (hash router)          → pages/
  ├── Tabulator (data tables)       → components/tables/
  ├── courthive-components          → controlBar, renderForm, cModal
  ├── tods-competition-factory      → tournamentEngine (all business logic)
  ├── axios + socket.io-client      → services/apis/, services/messaging/
  └── Dexie (IndexedDB)             → services/storage/
```

## Project Structure

```text
src/
├── main.ts                 # Boot sequence
├── initialState.ts         # Initialization: styles, subscriptions, navigation
├── router/router.ts        # Navigo route definitions (hash-based)
├── pages/                  # Top-level page renderers
│   ├── tournament/         # Single-tournament view (tabs: overview, events, schedule, etc.)
│   └── tournaments/        # Tournament list & calendar
├── components/
│   ├── framework/          # Root DOM scaffolding (rootBlock, eventBlock)
│   ├── modals/             # Modal dialogs (50+ types)
│   ├── tables/             # Tabulator table definitions
│   ├── popovers/           # Tippy.js popover menus
│   ├── drawers/            # Side panel drawers
│   └── elements/           # Small reusable DOM elements
├── services/
│   ├── apis/baseApi.ts     # Axios instance with JWT interceptor
│   ├── apis/servicesApi.ts # Typed REST endpoints
│   ├── authentication/     # JWT token management, login/logout flow
│   ├── messaging/socketIo.ts # Socket.IO real-time communication
│   ├── storage/tmx2db.ts   # IndexedDB via Dexie (offline caching)
│   ├── context.ts          # Global mutable application state
│   ├── notifications/      # Toast notifications
│   └── dom/                # DOM utilities
├── types/tmx.ts            # Shared TypeScript interfaces
├── constants/              # String constants and enumerations
├── settings/env.ts         # Runtime configuration (mutable)
├── styles/                 # CSS files (Bulma + custom)
├── i18n/                   # Internationalization (6 languages)
└── config/                 # Server/build configuration
```

## Key Concepts

### 1. The Global Context

`services/context.ts` is the application's central state bus. It holds runtime references that many modules need:

```typescript
context.router; // Navigo router (navigate, resolve)
context.provider; // Current provider during impersonation
context.tables; // Active Tabulator instances
context.ee; // EventEmitter for pub/sub messaging
context.drawer; // Drawer component
context.modal; // Modal component
context.state; // { authorized, admin }
context.displayed; // Current UI state (selected date, draw event)
```

**Convention:** Always use optional chaining when accessing context properties that may be undefined (`context.router?.navigate(...)`). The context is populated during initialization and some properties are only set after certain user actions.

### 2. The Tournament Engine

All tournament business logic lives in `tods-competition-factory`. TMX never implements draw generation, scoring rules, scheduling algorithms, or data validation directly. Instead:

```typescript
import { tournamentEngine } from 'tods-competition-factory';

// Read state
const { tournamentRecord } = tournamentEngine.getTournament();
const { matchUps } = tournamentEngine.allTournamentMatchUps();

// Mutate state (engine handles validation)
tournamentEngine.addEvent({ event });
tournamentEngine.setMatchUpStatus({ matchUpId, outcome });
```

The engine publishes mutation events that TMX subscribes to in `initialState.ts` for broadcasting changes to the server.

### 3. Building UI Components

Components are plain functions that create and return DOM elements:

```typescript
export function createSomething({ title, onClick }: { title: string; onClick: () => void }): HTMLElement {
  const container = document.createElement('div');
  container.className = 'my-component';
  container.innerHTML = `<h3>${title}</h3>`;
  container.addEventListener('click', onClick);
  return container;
}
```

**Patterns to follow:**

- **Tables:** Use Tabulator. Create table definitions in `components/tables/`, configure columns with formatters, and let Tabulator handle virtual scrolling.
- **Modals:** Use `openModal()` from `components/modals/baseModal/baseModal.ts`. Pass a `content` function that receives an element and populates it.
- **Forms:** Use `renderForm()` from `courthive-components` for declarative form layouts with checkboxes, radio buttons, inputs, and typeaheads.
- **Control bars / toolbars:** Use `controlBar()` from `courthive-components` for search fields, dropdowns, and action buttons.
- **Popover menus:** Use `tipster()` from `components/popovers/tipster.ts` for context menus attached to a target element.
- **Toast notifications:** Use `tmxToast()` for success/error/warning messages with optional action buttons.

### 4. CSS and Styling

TMX uses **Bulma** as its CSS framework plus custom stylesheets in `src/styles/`.

For component-specific styles that need to be injected dynamically, follow the `ensureStyles()` pattern:

```typescript
function ensureStyles(): void {
  const id = 'my-component-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .my-component { display: flex; gap: 0.5rem; }
    .my-component-header { font-weight: bold; }
  `;
  document.head.appendChild(style);
}
```

This pattern deduplicates style injection via the element ID and keeps styles co-located with their component.

### 5. Routing

Routes are defined in `router/router.ts` using Navigo with hash-based URLs. The general pattern:

```text
#/tournament/:tournamentId                    → tournament overview
#/tournament/:tournamentId/events/:eventId    → event detail
#/tournaments                                 → tournament list
#/tournaments/:uuid                           → force-refresh list
```

Navigate programmatically:

```typescript
context.router?.navigate(`/tournament/${tournamentId}`);
```

### 6. Authentication

JWT-based auth with tokens stored in localStorage.

- `getLoginState()` returns a typed `LoginState` (email, roles, permissions, services, provider) or `undefined`.
- The axios interceptor in `baseApi.ts` attaches the JWT to every request.
- Roles include `super_admin`, `admin`; permissions include `deleteTournament`, `devMode`.
- Provider impersonation sets `context.provider` to a `ProviderValue`.

### 7. API Layer

REST calls go through `services/apis/servicesApi.ts`, all using `baseApi.post()`. Real-time updates flow through `services/messaging/socketIo.ts`.

API functions are typed with interfaces from `types/tmx.ts`:

```typescript
export async function getProviders(): Promise<ProvidersResponse> {
  return await baseApi.post('/provider/allProviders', {});
}
```

### 8. Internationalization

All user-facing strings use i18next:

```typescript
import { t } from 'i18n';
element.textContent = t('modals.settings.title');
```

Translation files live in `i18n/locales/`. When adding new strings, add the key to `en.json` first, then run `node src/i18n/compare-keys.cjs` to identify missing translations in other languages.

### 9. Types

Shared interfaces live in `src/types/tmx.ts`:

- `LoginState` - decoded JWT payload
- `ProviderValue`, `ProviderRecord` - provider data
- `UserValue`, `UserRecord` - user data
- `ProvidersResponse`, `UsersResponse`, `InviteResponse` - API response wrappers

When adding new API endpoints or data shapes, define interfaces here and thread them through the call chain rather than using `any`.

## Development Workflow

### Setup

```bash
pnpm install
pnpm start          # Vite dev server at localhost:5173
```

### Build & Quality

```bash
pnpm run build      # TypeScript compilation + Vite bundle
pnpm lint           # ESLint with auto-fix
pnpm format         # Prettier formatting
pnpm test           # Vitest test runner
```

### Environment

- Development server: `.env.development` (`SERVER=http://localhost:8383`)
- Production: `.env.production` (`SERVER=https://courthive.net`)
- Package manager: **pnpm only** (never npm)

### Git Conventions

- Husky pre-commit hooks run lint-staged
- Commit messages follow conventional commit format (enforced by commitlint)
- Use `pnpm commit` for guided commit creation

## Common Tasks

### Adding a new tab to the tournament page

1. Create a renderer in `pages/tournament/tabs/yourTab/`.
2. Register the tab constant in `constants/tmxConstants.ts`.
3. Add the tab to the tab bar in `pages/tournament/tournamentDisplay.ts`.
4. Add route handling if the tab needs URL-addressable sub-views.

### Adding a new modal

1. Create the modal file in `components/modals/`.
2. Use `openModal()` for standard modals or `cModal.open()` for simpler ones.
3. Pass `content` as a function `(elem: HTMLElement) => void` that builds the modal body.
4. Add action buttons with `onClick` handlers and `close: true`.

### Adding a new API endpoint

1. Add the function to `services/apis/servicesApi.ts` with typed parameters and return type.
2. If the response introduces a new shape, define the interface in `types/tmx.ts`.
3. Handle errors at the call site; the axios interceptor handles 401s globally.

### Adding a new setting

1. Add the field to `settings/env.ts`.
2. Add UI controls in `components/modals/settingsModal.ts`.
3. Persist via `saveSettings()` / `loadSettings()` in `services/settings/settingsStorage.ts`.
4. Add the i18n key to `i18n/locales/en.json`.

## Architecture Decisions

| Decision                 | Rationale                                                                       |
| ------------------------ | ------------------------------------------------------------------------------- |
| No framework             | Maximum control over DOM, no virtual DOM overhead for large draw visualizations |
| Hash-based routing       | Works on static hosting (GitHub Pages), supports offline use                    |
| Mutable global context   | Simple service locator for vanilla JS; avoid prop-drilling without a framework  |
| tods-competition-factory | Separates business logic from UI; engine is reusable across front-ends          |
| Bulma CSS                | Lightweight utility classes without build-time CSS processing                   |
| Dexie/IndexedDB          | Enables offline tournament editing and local caching                            |
| Socket.IO + REST         | REST for CRUD operations, WebSocket for real-time collaboration                 |

## Pitfalls to Avoid

- **Don't implement business logic in TMX.** Draw generation, scoring rules, scheduling algorithms, and validation belong in `tods-competition-factory`. TMX is the UI layer.
- **Don't forget optional chaining on `context.router`** and other optional context properties. The TypeScript types enforce this.
- **Don't use `npm`**. The project uses pnpm workspaces.
- **Don't skip i18n.** All user-facing strings should go through `t()`. Even if you only write English, the key must exist in `en.json`.
- **Don't create new global state.** Use `context` for truly global state; prefer passing data through function parameters.
- **Don't ignore lint warnings.** The ESLint config is tuned to catch real issues. Run `pnpm lint` before committing.
