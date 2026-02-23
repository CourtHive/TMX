# Dark Mode for TMX — Implementation Guide

> **Status:** Planning
> **Scope:** TMX application + courthive-components library
> **Bulma version:** 1.0.4 (native dark mode via `data-theme`)

---

## Table of Contents

1. [Overview & Design Principles](#1-overview--design-principles)
2. [Current State Audit](#2-current-state-audit)
3. [CSS Variable Naming Convention](#3-css-variable-naming-convention)
4. [Complete Color Inventory](#4-complete-color-inventory)
5. [Theme Toggle Mechanism](#5-theme-toggle-mechanism)
6. [Phased Implementation Plan](#6-phased-implementation-plan)
7. [courthive-components Guidelines](#7-courthive-components-guidelines)
8. [Testing Approach](#8-testing-approach)
9. [Future: CSS Framework Migration](#9-future-css-framework-migration)

---

## 1. Overview & Design Principles

### Bulma-first approach

Bulma 1.0.4 ships native dark mode support. Setting `data-theme="dark"` on the `<html>` element automatically recolors all Bulma classes. TMX currently disables this by importing `bulma-no-dark-mode.min.css`. Switching to the standard `bulma.min.css` gives us the entire Bulma dark palette for free.

### CSS custom properties everywhere

Every hardcoded color — in CSS files, `ensureStyles()` injections, and inline TypeScript — must be replaced with a `var(--tmx-*)` reference. This single abstraction layer lets us flip the entire UI by redefining variables under `[data-theme="dark"]`.

### Progressive enhancement

Each implementation phase is independently shippable. Light mode users see zero changes until the toggle is exposed. Dark mode improves incrementally as phases land.

### No visual regression in light mode

All `--tmx-*` variables default to their current light-mode values. The `:root` (light) definitions are extracted directly from the existing codebase. If no `[data-theme="dark"]` selector matches, nothing changes.

---

## 2. Current State Audit

### Bulma import

**File:** `src/initialState.ts` (line 44)

```typescript
import 'bulma/css/versions/bulma-no-dark-mode.min.css';
```

This explicitly opts out of Bulma's dark mode support. It must change to:

```typescript
import 'bulma/css/bulma.min.css';
```

### Existing CSS custom properties

The codebase already uses a small number of scoped CSS variables:

**Schedule (`--sch-*`)** — `src/styles/tournamentSchedule.css` (lines 2–11):

```css
body {
  --sch-neutral: white;
  --sch-error: #c01a1a;
  --sch-issue: #faa774;
  --sch-conflict: #f5a9a9;
  --sch-warning: lightyellow;
  --sch-complete: #e0ecf8;
  --sch-inprogress: #cef6ce;
  --sch-abandoned: #f7be81;
}
```

**Scoreboard (`--sb-*`)** — `src/styles/legacy/scoreboard.css` (lines 10–17):

```css
body {
  --sb-panel-background: #222;
  --sb-opponent-background: #2f2f2f;
  --sb-info-color: #aaa;
  --sb-options: #333;
  --sb-options-hover: #444;
  --sb-winner-color: #486149;
}
```

**Scoring dropdown (`--dd-*`)** — `src/styles/legacy/ddScoring.css` (lines 7–17):

```css
body {
  --dd-active: gray;
  --dd-active-color: #000;
  --dd-notactive-color: #fff;
  --dd-span-background: #ebebeb;
  --dd-span-hover: #cecece;
  --dd-li-background: #fff;
  --dd-label-color: #000;
  --dd-hasvalue: #2f2f2f;
  --dd-novalue: #fff;
}
```

**Bulma variables in `tmx.css`** — `src/styles/tmx.css` (lines 331–333):

```css
#dnav {
  background-color: var(--bulma-body-background-color);
  color: var(--bulma-body-color);
}
```

The `#dnav` element already references Bulma variables for background/text, which means it will automatically adapt once we switch to the full Bulma build. However, `#dnav a` (line 368) hardcodes `color: #0f0f0f` and the border (line 340) hardcodes `#ddd`.

### Dynamic style injection (`ensureStyles()`)

Five files inject `<style>` elements with hardcoded hex colors at runtime:

| File                                                                 | Style ID                      | Hardcoded colors                                                                            |
| -------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `src/pages/tournaments/welcomeView.ts`                               | `welcome-view-styles`         | `#fff`, `#48c774`, `#3db868`, `#eef4fb`, `#effaf3`, `#555`, `#333`, `#666`                  |
| `src/pages/tournament/tabs/overviewTab/renderOverview.ts`            | `dashboard-responsive-styles` | `#4a90d9`, `#eef4fb`, `#48c774`, `#effaf3`, `#ff6b6b`, `#fef0f0`, `#333`, `#fff`, `#fde8e8` |
| `src/pages/tournament/tabs/settingsTab/renderSettingsTab.ts`         | settings tab styles           | Hardcoded hex values                                                                        |
| `src/pages/tournament/tabs/settingsTab/systemTab/systemTabStyles.ts` | system tab styles             | Hardcoded hex values                                                                        |
| `src/components/tables/bracketTable/createBracketTable.ts`           | bracket table styles          | Hardcoded hex values                                                                        |

### Inline styles in TypeScript

**29 files** set colors directly via `.style.color`, `.style.backgroundColor`, or `.style.cssText`:

**Core UI:**

- `src/components/framework/rootBlock.ts`
- `src/navigation.ts`
- `src/services/authentication/loginState.ts` — conditional colors: `red` / `green` / `blue`
- `src/services/dom/events/teamHighlights.ts` — `#ed0c76`
- `src/pages/tournament/tabs/overviewTab/dashboardPanels.ts` — `#999`, `#666`, `#fff`, `#ccc`
- `src/pages/tournament/tabs/settingsTab/adminGrid.ts`
- `src/components/popovers/tournamentHeader.ts`
- `src/components/modals/tournamentActions.ts`
- `src/components/overlays/editTieFormat.js/editTieFormat.ts`

**Table formatters (Tabulator cell rendering):**

- `src/components/tables/common/formatters/tournamentFormatter.ts`
- `src/components/tables/common/formatters/participantFormatter.ts`
- `src/components/tables/common/formatters/profileFormatter.ts`
- `src/components/tables/common/formatters/ratingFormatter.ts`
- `src/components/tables/common/formatters/scoreFormatter.ts`
- `src/components/tables/common/formatters/visibility.ts`
- `src/components/tables/common/formatters/genderedText.ts`
- `src/components/tables/common/editors/idEditor.ts`
- `src/components/tables/common/editors/numericEditor.ts`
- `src/components/tables/bracketTable/bracketScoreFormatter.ts`

**Table row formatters:**

- `src/components/tables/venuesTable/venueRowFormatter.ts`
- `src/components/tables/venuesTable/getVenueColumns.ts`
- `src/components/tables/venuesTable/getCourtColumns.ts`
- `src/components/tables/tournamentsTable/createTournamentsTable.ts`
- `src/components/tables/unscheduledTable/getUnscheduledColumns.ts`
- `src/components/tables/scheduleTable/updateConflicts.ts`
- `src/components/tables/scheduleTable/getControlColumn.ts`
- `src/components/tables/participantsTable/teamRowFormatter.ts`
- `src/components/tables/eventsTable/eventRowFormatter.ts`

**PDF (special case — always light):**

- `src/services/pdf/utils/drawRenderer.ts`

### Third-party CSS imports

All from `src/initialState.ts` (lines 25–43):

| Library              | Import                                                       | Notes                                    |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| courthive-components | `courthive-components/dist/courthive-components.css`         | Stitches-generated; handled separately   |
| Bulma extensions     | `bulma-checkradio`, `bulma-switch`                           | Should inherit Bulma dark mode           |
| vanillajs-datepicker | `vanillajs-datepicker/css/datepicker-bulma.css`              | Bulma-themed; likely auto-adapts         |
| @event-calendar      | `@event-calendar/core/index.css`                             | Needs dark overrides                     |
| timepicker-ui        | `timepicker-ui/main.css`                                     | Has internal dark theme support          |
| Quill                | `quill/dist/quill.snow.css`                                  | Light-only "snow" theme; needs overrides |
| Pikaday              | `pikaday/css/pikaday.css`                                    | Needs dark overrides                     |
| Tippy.js             | `tippy.js/themes/light-border.css`, `light.css`, `tippy.css` | Light themes; needs dark overrides       |
| Animate.css          | `animate.css/animate.min.css`                                | Animations only; no color impact         |
| Tabulator            | `styles/tabulator.css`                                       | Custom 32KB CSS; ~50 color values        |

### courthive-components theme system

The library uses Stitches with 7 named themes (`australianTheme`, `wimbledonTheme`, `frenchTheme`, `usOpenTheme`, `basicTheme`, `itfTheme`, `nightTheme`). The `nightTheme` is minimal:

```typescript
// courthive-components/src/styles/themes/nightTheme.ts
export const nightTheme = createTheme('dark-theme', {
  colors: {
    backgroundColor: '#333333',
    borderHover: '#0091d2',
    color: 'white',
  },
  participant: {
    seed: 'cyan',
  },
});
```

Missing tokens in `nightTheme`: `matchUp`, `matchUpBackgroundColor`, `winner`, `loser`, `winnerName`, `internalDividers`, `connector`, `border`. These fall back to the base theme's light values (white backgrounds, black text, lightgray dividers), which look wrong on a dark background.

---

## 3. CSS Variable Naming Convention

### TMX application (`--tmx-*`)

```
--tmx-bg-primary          Backgrounds
--tmx-bg-secondary
--tmx-bg-tertiary
--tmx-bg-elevated
--tmx-bg-highlight
--tmx-bg-panel-header

--tmx-text-primary         Text
--tmx-text-secondary
--tmx-text-muted
--tmx-text-inverse

--tmx-border-primary       Borders
--tmx-border-secondary
--tmx-border-focus

--tmx-accent-blue          Brand / accent colors
--tmx-accent-green
--tmx-accent-purple
--tmx-accent-red
--tmx-accent-orange
--tmx-accent-teal

--tmx-status-success       Semantic status
--tmx-status-warning
--tmx-status-error
--tmx-status-info

--tmx-panel-blue-bg        Colored panel backgrounds
--tmx-panel-blue-border
--tmx-panel-green-bg
--tmx-panel-green-border
--tmx-panel-red-bg
--tmx-panel-red-border
--tmx-panel-purple-bg
--tmx-panel-purple-border
--tmx-panel-orange-bg
--tmx-panel-orange-border
--tmx-panel-teal-bg
--tmx-panel-teal-border

--tmx-tab-*                Tabulator-specific (see Phase 3)
```

### Existing prefixes (keep as-is)

- `--sch-*` — schedule cell colors
- `--sb-*` — scoreboard
- `--dd-*` — dropdown scoring

These are already well-scoped. Dark overrides for them go in `theme.css` under `[data-theme="dark"]`.

### courthive-components (`--chc-*`)

For CSS files within the courthive-components library that are _not_ part of the Stitches theme system:

```
--chc-bg                  Component backgrounds
--chc-bg-hover
--chc-text
--chc-border
--chc-shadow
--chc-panel-header-bg
--chc-overlay-bg
```

---

## 4. Complete Color Inventory

### Design decisions

- **Dark palette:** Blue-tinted backgrounds (`#1a1a2e`, `#16213e`) rather than pure grays, for a modern, less harsh feel.
- **Status colors:** Muted/darker variants in dark mode — deeper and less saturated to reduce visual strain while maintaining distinction.
- **Scoreboard:** Already dark-themed. Keep as-is in both modes with minor contrast tweaks.

### Token reference table

#### Backgrounds

| Token                   | Light                | Dark      |
| ----------------------- | -------------------- | --------- |
| `--tmx-bg-primary`      | `#ffffff`            | `#1a1a2e` |
| `--tmx-bg-secondary`    | `#f5f5f5`            | `#16213e` |
| `--tmx-bg-tertiary`     | `#e7e6e7`            | `#0f3460` |
| `--tmx-bg-elevated`     | `#ffffff`            | `#222244` |
| `--tmx-bg-highlight`    | `lightyellow`        | `#3a3a1a` |
| `--tmx-bg-panel-header` | `rgb(192, 193, 211)` | `#2a2a4e` |

#### Text

| Token                  | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--tmx-text-primary`   | `#363636` | `#e0e0e0` |
| `--tmx-text-secondary` | `#666666` | `#b0b0b0` |
| `--tmx-text-muted`     | `#999999` | `#808080` |
| `--tmx-text-inverse`   | `#ffffff` | `#1a1a2e` |

#### Borders

| Token                    | Light     | Dark      |
| ------------------------ | --------- | --------- |
| `--tmx-border-primary`   | `#dbdbdb` | `#444444` |
| `--tmx-border-secondary` | `#e0e0e0` | `#333333` |
| `--tmx-border-focus`     | `#4a90d9` | `#5b9bd5` |

#### Accent colors

| Token                 | Light     | Dark      |
| --------------------- | --------- | --------- |
| `--tmx-accent-blue`   | `#4a90d9` | `#5b9bd5` |
| `--tmx-accent-green`  | `#48c774` | `#5cb878` |
| `--tmx-accent-purple` | `#b86bff` | `#c88aff` |
| `--tmx-accent-red`    | `#ff6b6b` | `#ff8a8a` |
| `--tmx-accent-orange` | `#ff9f43` | `#ffb366` |
| `--tmx-accent-teal`   | `#00b8a9` | `#33c9bb` |

#### Status colors

| Token                  | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--tmx-status-success` | `#48c774` | `#5cb878` |
| `--tmx-status-warning` | `#ffdd57` | `#e6c84e` |
| `--tmx-status-error`   | `#f14668` | `#e85d7a` |
| `--tmx-status-info`    | `#3e8ed0` | `#5ba3d9` |

#### Colored panels (background + border pairs)

| Token                       | Light     | Dark      |
| --------------------------- | --------- | --------- |
| `--tmx-panel-blue-bg`       | `#eef4fb` | `#1a2a4e` |
| `--tmx-panel-blue-border`   | `#4a90d9` | `#5b9bd5` |
| `--tmx-panel-green-bg`      | `#effaf3` | `#1a3a2a` |
| `--tmx-panel-green-border`  | `#48c774` | `#5cb878` |
| `--tmx-panel-red-bg`        | `#fef0f0` | `#3a1a1a` |
| `--tmx-panel-red-border`    | `#ff6b6b` | `#ff8a8a` |
| `--tmx-panel-purple-bg`     | `#f5eeff` | `#2a1a3e` |
| `--tmx-panel-purple-border` | `#b86bff` | `#c88aff` |
| `--tmx-panel-orange-bg`     | `#fff5eb` | `#3a2a1a` |
| `--tmx-panel-orange-border` | `#ff9f43` | `#ffb366` |
| `--tmx-panel-teal-bg`       | `#e6faf8` | `#1a3a38` |
| `--tmx-panel-teal-border`   | `#00b8a9` | `#33c9bb` |

#### Schedule status (`--sch-*` dark overrides)

| Token              | Light         | Dark      |
| ------------------ | ------------- | --------- |
| `--sch-neutral`    | `white`       | `#222244` |
| `--sch-complete`   | `#e0ecf8`     | `#1a3a5c` |
| `--sch-inprogress` | `#cef6ce`     | `#1a4a2a` |
| `--sch-warning`    | `lightyellow` | `#4a3a1a` |
| `--sch-error`      | `#c01a1a`     | `#8b2020` |
| `--sch-conflict`   | `#f5a9a9`     | `#5c2a2a` |
| `--sch-issue`      | `#faa774`     | `#5c3a1a` |
| `--sch-abandoned`  | `#f7be81`     | `#5c4a2a` |

#### Dropdown scoring (`--dd-*` dark overrides)

| Token                  | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--dd-active`          | `gray`    | `#666666` |
| `--dd-active-color`    | `#000`    | `#e0e0e0` |
| `--dd-notactive-color` | `#fff`    | `#1a1a2e` |
| `--dd-span-background` | `#ebebeb` | `#2a2a4e` |
| `--dd-span-hover`      | `#cecece` | `#3a3a5e` |
| `--dd-li-background`   | `#fff`    | `#222244` |
| `--dd-label-color`     | `#000`    | `#e0e0e0` |
| `--dd-hasvalue`        | `#2f2f2f` | `#c0c0c0` |
| `--dd-novalue`         | `#fff`    | `#222244` |

#### Tabulator (`--tmx-tab-*`)

| Token                     | Light     | Dark      |
| ------------------------- | --------- | --------- |
| `--tmx-tab-bg`            | `#ffffff` | `#1a1a2e` |
| `--tmx-tab-header-bg`     | `#f5f5f5` | `#16213e` |
| `--tmx-tab-row-alt-bg`    | `#fafafa` | `#1e1e3a` |
| `--tmx-tab-row-hover-bg`  | `#f0f0f0` | `#222244` |
| `--tmx-tab-text`          | `#363636` | `#e0e0e0` |
| `--tmx-tab-text-muted`    | `#bbbbbb` | `#666666` |
| `--tmx-tab-border`        | `#dbdbdb` | `#444444` |
| `--tmx-tab-selected-bg`   | `#e7e6e7` | `#0f3460` |
| `--tmx-tab-selected-text` | `#363636` | `#ffffff` |

---

## 5. Theme Toggle Mechanism

### Type

```typescript
type ThemePreference = 'light' | 'dark' | 'system';
```

### Settings extension

Add `theme` to the existing `TMXSettings` type in `src/services/settings/settingsStorage.ts`:

```typescript
export type TMXSettings = {
  // ... existing fields ...
  theme?: ThemePreference;
};
```

### Theme service

Create `src/services/theme/themeService.ts`:

```typescript
import { loadSettings, saveSettings } from 'services/settings/settingsStorage';
import { context } from 'services/context';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'tmx_theme'; // Fast-access key for FOIT script

let mediaQuery: MediaQueryList | null = null;

/**
 * Resolve the effective theme from a preference value.
 */
function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

/**
 * Apply the given theme to the DOM.
 * - Sets `data-theme` on <html> (Bulma reads this)
 * - Toggles `tmx-dark` class on <body> (for custom selectors)
 */
export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('tmx-dark', theme === 'dark');

  // Persist for FOIT prevention script
  localStorage.setItem(THEME_STORAGE_KEY, pref);

  // Persist in TMXSettings
  const settings = loadSettings() ?? {};
  settings.theme = pref;
  saveSettings(settings);

  // Notify live components
  context.ee?.emit('THEME_CHANGE', { theme, preference: pref });
}

/**
 * Initialize theme on app startup. Call from setupTMX().
 */
export function initTheme(): void {
  const settings = loadSettings();
  const pref: ThemePreference = settings?.theme ?? 'light';

  applyTheme(pref);

  // Listen for OS preference changes when in 'system' mode
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentPref = loadSettings()?.theme ?? 'light';
    if (currentPref === 'system') {
      applyTheme('system');
    }
  });
}

/**
 * Get the current theme preference.
 */
export function getThemePreference(): ThemePreference {
  return loadSettings()?.theme ?? 'light';
}
```

### FOIT prevention

Add an inline `<script>` in the `<head>` of `index.html`, **before** any CSS loads. This reads localStorage synchronously so the correct `data-theme` is set before the first paint:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- ... existing meta tags ... -->

    <script>
      // FOIT prevention: set theme before CSS loads
      (function () {
        var pref = localStorage.getItem('tmx_theme') || 'light';
        var theme = pref;
        if (pref === 'system') {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') document.body?.classList.add('tmx-dark');
      })();
    </script>

    <title>CourtHive® TMX 3</title>
  </head>
</html>
```

### Move `data-theme` from `#root` to `<html>`

The current `index.html` has `data-theme="light"` on `<div id="root">`. Bulma reads `data-theme` from the `<html>` element, so:

1. Remove `data-theme="light"` from `<div id="root">`.
2. The FOIT script sets it on `<html>`.

### Integration in `setupTMX()`

In `src/initialState.ts`, call `initTheme()` early:

```typescript
import { initTheme } from 'services/theme/themeService';

export function setupTMX(): void {
  const savedSettings = loadSettings();
  // ... existing settings loading ...

  initTheme(); // <-- add here, before setEnv()

  setEnv();
  setWindow();
  // ...
}
```

### Toggle UI

**Settings tab:** Add a "Theme" row in the settings panel with three options (Light / Dark / System), using Bulma radio buttons or a segmented control. Call `applyTheme(selectedPreference)` on change.

**Quick toggle (optional):** Add a sun/moon icon button in `#dnav` that cycles through Light → Dark → System → Light. This is a convenience shortcut; the Settings tab is the primary control.

### Event system

Components that render colors dynamically can listen for changes:

```typescript
context.ee.on('THEME_CHANGE', ({ theme }) => {
  // re-render or update inline styles
});
```

---

## 6. Phased Implementation Plan

### Phase 1: Foundation

**Goal:** Enable Bulma dark mode, define all CSS variables, wire up the toggle.

**Steps:**

1. **Switch Bulma import** in `src/initialState.ts` (line 44):

   ```diff
   - import 'bulma/css/versions/bulma-no-dark-mode.min.css';
   + import 'bulma/css/bulma.min.css';
   ```

2. **Move `data-theme`** from `<div id="root">` to `<html>` in `index.html`:

   ```diff
   - <div id="root" data-theme="light"></div>
   + <div id="root"></div>
   ```

3. **Create `src/styles/theme.css`** with all variable definitions:

   ```css
   /* ===== Light theme (default) ===== */
   :root {
     /* Backgrounds */
     --tmx-bg-primary: #ffffff;
     --tmx-bg-secondary: #f5f5f5;
     --tmx-bg-tertiary: #e7e6e7;
     --tmx-bg-elevated: #ffffff;
     --tmx-bg-highlight: lightyellow;
     --tmx-bg-panel-header: rgb(192, 193, 211);

     /* Text */
     --tmx-text-primary: #363636;
     --tmx-text-secondary: #666666;
     --tmx-text-muted: #999999;
     --tmx-text-inverse: #ffffff;

     /* Borders */
     --tmx-border-primary: #dbdbdb;
     --tmx-border-secondary: #e0e0e0;
     --tmx-border-focus: #4a90d9;

     /* Accents */
     --tmx-accent-blue: #4a90d9;
     --tmx-accent-green: #48c774;
     --tmx-accent-purple: #b86bff;
     --tmx-accent-red: #ff6b6b;
     --tmx-accent-orange: #ff9f43;
     --tmx-accent-teal: #00b8a9;

     /* Status */
     --tmx-status-success: #48c774;
     --tmx-status-warning: #ffdd57;
     --tmx-status-error: #f14668;
     --tmx-status-info: #3e8ed0;

     /* Panels */
     --tmx-panel-blue-bg: #eef4fb;
     --tmx-panel-blue-border: #4a90d9;
     --tmx-panel-green-bg: #effaf3;
     --tmx-panel-green-border: #48c774;
     --tmx-panel-red-bg: #fef0f0;
     --tmx-panel-red-border: #ff6b6b;
     --tmx-panel-purple-bg: #f5eeff;
     --tmx-panel-purple-border: #b86bff;
     --tmx-panel-orange-bg: #fff5eb;
     --tmx-panel-orange-border: #ff9f43;
     --tmx-panel-teal-bg: #e6faf8;
     --tmx-panel-teal-border: #00b8a9;

     /* Tabulator */
     --tmx-tab-bg: #ffffff;
     --tmx-tab-header-bg: #f5f5f5;
     --tmx-tab-row-alt-bg: #fafafa;
     --tmx-tab-row-hover-bg: #f0f0f0;
     --tmx-tab-text: #363636;
     --tmx-tab-text-muted: #bbbbbb;
     --tmx-tab-border: #dbdbdb;
     --tmx-tab-selected-bg: #e7e6e7;
     --tmx-tab-selected-text: #363636;
   }

   /* ===== Dark theme ===== */
   [data-theme='dark'] {
     /* Backgrounds */
     --tmx-bg-primary: #1a1a2e;
     --tmx-bg-secondary: #16213e;
     --tmx-bg-tertiary: #0f3460;
     --tmx-bg-elevated: #222244;
     --tmx-bg-highlight: #3a3a1a;
     --tmx-bg-panel-header: #2a2a4e;

     /* Text */
     --tmx-text-primary: #e0e0e0;
     --tmx-text-secondary: #b0b0b0;
     --tmx-text-muted: #808080;
     --tmx-text-inverse: #1a1a2e;

     /* Borders */
     --tmx-border-primary: #444444;
     --tmx-border-secondary: #333333;
     --tmx-border-focus: #5b9bd5;

     /* Accents */
     --tmx-accent-blue: #5b9bd5;
     --tmx-accent-green: #5cb878;
     --tmx-accent-purple: #c88aff;
     --tmx-accent-red: #ff8a8a;
     --tmx-accent-orange: #ffb366;
     --tmx-accent-teal: #33c9bb;

     /* Status */
     --tmx-status-success: #5cb878;
     --tmx-status-warning: #e6c84e;
     --tmx-status-error: #e85d7a;
     --tmx-status-info: #5ba3d9;

     /* Panels */
     --tmx-panel-blue-bg: #1a2a4e;
     --tmx-panel-blue-border: #5b9bd5;
     --tmx-panel-green-bg: #1a3a2a;
     --tmx-panel-green-border: #5cb878;
     --tmx-panel-red-bg: #3a1a1a;
     --tmx-panel-red-border: #ff8a8a;
     --tmx-panel-purple-bg: #2a1a3e;
     --tmx-panel-purple-border: #c88aff;
     --tmx-panel-orange-bg: #3a2a1a;
     --tmx-panel-orange-border: #ffb366;
     --tmx-panel-teal-bg: #1a3a38;
     --tmx-panel-teal-border: #33c9bb;

     /* Tabulator */
     --tmx-tab-bg: #1a1a2e;
     --tmx-tab-header-bg: #16213e;
     --tmx-tab-row-alt-bg: #1e1e3a;
     --tmx-tab-row-hover-bg: #222244;
     --tmx-tab-text: #e0e0e0;
     --tmx-tab-text-muted: #666666;
     --tmx-tab-border: #444444;
     --tmx-tab-selected-bg: #0f3460;
     --tmx-tab-selected-text: #ffffff;

     /* Schedule overrides */
     --sch-neutral: #222244;
     --sch-complete: #1a3a5c;
     --sch-inprogress: #1a4a2a;
     --sch-warning: #4a3a1a;
     --sch-error: #8b2020;
     --sch-conflict: #5c2a2a;
     --sch-issue: #5c3a1a;
     --sch-abandoned: #5c4a2a;

     /* Dropdown scoring overrides */
     --dd-active: #666666;
     --dd-active-color: #e0e0e0;
     --dd-notactive-color: #1a1a2e;
     --dd-span-background: #2a2a4e;
     --dd-span-hover: #3a3a5e;
     --dd-li-background: #222244;
     --dd-label-color: #e0e0e0;
     --dd-hasvalue: #c0c0c0;
     --dd-novalue: #222244;
   }
   ```

4. **Create `src/services/theme/themeService.ts`** (see [Section 5](#5-theme-toggle-mechanism)).

5. **Extend `TMXSettings`** with `theme?: ThemePreference` in `src/services/settings/settingsStorage.ts`.

6. **Add FOIT prevention script** to `index.html` `<head>`.

7. **Import `theme.css`** in `src/initialState.ts` (before other custom CSS):

   ```typescript
   import 'styles/theme.css';
   ```

8. **Call `initTheme()`** in `setupTMX()`.

**Verification:** `pnpm run build` passes. Light mode looks identical. Setting `data-theme="dark"` on `<html>` in DevTools shows Bulma elements in dark mode (even if custom elements are still light).

---

### Phase 2: Core Shell

**Goal:** Convert the main app shell CSS to use variables.

**Files:**

1. **`src/styles/tmx.css`** — Replace hardcoded colors with `var(--tmx-*)`:

   ```css
   /* Before */
   #dnav {
     border-bottom: 1px solid #ddd;
   }
   #dnav a {
     color: #0f0f0f;
   }

   /* After */
   #dnav {
     border-bottom: 1px solid var(--tmx-border-primary);
   }
   #dnav a {
     color: var(--tmx-text-primary);
   }
   ```

2. **`src/styles/overlay.css`** — Modal backgrounds, text, borders.

3. **`src/styles/drawer.css`** — Drawer panel backgrounds and borders.

4. **`src/styles/dropzone.css`** — File upload zone styling.

5. **`src/styles/tournamentContainer.css`** — Container backgrounds.

**Approach:** For each file, search for hardcoded hex values (`#fff`, `#000`, `#363636`, `#ddd`, `#dbdbdb`, etc.) and `rgb()`/`rgba()` values. Replace each with the closest `var(--tmx-*)` token.

---

### Phase 3: Tables & Schedule

**Goal:** Theme Tabulator tables and the schedule grid.

**Steps:**

1. **Convert `src/styles/tabulator.css`** (~50 color values):
   - Replace background colors with `var(--tmx-tab-bg)`, `var(--tmx-tab-header-bg)`, etc.
   - Replace text colors with `var(--tmx-tab-text)`.
   - Replace border colors with `var(--tmx-tab-border)`.
   - Example:

     ```css
     /* Before */
     .tabulator {
       background-color: #fff;
       color: #363636;
     }
     .tabulator-header {
       background-color: #f5f5f5;
       border-bottom: 1px solid #dbdbdb;
     }

     /* After */
     .tabulator {
       background-color: var(--tmx-tab-bg);
       color: var(--tmx-tab-text);
     }
     .tabulator-header {
       background-color: var(--tmx-tab-header-bg);
       border-bottom: 1px solid var(--tmx-tab-border);
     }
     ```

2. **Convert `src/styles/tournamentSchedule.css`** remaining hardcoded values:
   - Line 19: `border-right: 1px solid #dbdbdb` → `var(--tmx-tab-border)`
   - The `--sch-*` variables are already defined; dark overrides are in `theme.css`.

3. **Test schedule grid** in both themes — confirm cell status colors are visible and distinguishable.

---

### Phase 4: Dynamic Styles

**Goal:** Convert `ensureStyles()` functions to use CSS variables instead of hardcoded hex.

**Files and approach:**

1. **`src/pages/tournaments/welcomeView.ts`** — Replace hardcoded colors in the injected `<style>` string:

   ```typescript
   // Before
   background-color: #eef4fb;
   // After
   background-color: var(--tmx-panel-blue-bg);
   ```

2. **`src/pages/tournament/tabs/overviewTab/renderOverview.ts`** — Dashboard panel styles:

   ```typescript
   // Before
   border-left: 4px solid #4a90d9;
   background: #eef4fb;
   color: #333;
   // After
   border-left: 4px solid var(--tmx-panel-blue-border);
   background: var(--tmx-panel-blue-bg);
   color: var(--tmx-text-primary);
   ```

3. **`src/pages/tournament/tabs/settingsTab/renderSettingsTab.ts`** — Settings panel styles.

4. **`src/pages/tournament/tabs/settingsTab/systemTab/systemTabStyles.ts`** — System tab styles.

5. **`src/components/tables/bracketTable/createBracketTable.ts`** — Bracket table styles.

**Pattern:** In each `ensureStyles()` function, find every hex value and replace it with `var(--tmx-*)`. Because these CSS strings are injected into the DOM, they automatically pick up the current variable values.

---

### Phase 5: Third-Party Libraries

**Goal:** Add dark mode overrides for third-party component CSS.

All overrides go in `src/styles/theme.css` (or a dedicated `src/styles/vendor-dark.css` imported after the vendor CSS).

#### Quill (snow theme)

```css
[data-theme='dark'] .ql-toolbar {
  background-color: var(--tmx-bg-secondary);
  border-color: var(--tmx-border-primary);
}
[data-theme='dark'] .ql-container {
  background-color: var(--tmx-bg-primary);
  border-color: var(--tmx-border-primary);
  color: var(--tmx-text-primary);
}
[data-theme='dark'] .ql-editor.ql-blank::before {
  color: var(--tmx-text-muted);
}
/* Toolbar SVG icons — invert stroke/fill */
[data-theme='dark'] .ql-toolbar .ql-stroke {
  stroke: var(--tmx-text-primary);
}
[data-theme='dark'] .ql-toolbar .ql-fill {
  fill: var(--tmx-text-primary);
}
[data-theme='dark'] .ql-toolbar .ql-picker-label {
  color: var(--tmx-text-primary);
}
```

#### Tippy.js

```css
[data-theme='dark'] .tippy-box[data-theme~='light-border'] {
  background-color: var(--tmx-bg-elevated);
  color: var(--tmx-text-primary);
  border-color: var(--tmx-border-primary);
}
[data-theme='dark'] .tippy-box[data-theme~='light-border'] .tippy-arrow::before {
  border-top-color: var(--tmx-border-primary);
}
[data-theme='dark'] .tippy-box[data-theme~='light-border'] .tippy-arrow::after {
  border-top-color: var(--tmx-bg-elevated);
}
```

#### Tipster (custom tooltip)

```css
/* src/styles/tipster.css — add dark overrides */
[data-theme='dark'] .tipster-content {
  background-color: var(--tmx-bg-elevated);
  color: var(--tmx-text-primary);
  border-color: var(--tmx-border-primary);
}
```

#### vanillajs-datepicker

Uses `datepicker-bulma.css` which inherits Bulma variables. **Likely auto-adapts** when we switch to full Bulma. Test and add overrides only if needed.

#### @event-calendar

```css
[data-theme='dark'] .ec {
  --ec-bg-color: var(--tmx-bg-primary);
  --ec-text-color: var(--tmx-text-primary);
  --ec-border-color: var(--tmx-border-primary);
  --ec-active-bg-color: var(--tmx-accent-blue);
}
```

#### Pikaday

```css
[data-theme='dark'] .pika-single {
  background: var(--tmx-bg-elevated);
  border-color: var(--tmx-border-primary);
  color: var(--tmx-text-primary);
}
[data-theme='dark'] .pika-title {
  background: var(--tmx-bg-secondary);
  color: var(--tmx-text-primary);
}
[data-theme='dark'] .pika-button {
  color: var(--tmx-text-primary);
  background: transparent;
}
[data-theme='dark'] .pika-button:hover {
  background: var(--tmx-bg-tertiary);
  color: var(--tmx-text-primary);
}
```

---

### Phase 6: Inline Styles

**Goal:** Replace hardcoded color values in ~29 TypeScript files that set colors via `.style.*` or inline `style=""` strings.

#### Create theme color constants

Create `src/services/theme/themeColors.ts`:

```typescript
/**
 * CSS variable references for use in inline styles.
 * Each value is a `var(--tmx-*)` string that resolves at runtime.
 *
 * Usage:
 *   element.style.color = THEME.textPrimary;
 *   element.style.backgroundColor = THEME.bgElevated;
 */
export const THEME = {
  // Backgrounds
  bgPrimary: 'var(--tmx-bg-primary)',
  bgSecondary: 'var(--tmx-bg-secondary)',
  bgTertiary: 'var(--tmx-bg-tertiary)',
  bgElevated: 'var(--tmx-bg-elevated)',
  bgHighlight: 'var(--tmx-bg-highlight)',
  bgPanelHeader: 'var(--tmx-bg-panel-header)',

  // Text
  textPrimary: 'var(--tmx-text-primary)',
  textSecondary: 'var(--tmx-text-secondary)',
  textMuted: 'var(--tmx-text-muted)',
  textInverse: 'var(--tmx-text-inverse)',

  // Borders
  borderPrimary: 'var(--tmx-border-primary)',
  borderSecondary: 'var(--tmx-border-secondary)',
  borderFocus: 'var(--tmx-border-focus)',

  // Accents
  accentBlue: 'var(--tmx-accent-blue)',
  accentGreen: 'var(--tmx-accent-green)',
  accentPurple: 'var(--tmx-accent-purple)',
  accentRed: 'var(--tmx-accent-red)',
  accentOrange: 'var(--tmx-accent-orange)',
  accentTeal: 'var(--tmx-accent-teal)',

  // Status
  statusSuccess: 'var(--tmx-status-success)',
  statusWarning: 'var(--tmx-status-warning)',
  statusError: 'var(--tmx-status-error)',
  statusInfo: 'var(--tmx-status-info)',

  // Panels
  panelBlueBg: 'var(--tmx-panel-blue-bg)',
  panelBlueBorder: 'var(--tmx-panel-blue-border)',
  panelGreenBg: 'var(--tmx-panel-green-bg)',
  panelGreenBorder: 'var(--tmx-panel-green-border)',
  panelRedBg: 'var(--tmx-panel-red-bg)',
  panelRedBorder: 'var(--tmx-panel-red-border)',
} as const;
```

#### Migration examples

```typescript
// Before (dashboardPanels.ts)
el.style.cssText = 'text-align:center; color:#999; padding:24px;';

// After
import { THEME } from 'services/theme/themeColors';
el.style.cssText = `text-align:center; color:${THEME.textMuted}; padding:24px;`;
```

```typescript
// Before (teamHighlights.ts)
team.style.color = '#ed0c76';

// After — accent highlight (keep as accent, or add --tmx-accent-pink)
team.style.color = THEME.accentRed; // or add a dedicated token
```

```typescript
// Before (loginState.ts)
el.style.color = (impersonating && 'red') || (admin && 'green') || 'blue';

// After
el.style.color = (impersonating && THEME.accentRed) || (admin && THEME.accentGreen) || THEME.accentBlue;
```

#### Priority migration order

1. **Dashboard panels** (`dashboardPanels.ts`) — most visible, many colors
2. **Table formatters** (`src/components/tables/common/formatters/*.ts`) — affect every table
3. **Table row formatters** (`venueRowFormatter.ts`, `teamRowFormatter.ts`, `eventRowFormatter.ts`)
4. **Schedule tables** (`updateConflicts.ts`, `getControlColumn.ts`, `getUnscheduledColumns.ts`)
5. **Bracket formatters** (`bracketScoreFormatter.ts`)
6. **Editors** (`idEditor.ts`, `numericEditor.ts`)
7. **Navigation & auth** (`navigation.ts`, `loginState.ts`, `rootBlock.ts`)
8. **Modals & overlays** (`tournamentActions.ts`, `editTieFormat.ts`, `tournamentHeader.ts`)
9. **Admin** (`adminGrid.ts`)

#### Special case: PDF export

`src/services/pdf/utils/drawRenderer.ts` renders to PDF. **Do not convert this file.** PDF output should always use light-theme colors regardless of the current UI theme. Add a comment:

```typescript
// NOTE: PDF rendering always uses light colors (not theme variables).
// Do not convert these to var(--tmx-*).
```

---

### Phase 7: Legacy & Remaining

#### `src/styles/legacy/scoreboard.css`

The scoreboard is intentionally dark in both themes — it represents a physical scoreboard. **Keep the current dark styling.** Minor adjustments for dark mode:

- Ensure sufficient contrast between `--sb-panel-background: #222` and surrounding dark background (`#1a1a2e`).
- Consider a subtle border: `border: 1px solid var(--tmx-border-secondary)` on `.scoreboard` when in dark mode.

```css
[data-theme='dark'] .scoreboard {
  border: 1px solid var(--tmx-border-secondary);
}
```

#### `src/styles/legacy/ddScoring.css`

Dark `--dd-*` overrides are already defined in `theme.css` (Phase 1). No additional work needed unless visual testing reveals issues.

#### BurstChart SVG text colors

The `burstChart` in courthive-components hardcodes text colors:

```typescript
// burstChart.ts (lines 475, 482)
.attr('fill', '#333')   // center title
.attr('fill', '#666')   // secondary text
```

**Solution:** Add `textColor` and `secondaryTextColor` options to `BurstChartOptions`:

```typescript
interface BurstChartOptions {
  width: number;
  height: number;
  eventHandlers?: { ... };
  textColor?: string;        // default: '#333'
  secondaryTextColor?: string; // default: '#666'
}
```

In TMX, pass theme-aware values:

```typescript
burstChart({
  width: 500,
  height: 500,
  eventHandlers,
  textColor: 'var(--tmx-text-primary)', // or getComputedStyle value
  secondaryTextColor: 'var(--tmx-text-secondary)',
}).render(chartDiv, fromFactoryDrawData(drawData), title);
```

> **Note:** D3 `.attr('fill', ...)` sets an SVG attribute, not a CSS property. CSS `var()` works in SVG `fill` attributes in modern browsers (Chrome 49+, Firefox 31+, Safari 9.1+). If browser support is a concern, use `getComputedStyle(document.documentElement).getPropertyValue('--tmx-text-primary')` to resolve the value first.

#### `src/styles/tipster.css`

Add dark overrides as shown in Phase 5 Tipster section.

---

## 7. courthive-components Guidelines

These rules apply to **all current and future development** in the courthive-components library.

### Expand `nightTheme`

The current `nightTheme` only defines 4 tokens. Add all missing tokens:

```typescript
export const nightTheme = createTheme('dark-theme', {
  colors: {
    backgroundColor: '#1a1a2e',
    borderHover: '#5b9bd5',
    color: '#e0e0e0',
    internalDividers: '#444444',
    connector: '#555555',
    border: '#444444',
    matchUp: '#222244',
    matchUpBackgroundColor: '#222244',
    winner: '#5cb878',
    loser: '#ff8a8a',
    winnerName: '#5cb878',
  },
  participant: {
    seed: 'cyan',
  },
});
```

### Additional Stitches tokens to add

The base theme (`createTheme.ts`) should be extended with these tokens so all themes can override them:

| Token                      | Purpose                           | Default (light) |
| -------------------------- | --------------------------------- | --------------- |
| `colors.secondaryColor`    | Secondary text in components      | `#666666`       |
| `colors.mutedColor`        | Muted/disabled text               | `#999999`       |
| `colors.scorePlaceholder`  | Placeholder text for empty scores | `#bbbbbb`       |
| `colors.highlightBg`       | Highlighted row/cell background   | `#ffffcc`       |
| `colors.borderInlineStart` | Left border accent on matchups    | `#4a90d9`       |

### Rules for new components

1. **Never hardcode colors in Stitches styles** — always use `$colors$*` tokens.

   ```typescript
   // BAD
   const MyComponent = styled('div', { color: '#333' });

   // GOOD
   const MyComponent = styled('div', { color: '$color' });
   ```

2. **Never hardcode colors in CSS files** — use CSS custom properties with `--chc-*` prefix.

   ```css
   /* BAD */
   .my-component {
     background: #fff;
   }

   /* GOOD */
   :root {
     --chc-my-component-bg: #fff;
   }
   .my-component {
     background: var(--chc-my-component-bg);
   }
   ```

3. **D3 charts must accept color options** — no embedded color literals. All D3 components (`burstChart`, `barChart`, `timeSeries`) should accept a colors/theme options object. Hardcoded palettes should be defaults that can be overridden.

   ```typescript
   interface ChartColors {
     textColor?: string;
     secondaryTextColor?: string;
     strokeColor?: string;
     // ...
   }
   ```

4. **Storybook: apply `nightTheme` when dark background is selected** — update `.storybook/preview.ts`:

   ```typescript
   import { nightTheme } from '../src/styles/themes/nightTheme';

   const preview: Preview = {
     parameters: {
       backgrounds: {
         default: 'light',
         values: [
           { name: 'light', value: '#ffffff' },
           { name: 'dark', value: '#1a1a2e' },
         ],
       },
     },
     decorators: [
       (storyFn, context) => {
         const bg = context.globals.backgrounds?.value;
         if (bg === '#1a1a2e') {
           document.documentElement.setAttribute('data-theme', 'dark');
           // Apply nightTheme class if using Stitches
         } else {
           document.documentElement.setAttribute('data-theme', 'light');
         }
         return storyFn();
       },
     ],
   };
   ```

5. **Test every component in both themes** — add to the component PR checklist.

### CSS files to migrate to `--chc-*` variables

These CSS files in courthive-components contain hardcoded colors and should be migrated:

| File                                         | Key hardcoded colors                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `src/components/drawer/drawer.css`           | `#000`, `#fff`, `#ddd`, `#777`                                   |
| `src/components/controlBar/controlBar.css`   | `rgb(192 193 211)`, `#dbdbdb`                                    |
| `src/components/forms/checkradio.css`        | `#dbdbdb`, `#00d1b2`, `#48c78e`, `#f14668`, `#363636`, `#f5f5f5` |
| `src/components/temporal-grid/ui/styles.css` | `#fff`, `#e0e0e0`, `#f8f9fa`, `#ddd`, `#218d8d`, many more       |
| `src/styles/tabulator.css`                   | `#363636`, `#bbb`, `#ccc`                                        |
| `src/styles/accessibility.css`               | `#ffffff`, `#363636`, `#7a7a7a`, `#0066cc`                       |
| `src/styles/tipster.css`                     | tooltip colors                                                   |
| `src/styles/tippy.css`                       | tooltip colors                                                   |
| `src/styles/participantAssignment.css`       | `#666`                                                           |

### Stitches style files with hardcoded colors

These TypeScript style files use hardcoded color literals instead of theme tokens:

| File                             | Hardcoded values           |
| -------------------------------- | -------------------------- |
| `src/styles/getChevronStyle.ts`  | `#008f70` (winner chevron) |
| `src/styles/getLinkStyle.ts`     | `#999` (connector lines)   |
| `src/styles/participantStyle.ts` | `#55AFFE` (blue text)      |
| `src/styles/pillStyle.ts`        | Many status pill colors    |
| `src/styles/resultStyles.ts`     | `#fff`, `#bbb`             |
| `src/styles/schedulingStyle.ts`  | `#F8F9F9`, `#7F8080`       |

All should be migrated to use `$colors$*` theme tokens.

### Type system

Add a `ThemeColors` interface to the public API for passing color options to D3 components:

```typescript
export interface ThemeColors {
  textColor?: string;
  secondaryTextColor?: string;
  strokeColor?: string;
  backgroundColor?: string;
  accentColor?: string;
}
```

Export from the package entry point so TMX can pass theme-aware colors.

---

## 8. Testing Approach

### Manual checklist

Test every page and feature in **both** light and dark themes:

- [ ] Tournaments list (welcome view)
- [ ] Tournament overview (dashboard panels, sunburst chart)
- [ ] Participants tab (tables, row formatters, team highlighting)
- [ ] Events tab (event tables, draw views, bracket tables)
- [ ] Schedule tab (grid, cell colors, conflict highlighting, drag-and-drop)
- [ ] Venues tab (venue/court tables)
- [ ] Settings tab (all sections, theme toggle itself)
- [ ] Scoring (scoreboard, dropdown scoring)
- [ ] Modals (all modal types)
- [ ] Drawer (navigation drawer)
- [ ] Toasts / notifications
- [ ] Tooltips (Tippy, Tipster)
- [ ] Datepicker (vanillajs-datepicker, Pikaday)
- [ ] Quill rich text editor
- [ ] Event calendar
- [ ] PDF export (should always render in light theme)
- [ ] Login/auth state indicators
- [ ] Admin page

### WCAG AA contrast verification

Minimum contrast ratios (WCAG 2.1 Level AA):

- **4.5:1** for normal text (< 18pt or < 14pt bold)
- **3:1** for large text (≥ 18pt or ≥ 14pt bold) and UI components

Verify these token pairings in dark mode:

| Text token                         | Background token                 | Target ratio            |
| ---------------------------------- | -------------------------------- | ----------------------- |
| `--tmx-text-primary` (`#e0e0e0`)   | `--tmx-bg-primary` (`#1a1a2e`)   | ≥ 4.5:1                 |
| `--tmx-text-secondary` (`#b0b0b0`) | `--tmx-bg-primary` (`#1a1a2e`)   | ≥ 4.5:1                 |
| `--tmx-text-muted` (`#808080`)     | `--tmx-bg-primary` (`#1a1a2e`)   | ≥ 3:1 (large text only) |
| `--tmx-text-primary` (`#e0e0e0`)   | `--tmx-bg-elevated` (`#222244`)  | ≥ 4.5:1                 |
| `--tmx-text-primary` (`#e0e0e0`)   | `--tmx-bg-secondary` (`#16213e`) | ≥ 4.5:1                 |

Use browser DevTools (Chrome: Inspect element → Color picker → Contrast ratio) or tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

### Theme transition testing

- [ ] Toggle theme while on each page — no stale colors or flash
- [ ] Toggle from light → dark → system → light — all transitions clean
- [ ] Change OS preference while in "system" mode — UI updates live
- [ ] Reload page with dark theme saved — no flash of light theme (FOIT test)
- [ ] Open app in new tab with dark theme saved — correct from first paint

### FOIT verification

1. Set theme to dark
2. Hard-reload the page (Cmd+Shift+R)
3. Verify: no white flash before dark background appears
4. Test on throttled network (DevTools → Network → Slow 3G)

### CI check

Add a build-time grep to catch regressions — new hardcoded hex colors outside `theme.css`:

```bash
# Example: find hardcoded hex colors in CSS files (excluding theme.css and vendor files)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/styles/ \
  --include='*.css' \
  --exclude='theme.css' \
  --exclude='fa.min.css' \
  --exclude='vendor-dark.css' \
  | grep -v '^\s*//' \
  | grep -v 'var('
```

For TypeScript files, check for new inline color assignments:

```bash
grep -rn "style\.\(color\|background\|backgroundColor\)\s*=\s*['\"]#" src/ \
  --include='*.ts' \
  --exclude-dir='pdf'
```

---

## 9. Future: CSS Framework Migration

This section is **separate from the dark mode implementation** — it documents the long-term migration path for the CSS architecture.

### Stitches → Vanilla Extract (courthive-components)

**Current state:** Stitches (`@stitches/core`) powers the component theme system. Last publish: January 2023. The library is unmaintained but stable.

**Target:** [Vanilla Extract](https://vanilla-extract.style/) — type-safe, zero-runtime CSS-in-TS. Works naturally with vanilla TypeScript + Vite (no React dependency). Supports themes via `createTheme()` with full TypeScript inference.

**When to migrate:** When Stitches causes friction (build issues, incompatibility with newer tooling, missing features). Do not migrate proactively — the current system works.

**Migration path:**

1. Map Stitches `createTheme()` → Vanilla Extract `createTheme()`
2. Map `styled()` calls → Vanilla Extract `style()` + `recipe()`
3. Theme tokens map 1:1; variable naming stays the same
4. CSS files already using `--chc-*` variables need no changes

### Bulma → Tailwind CSS (TMX)

**Current state:** Bulma 1.0.4 provides the UI component library (modals, buttons, forms, tabs, navbar). Custom CSS in `tmx.css` and other files extends it.

**Target:** [Tailwind CSS](https://tailwindcss.com/) — utility-first CSS framework. Works well with vanilla TypeScript DOM manipulation (no JSX required). Reduces the custom CSS surface area significantly.

**When to migrate:** After dark mode is stable. Bulma works well but the custom CSS layer is large (~800 lines in `tmx.css` alone). Tailwind would eliminate most of it.

**Migration path:**

1. Install Tailwind alongside Bulma (they can coexist)
2. Migrate page-by-page, replacing Bulma classes + custom CSS with Tailwind utilities
3. Configure Tailwind's `darkMode: 'selector'` to use `[data-theme="dark"]`
4. Map `--tmx-*` variables to Tailwind's `theme.extend.colors` config
5. Remove Bulma when no classes remain

### Key principle

The `--tmx-*` CSS variable system created for dark mode is **framework-agnostic**. It works with Bulma, Tailwind, Vanilla Extract, or plain CSS. The investment in defining and using these variables is not throwaway work — it will survive either migration and continue to power theme switching regardless of the underlying CSS framework.
