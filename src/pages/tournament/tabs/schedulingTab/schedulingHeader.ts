/**
 * Scheduling workspace header — mirrors schedule2's `.sch2-header` shape so
 * the control bar visual is identical, with one extra segmented option
 * (Availability) ahead of Profile and Grid.
 *
 * Left: rich date dropdown button (calendar icon + day-label + match-count
 *       badge + chevron), tippy popover with date chips.
 * Right: 3-segment view switcher — Availability | Profile | Grid.
 *
 * Reuses the same style constants and ScheduleDate type as schedule2Header
 * so any future style change in the control bar can be centralized later.
 */
import { onMutationApplied } from 'services/mutation/mutationObservers';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ScheduleDate } from 'courthive-components';

import type { SchedulingMode } from './schedulingTab';

// Live subscription keeping the current header's date badges fresh after a
// mutation. Held at module level and replaced per build so only the mounted
// header updates.
let schedulingHeaderDatesUnsub: (() => void) | null = null;

const FONT13 = 'font-size: 0.8125rem';
const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const BG_PRIMARY = 'background: var(--tmx-bg-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';
const CURSOR_POINTER = 'cursor: pointer';
const DISPLAY_INLINE_FLEX = 'display: inline-flex';
const ALIGN_CENTER = 'align-items: center';

interface SchedulingHeaderParams {
  selectedDate: string;
  activeMode: SchedulingMode;
  startDate: string;
  endDate: string;
  scheduleDates?: ScheduleDate[];
  /** Recompute the per-date counts on demand (after a mutation). */
  recomputeDates?: () => ScheduleDate[];
  onDateChange: (date: string) => void;
  onModeChange: (mode: SchedulingMode) => void;
}

interface ModeOption {
  key: SchedulingMode;
  label: string;
  icon: string;
}

// Order follows the lifecycle: set up Availability → plan with Profile → run Grid.
const MODES: ModeOption[] = [
  { key: 'availability', label: 'Availability', icon: 'fa-calendar-check' },
  { key: 'profile', label: 'Profile', icon: 'fa-layer-group' },
  { key: 'grid', label: 'Grid', icon: 'fa-table-cells' },
];

export function buildSchedulingHeader(params: SchedulingHeaderParams): HTMLElement {
  const { selectedDate, activeMode, startDate, endDate, scheduleDates, recomputeDates, onDateChange, onModeChange } =
    params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';

  // ── Left: Date dropdown ──
  const left = document.createElement('div');

  const dates = scheduleDates ?? fallbackDates(startDate, endDate, selectedDate);
  const dateBtn = document.createElement('button');
  dateBtn.style.cssText = [
    FONT13,
    'font-weight: 600',
    'padding: 5px 12px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    COLOR_PRIMARY,
    CURSOR_POINTER,
    DISPLAY_INLINE_FLEX,
    ALIGN_CENTER,
    'gap: 6px',
  ].join('; ');

  const countFor = (ds: ScheduleDate[]): number => ds.find((d) => d.date === selectedDate)?.matchUpCount ?? 0;
  const renderDateBtn = (count: number): void => {
    dateBtn.innerHTML =
      `<i class="fa-solid fa-calendar-days" style="font-size: 0.75rem;"></i>${formatDateLabel(selectedDate)}` +
      (count > 0
        ? ` <span style="font-size: 0.625rem; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: rgba(127,127,127,0.25); color: currentColor;">${count}</span>`
        : '') +
      ' <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>';
  };
  renderDateBtn(countFor(dates));

  let dateTippy: TippyInstance | undefined;
  const buildPopover = (ds: ScheduleDate[]): HTMLElement =>
    buildDatePopover(ds, selectedDate, (date) => {
      dateTippy?.hide();
      onDateChange(date);
    });
  let datePopoverContent = buildPopover(dates);

  // Keep the date badge live after mutations (schedule / unschedule move the
  // per-date counts). Subscribe here — where the header is built — so it runs
  // whenever a header exists; replace the prior header's subscription.
  if (recomputeDates) {
    schedulingHeaderDatesUnsub?.();
    schedulingHeaderDatesUnsub = onMutationApplied(() => {
      const next = recomputeDates();
      renderDateBtn(countFor(next));
      datePopoverContent = buildPopover(next);
      dateTippy?.setContent(datePopoverContent);
    });
  }

  left.appendChild(dateBtn);

  requestAnimationFrame(() => {
    dateTippy = tippy(dateBtn, {
      content: datePopoverContent,
      trigger: 'click',
      interactive: true,
      placement: 'bottom-start',
      theme: 'light-border',
      appendTo: () => document.body,
      onShown: () => {
        const activeChip = datePopoverContent.querySelector(`[data-date="${selectedDate}"]`) as HTMLElement;
        activeChip?.scrollIntoView({ block: 'nearest' });
      },
    });
  });

  bar.appendChild(left);

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

  return bar;
}

