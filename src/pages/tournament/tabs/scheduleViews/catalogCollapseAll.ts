/**
 * Schedule2 — the catalog's "collapse all" control.
 *
 * One button for whichever catalog tab is showing: it collapses every group the tab shows, or, when
 * they are all collapsed already, expands them all. The icon names what a click will do. Where it sits
 * depends on the catalog placement (`gridView.ts` `syncCatalogToolbar`): in the bottom strip, inside the
 * active toolbar after the group-by select and before the ◀ ▶ card navigation; beside the sidebar, at
 * the right of the Unscheduled / Scheduled row.
 *
 * The decision is kept apart from the DOM so it can be tested without a browser.
 */
import { t } from 'i18n';

const COLLAPSE_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>';
const EXPAND_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>';

/** True when there is at least one group and every one of them is collapsed. */
export function everyGroupCollapsed(visibleKeys: readonly string[], collapsed: ReadonlySet<string>): boolean {
  return visibleKeys.length > 0 && visibleKeys.every((key) => collapsed.has(key));
}

/**
 * The collapsed set after a click: every visible group, or none. Keys of groups not on screen (hidden by
 * a search or filter) are dropped either way, so a cleared filter brings them back expanded and the icon
 * keeps telling the truth about what is visible.
 */
export function toggledCollapsedGroups(visibleKeys: readonly string[], collapsed: ReadonlySet<string>): string[] {
  return everyGroupCollapsed(visibleKeys, collapsed) ? [] : [...visibleKeys];
}

export interface CollapseAllButton {
  element: HTMLButtonElement;
  /** Reflect the active tab: which action a click performs, and whether there is anything to act on. */
  sync: (state: { allCollapsed: boolean; groupCount: number }) => void;
}

export function createCollapseAllButton(onClick: () => void): CollapseAllButton {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'tmx-catalog-collapse-all';
  element.addEventListener('click', onClick);

  const sync: CollapseAllButton['sync'] = ({ allCollapsed, groupCount }) => {
    const label = allCollapsed ? t('schedule.expandAllGroups') : t('schedule.collapseAllGroups');
    element.innerHTML = allCollapsed ? EXPAND_ICON : COLLAPSE_ICON;
    element.title = label;
    element.setAttribute('aria-label', label);
    element.dataset.allCollapsed = String(allCollapsed);
    element.disabled = groupCount === 0;
  };
  sync({ allCollapsed: false, groupCount: 0 });
  return { element, sync };
}
