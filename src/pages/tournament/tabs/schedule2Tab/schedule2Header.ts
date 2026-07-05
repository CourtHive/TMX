/**
 * Schedule 2 header bar — date selector + view switcher.
 *
 * The date selector (calendar button + match-count badge + tippy date-chip
 * popover + its own onMutationApplied recompute subscription) is the shared
 * `buildScheduleDateSelector` component. This header only owns its Profile|Grid
 * view switcher; Issues / Clear / Bulk-mode live in the grid view's bottom
 * action bar (see gridActionBar.ts).
 */
import { buildScheduleDateSelector } from 'components/schedule/scheduleDateSelector';
import { ScheduleDate } from 'courthive-components';

// Types
import { Schedule2View } from './schedule2Tab';

const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const BG_PRIMARY = 'background: var(--tmx-bg-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';
const CURSOR_POINTER = 'cursor: pointer';
const DISPLAY_INLINE_FLEX = 'display: inline-flex';
const ALIGN_CENTER = 'align-items: center';

interface Schedule2HeaderParams {
  selectedDate: string;
  activeView: Schedule2View;
  scheduleDates: ScheduleDate[];
  /** Recompute the per-date counts on demand (after a mutation). */
  recomputeDates: () => ScheduleDate[];
  onDateChange: (date: string) => void;
  onViewChange: (view: Schedule2View) => void;
}

export interface Schedule2Header {
  element: HTMLElement;
  /** Tear down the date selector's subscription + tippy instance. */
  destroy: () => void;
}

export function buildSchedule2Header(params: Schedule2HeaderParams): Schedule2Header {
  const { selectedDate, activeView, scheduleDates, recomputeDates, onDateChange, onViewChange } = params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';
  // Layout lives in tmx.css under `.sch2-header` so a media query can
  // collapse the bar to two stacked rows on phone-sized viewports.

  // ── Left: shared date selector ──
  const selector = buildScheduleDateSelector({ selectedDate, dates: scheduleDates, recomputeDates, onDateChange });
  bar.appendChild(selector.element);

  // ── Right: View switcher ──
  const right = document.createElement('div');

  const viewSwitcher = document.createElement('div');
  viewSwitcher.style.cssText = 'display: flex; align-items: center; gap: 0;';

  // Profile leads — planning a scheduling profile is the logical first step
  // when an operator chooses to use one. Grid trails on the right because it
  // remains the default and where the bulk of the work happens.
  const views: { key: Schedule2View; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'fa-layer-group' },
    { key: 'grid', label: 'Grid', icon: 'fa-table-cells' },
  ];

  for (const v of views) {
    const btn = document.createElement('button');
    btn.style.cssText = segmentBtnStyle(v.key === activeView);
    btn.title = v.label;
    btn.innerHTML = `<i class="fa-solid ${v.icon}" style="margin-right: 4px;"></i>${v.label}`;

    if (v.key === activeView) {
      btn.setAttribute('aria-pressed', 'true');
    }

    btn.addEventListener('click', () => {
      if (v.key !== activeView) onViewChange(v.key);
    });

    // Round left/right corners for segmented look
    if (v.key === 'profile') btn.style.borderRadius = '6px 0 0 6px';
    else btn.style.borderRadius = '0 6px 6px 0';

    viewSwitcher.appendChild(btn);
  }

  right.appendChild(viewSwitcher);
  bar.appendChild(right);

  return { element: bar, destroy: selector.destroy };
}

// ── Helpers ──

function segmentBtnStyle(active: boolean): string {
  const base = `font-size: 0.75rem; padding: 5px 12px; ${BORDER_PRIMARY}; ${CURSOR_POINTER}; ${DISPLAY_INLINE_FLEX}; ${ALIGN_CENTER}; transition: background 0.15s;`;
  if (active) {
    return base + 'background: var(--tmx-fill-accent, #2563eb); color: #fff; font-weight: 600;';
  }
  return base + `${BG_PRIMARY}; ${COLOR_PRIMARY};`;
}