// ── Date Popover (mirrors schedule2Header.buildDatePopover) ──

function buildDatePopover(dates: ScheduleDate[], selectedDate: string, onSelect: (date: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 320px; overflow-y: auto; min-width: 220px;';

  for (const d of dates) {
    const chip = document.createElement('div');
    const isSelected = d.date === selectedDate;
    chip.dataset.date = d.date;
    chip.style.cssText = [
      'display: flex',
      'justify-content: space-between',
      'align-items: center',
      'padding: 8px 10px',
      'border-radius: 8px',
      'cursor: pointer',
      'margin-bottom: 2px',
      'transition: background 0.15s',
      isSelected ? 'background: var(--tmx-fill-accent, #2563eb); color: #fff;' : '',
    ].join('; ');

    chip.addEventListener('mouseenter', () => {
      if (!isSelected) chip.style.background = 'var(--tmx-bg-secondary, rgba(128,128,128,0.08))';
    });
    chip.addEventListener('mouseleave', () => {
      if (!isSelected) chip.style.background = '';
    });

    const leftSide = document.createElement('div');
    const dateLabel = document.createElement('div');
    dateLabel.style.cssText = 'font-weight: 700; font-size: 0.75rem;';
    dateLabel.textContent = formatDateLabel(d.date);
    const statusLabel = document.createElement('div');
    statusLabel.style.cssText = `font-size: 0.6875rem; ${isSelected ? 'color: rgba(255,255,255,0.8);' : 'color: var(--tmx-muted);'}`;
    statusLabel.textContent = d.isActive ? 'Active' : 'Inactive';
    leftSide.appendChild(dateLabel);
    leftSide.appendChild(statusLabel);

    const badges = document.createElement('div');
    badges.style.cssText = 'display: flex; gap: 4px; align-items: center;';

    if (d.matchUpCount != null && d.matchUpCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 0.625rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,255,255,0.25); color: #fff;' : 'background: rgba(127,127,127,0.25); color: currentColor;'}`;
      b.textContent = `${d.matchUpCount}`;
      badges.appendChild(b);
    }
    if (d.issueCount && d.issueCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 0.625rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,200,100,0.4); color: #fff;' : 'background: rgba(245, 158, 11, 0.15); color: var(--tmx-accent-orange, #f59e0b);'}`;
      b.textContent = `${d.issueCount} !`;
      badges.appendChild(b);
    }

    chip.appendChild(leftSide);
    chip.appendChild(badges);
    chip.addEventListener('click', () => onSelect(d.date));
    container.appendChild(chip);
  }

  return container;
}

function segmentBtnStyle(active: boolean): string {
  const base = `font-size: 0.75rem; padding: 5px 12px; ${BORDER_PRIMARY}; ${CURSOR_POINTER}; ${DISPLAY_INLINE_FLEX}; ${ALIGN_CENTER}; transition: background 0.15s;`;
  if (active) {
    return base + 'background: var(--tmx-fill-accent, #2563eb); color: #fff; font-weight: 600;';
  }
  return base + `${BG_PRIMARY}; ${COLOR_PRIMARY};`;
}

function fallbackDates(start: string, end: string, selectedDate: string): ScheduleDate[] {
  return dateRange(start, end).map((d) => ({ date: d, isActive: d === selectedDate }));
}

function dateRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const date = d.getDate();
  return `${day} ${month} ${date}`;
}
