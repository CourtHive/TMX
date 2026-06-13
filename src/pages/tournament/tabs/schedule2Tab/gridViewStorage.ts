/**
 * `gridView.ts` persists four pieces of view state across page reloads via
 * `localStorage`:
 *
 *   - which sidebar tab the operator was last on (Unscheduled / Scheduled)
 *   - the Scheduled-panel search query
 *   - the Scheduled-panel group-by axis (event / draw / round / structure)
 *   - the Scheduled-panel filter selections (a `CatalogFilters` shape)
 *
 * All four read / write pairs share a common contract: writes wrap
 * `localStorage` in a `try { … } catch {}` so a sandboxed iframe (or
 * Storage-blocked browser) silently no-ops; reads return a sane default on
 * the same exception path so the UI always boots into a valid state.
 *
 * The adapters are pure aside from their `localStorage` interaction —
 * extracted from the gridView module so unit tests can stub
 * `globalThis.localStorage` and exercise round-trips + default / malformed
 * paths without dragging in the rest of the schedule grid.
 */

import type { CatalogFilters, MatchUpCatalogGroupBy } from 'courthive-components';

export type SidebarTab = 'unscheduled' | 'scheduled';

const SIDEBAR_TAB_KEY = 'schedule2:sidebar-tab';
const SCHEDULED_SEARCH_KEY = 'schedule2:scheduled-search';
const SCHEDULED_GROUPBY_KEY = 'schedule2:scheduled-groupby';
const SCHEDULED_FILTERS_KEY = 'schedule2:scheduled-filters';

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
