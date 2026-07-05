/**
 * Scheduling workspace header — mirrors schedule2's `.sch2-header` shape so the
 * control bar visual is identical, with one extra segmented option
 * (Availability) ahead of Profile and Grid.
 *
 * Left: the shared `buildScheduleDateSelector` component (calendar button +
 *       match-count badge + tippy date-chip popover + its own recompute
 *       subscription).
 * Right: 3-segment mode switcher — Availability | Profile | Grid.
 */
import { buildScheduleDateSelector } from 'components/schedule/scheduleDateSelector';
import { ScheduleDate } from 'courthive-components';

import type { SchedulingMode } from './schedulingTab';

const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const BG_PRIMARY = 'background: var(--tmx-bg-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';
const CURSOR_POINTER = 'cursor: pointer';
const DISPLAY_INLINE_FLEX = 'display: inline-flex';
const ALIGN_CENTER = 'align-items: center';

interface SchedulingHeaderParams {
  selectedDate: string;
  activeMode: SchedulingMode;
  scheduleDates: ScheduleDate[];
  /** Recompute the per-date counts on demand (after a mutation). */
  recomputeDates: () => ScheduleDate[];
  onDateChange: (date: string) => void;
  onModeChange: (mode: SchedulingMode) => void;
}

interface ModeOption {
  key: SchedulingMode;
  label: string;
  icon: string;
}

export interface SchedulingHeader {
  element: HTMLElement;
  /** Tear down the date selector's subscription + tippy instance. */
  destroy: () => void;
}

// Order follows the lifecycle: set up Availability → plan with Profile → run Grid.
const MODES: ModeOption[] = [
  { key: 'availability', label: 'Availability', icon: 'fa-calendar-check' },
  { key: 'profile', label: 'Profile', icon: 'fa-layer-group' },
  { key: 'grid', label: 'Grid', icon: 'fa-table-cells' },
];

export function buildSchedulingHeader(params: SchedulingHeaderParams): SchedulingHeader {
  const { selectedDate, activeMode, scheduleDates, recomputeDates, onDateChange, onModeChange } = params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';

  // ── Left: shared date selector ──
  const selector = buildScheduleDateSelector({ selectedDate, dates: scheduleDates, recomputeDates, onDateChange });
  bar.appendChild(selector.element);

  // ── Right: Mode switcher (3 segments) ──
  const right = document.createElement('div');

  const switcher = document.createElement('div');
  switcher.style.cssText = 'display: flex; align-items: center; gap: 0;';

  MODES.forEach((mode, index) => {
    const btn = document.createElement('button');
    btn.style.cssText = segmentBtnStyle(mode.key === activeMode);
    btn.title = mode.label;
    btn.innerHTML = `<i class="fa-solid ${mode.icon}" style="margin-right: 4px;"></i>${mode.label}`;

    if (mode.key === activeMode) {
      btn.setAttribute('aria-pressed', 'true');
    }

    btn.addEventListener('click', () => {
      if (mode.key !== activeMode) onModeChange(mode.key);
    });

    if (index === 0) btn.style.borderRadius = '6px 0 0 6px';
    else if (index === MODES.length - 1) btn.style.borderRadius = '0 6px 6px 0';
    else btn.style.borderRadius = '0';

    switcher.appendChild(btn);
  });

  right.appendChild(switcher);
  bar.appendChild(right);

  return { element: bar, destroy: selector.destroy };
}

function segmentBtnStyle(active: boolean): string {
  const base = `font-size: 0.75rem; padding: 5px 12px; ${BORDER_PRIMARY}; ${CURSOR_POINTER}; ${DISPLAY_INLINE_FLEX}; ${ALIGN_CENTER}; transition: background 0.15s;`;
  if (active) {
    return base + 'background: var(--tmx-fill-accent, #2563eb); color: #fff; font-weight: 600;';
  }
  return base + `${BG_PRIMARY}; ${COLOR_PRIMARY};`;
}
