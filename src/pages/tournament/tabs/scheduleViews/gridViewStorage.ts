import { isCheckInPromptMode, DEFAULT_CHECK_IN_PROMPT_MODE } from 'services/checkIn/checkInPromptMode';

// constants and types
import type { CheckInPromptMode } from 'services/checkIn/checkInPromptMode';

const CHECK_IN_PROMPT_MODE_KEY = 'tmx.schedule.checkInPromptMode';

/**
 * `gridView.ts` persists six pieces of view state across page reloads via
 * `localStorage` (plus the Scheduled panel's collapsed groups, held in memory for the tournament
 * visit; see below):
 *
 *   - which sidebar tab the operator was last on (Unscheduled / Scheduled)
 *   - the Scheduled-panel search query
 *   - the Scheduled-panel group-by axis (event / draw / round / structure)
 *   - the Scheduled-panel filter selections (a `CatalogFilters` shape)
 *   - whether the Inspector panel is shown (global to the matchUp catalog —
 *     one flag for BOTH the Unscheduled and Scheduled views, because it is a
 *     property of the catalog surface rather than of either tab)
 *   - whether warning-severity scheduling issues decorate their grid cells
 *
 * All six read / write pairs share a common contract: writes wrap
 * `localStorage` in a `try { … } catch {}` so a sandboxed iframe (or
 * Storage-blocked browser) silently no-ops; reads return a sane default on
 * the same exception path so the UI always boots into a valid state.
 *
 * The adapters are pure aside from their `localStorage` interaction —
 * extracted from the gridView module so unit tests can stub
 * `globalThis.localStorage` and exercise round-trips + default / malformed
 * paths without dragging in the rest of the schedule grid.
 */

import type {
  CatalogFilters,
  MatchUpCatalogGroupBy,
  InspectorGeometry,
  InspectorPlacement,
} from 'courthive-components';

export type SidebarTab = 'unscheduled' | 'scheduled';

const SIDEBAR_TAB_KEY = 'schedule2:sidebar-tab';
const SCHEDULED_SEARCH_KEY = 'schedule2:scheduled-search';
const SCHEDULED_GROUPBY_KEY = 'schedule2:scheduled-groupby';
const SCHEDULED_FILTERS_KEY = 'schedule2:scheduled-filters';
const INSPECTOR_VISIBLE_KEY = 'schedule2:inspector-visible';
const GRID_WARNING_BARS_KEY = 'schedule2:grid-warning-bars';

const VALID_GROUPBY: MatchUpCatalogGroupBy[] = ['event', 'draw', 'round', 'structure', 'time'];

// ── Sidebar tab ──

export function readSidebarTab(): SidebarTab {
  try {
    return localStorage.getItem(SIDEBAR_TAB_KEY) === 'scheduled' ? 'scheduled' : 'unscheduled';
  } catch {
    return 'unscheduled';
  }
}

export function writeSidebarTab(tab: SidebarTab): void {
  try {
    localStorage.setItem(SIDEBAR_TAB_KEY, tab);
  } catch {
    // storage unavailable
  }
}

// ── Scheduled-panel search ──

