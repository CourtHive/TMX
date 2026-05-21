/**
 * Schedule 2 header bar — rich date dropdown + issues popover + view switcher.
 *
 * Persistent across view changes. The date selector is a button that opens a
 * tippy popover with date chips (matching courthive-components dateStrip style).
 * Issues / Clear / Bulk-mode live in the grid view's bottom action bar
 * (see gridActionBar.ts).
 */
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ScheduleDate } from 'courthive-components';

// Types
import { Schedule2View } from './schedule2Tab';

const FONT13 = 'font-size: 0.8125rem';

// Repeated CSS property literals (extracted to satisfy sonar duplicate-literal rule)
const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const BG_PRIMARY = 'background: var(--tmx-bg-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';
const CURSOR_POINTER = 'cursor: pointer';
const DISPLAY_INLINE_FLEX = 'display: inline-flex';
const ALIGN_CENTER = 'align-items: center';

interface Schedule2HeaderParams {
  selectedDate: string;
  activeView: Schedule2View;
  startDate: string;
  endDate: string;
  scheduleDates?: ScheduleDate[];
  onDateChange: (date: string) => void;
  onViewChange: (view: Schedule2View) => void;
}

export function buildSchedule2Header(params: Schedule2HeaderParams): HTMLElement {
  const { selectedDate, activeView, startDate, endDate, scheduleDates, onDateChange, onViewChange } = params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';
  // Layout lives in tmx.css under `.sch2-header` so a media query can
  // collapse the bar to two stacked rows on phone-sized viewports.

  // ── Left: Date dropdown + issues icon ──
  const left = document.createElement('div');

  // Rich date dropdown button
  const dates = scheduleDates ?? fallbackDates(startDate, endDate, selectedDate);
  const selectedDateInfo = dates.find((d) => d.date === selectedDate);
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
  const matchUpCount = selectedDateInfo?.matchUpCount ?? 0;
  dateBtn.innerHTML =
    `<i class="fa-solid fa-calendar-days" style="font-size: 0.75rem;"></i>${formatDateLabel(selectedDate)}` +
    (matchUpCount > 0
      ? ` <span style="font-size: 0.625rem; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: rgba(127,127,127,0.25); color: currentColor;">${matchUpCount}</span>`
      : '') +
    ' <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>';

  let dateTippy: TippyInstance | undefined;
  const datePopoverContent = buildDatePopover(dates, selectedDate, (date) => {
    dateTippy?.hide();
    onDateChange(date);
  });

  left.appendChild(dateBtn);

  // Attach tippy after element is in the DOM
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

  // ── Right: View switcher ──
  const right = document.createElement('div');

  // View switcher (segmented control)
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

  return bar;
}

// ── Date Popover ──

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


// ── Helpers ──

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