export function readScheduledSearch(): string {
  try {
    return localStorage.getItem(SCHEDULED_SEARCH_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeScheduledSearch(value: string): void {
  try {
    if (value) localStorage.setItem(SCHEDULED_SEARCH_KEY, value);
    else localStorage.removeItem(SCHEDULED_SEARCH_KEY);
  } catch {
    // storage unavailable
  }
}

// ── Scheduled-panel group-by ──

export function readScheduledGroupBy(): MatchUpCatalogGroupBy {
  try {
    const v = localStorage.getItem(SCHEDULED_GROUPBY_KEY);
    return VALID_GROUPBY.includes(v as MatchUpCatalogGroupBy) ? (v as MatchUpCatalogGroupBy) : 'event';
  } catch {
    return 'event';
  }
}

export function writeScheduledGroupBy(value: MatchUpCatalogGroupBy): void {
  try {
    localStorage.setItem(SCHEDULED_GROUPBY_KEY, value);
  } catch {
    // storage unavailable
  }
}

/**
 * A tournament load starts a fresh catalog session: filters, search and collapsed groups go; layout
 * preferences remain intact. (The Unscheduled catalog's equivalents live in
 * `context.scheduleCatalogState`, cleared beside this call in `tournamentDisplay.ts`.)
 */
export function resetScheduledCatalogFilters(): void {
  writeScheduledFilters({});
  writeScheduledSearch('');
  scheduledCollapsedSession = undefined;
}

// ── Scheduled-panel collapsed groups ──

/**
 * Held in memory, not localStorage: it is per tournament visit. It survives leaving the schedule page
 * and coming back (the panel is rebuilt on every mount), is cleared by the reset above when a
 * tournament is loaded, and goes with the page. Keyed by the group-by it was collected under, because
 * a group key means something different in each mode.
 */
let scheduledCollapsedSession: { groupBy: MatchUpCatalogGroupBy; keys: string[] } | undefined;

export function readScheduledCollapsedGroups(groupBy: MatchUpCatalogGroupBy): string[] {
  return scheduledCollapsedSession?.groupBy === groupBy ? [...scheduledCollapsedSession.keys] : [];
}

export function writeScheduledCollapsedGroups(groupBy: MatchUpCatalogGroupBy, keys: Iterable<string>): void {
  const list = [...keys];
  scheduledCollapsedSession = list.length ? { groupBy, keys: list } : undefined;
}

// ── Scheduled-panel filters ──

export function readScheduledFilters(): CatalogFilters {
  try {
    const raw = localStorage.getItem(SCHEDULED_FILTERS_KEY);
    return raw ? (JSON.parse(raw) as CatalogFilters) : {};
  } catch {
    // Malformed JSON in storage falls into this branch too — return an
    // empty object so the UI boots into a sane state rather than throwing.
    return {};
  }
}

export function writeScheduledFilters(value: CatalogFilters): void {
  try {
    const isEmpty = !value.eventType && !value.eventName && !value.drawName && !value.gender && !value.roundName;
    if (isEmpty) localStorage.removeItem(SCHEDULED_FILTERS_KEY);
    else localStorage.setItem(SCHEDULED_FILTERS_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

// ── Inspector visibility ──

/**
 * Defaults to VISIBLE: the Inspector is the surface that explains a placement,
 * so an operator who has never touched the toggle should see it. Only an
 * explicit `'false'` hides it — any other value (absent, malformed, storage
 * throwing) falls back to visible rather than silently removing a panel the
 * operator never asked to lose.
 */
export function readInspectorVisible(): boolean {
  try {
    return localStorage.getItem(INSPECTOR_VISIBLE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeInspectorVisible(visible: boolean): void {
  try {
    if (visible) localStorage.removeItem(INSPECTOR_VISIBLE_KEY);
    else localStorage.setItem(INSPECTOR_VISIBLE_KEY, 'false');
  } catch {
    // storage unavailable
  }
}

// ── Grid warning bars ──

/**
 * Whether warning-severity scheduling issues decorate their grid cells.
 *
 * Defaults to VISIBLE, which is the behaviour that existed before the toggle: an
 * operator who has never opened the Issues popover must not silently lose a cue they
 * were relying on. Only an explicit `'false'` suppresses them — a missing, malformed or
 * unreadable value falls back to showing them, because the failure direction that hides
 * information from a director is the worse one.
 *
 * ERROR-severity decoration is not governed by this at all; see `decoratesCell`.
 *
 * Same shape as `readInspectorVisible` above, deliberately: two view preferences that
 * behave differently for no reason are two things to remember instead of one.
 */
export function readGridWarningBars(): boolean {
  try {
    return localStorage.getItem(GRID_WARNING_BARS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeGridWarningBars(visible: boolean): void {
  try {
    if (visible) localStorage.removeItem(GRID_WARNING_BARS_KEY);
    else localStorage.setItem(GRID_WARNING_BARS_KEY, 'false');
  } catch {
    // storage unavailable
  }
}

/**
 * Call-to-court prompt mode (On / Off / Auto). Defaults to `off`.
 *
 * **localStorage is a deliberate v1 choice with a known limitation.** "Does this tournament run a
 * check-in desk?" is a property of operating practice, not of this browser, so two desks at the same
 * tournament can disagree. That is tolerable only because the default is `off`: a lost or divergent
 * setting degrades to "no prompts", which is the safe direction. The durable home is a sanctioning
 * policy on the tournament record — see the note in TMX_PRESENCE_AND_CHECK_IN — and when that lands
 * it should take precedence over this, with `auto` retiring.
 */
export function readCheckInPromptMode(): CheckInPromptMode {
  const stored = globalThis.localStorage?.getItem(CHECK_IN_PROMPT_MODE_KEY);
  return isCheckInPromptMode(stored) ? stored : DEFAULT_CHECK_IN_PROMPT_MODE;
}

export function writeCheckInPromptMode(mode: CheckInPromptMode): void {
  globalThis.localStorage?.setItem(CHECK_IN_PROMPT_MODE_KEY, mode);
}

export type GridCatalogPlacement = 'left' | 'bottom';
export type GridInspectorPlacement = InspectorPlacement;
export type GridInspectorGeometry = InspectorGeometry;

function readPresentation<T>(key: string, valid: (value: unknown) => value is T, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePresentation(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Optional local preference; the current UI remains usable. */
  }
}

export const readCatalogPlacement = (): GridCatalogPlacement =>
  readPresentation(
    'schedule2:catalog-placement',
    (v): v is GridCatalogPlacement => v === 'left' || v === 'bottom',
    'left',
  );
export const writeCatalogPlacement = (v: GridCatalogPlacement): void =>
  writePresentation('schedule2:catalog-placement', v);
export const readInspectorPlacement = (): GridInspectorPlacement =>
  readPresentation(
    'schedule2:inspector-placement',
    (v): v is GridInspectorPlacement => v === 'docked' || v === 'floating',
    'docked',
  );
export const writeInspectorPlacement = (v: GridInspectorPlacement): void =>
  writePresentation('schedule2:inspector-placement', v);
export const readInspectorGeometry = (): GridInspectorGeometry | undefined =>
  readPresentation<GridInspectorGeometry | undefined>(
    'schedule2:inspector-geometry',
    (v): v is GridInspectorGeometry => {
      if (!v || typeof v !== 'object') return false;
      const g = v as Record<string, unknown>;
      return (
        ['left', 'top', 'width', 'height'].every((key) => typeof g[key] === 'number' && Number.isFinite(g[key])) &&
        Number(g.width) > 0 &&
        Number(g.height) > 0
      );
    },
    undefined,
  );
export const writeInspectorGeometry = (v: GridInspectorGeometry): void =>
  writePresentation('schedule2:inspector-geometry', v);
