/**
 * Schedule 2 header bar — rich date dropdown + issues popover + view switcher.
 *
 * Persistent across view changes. The date selector is a button that opens a
 * tippy popover with date chips (matching courthive-components dateStrip style).
 * An issues icon appears when there are scheduling conflicts.
 */
import { providerConfig } from 'config/providerConfig';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { ScheduleDate, ScheduleIssue } from 'courthive-components';
import type { Schedule2View } from './schedule2Tab';

export type ScheduleSearchMode = 'individual' | 'team';

interface Schedule2HeaderParams {
  selectedDate: string;
  activeView: Schedule2View;
  startDate: string;
  endDate: string;
  bulkMode: boolean;
  scheduleDates?: ScheduleDate[];
  issues?: ScheduleIssue[];
  onDateChange: (date: string) => void;
  onViewChange: (view: Schedule2View) => void;
  onBulkModeChange: (enabled: boolean) => void;
  onSearch?: (text: string, mode: ScheduleSearchMode) => void;
}

export function buildSchedule2Header(params: Schedule2HeaderParams): HTMLElement {
  const {
    selectedDate, activeView, startDate, endDate, bulkMode,
    scheduleDates, issues,
    onDateChange, onViewChange, onBulkModeChange, onSearch,
  } = params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';
  bar.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; flex-wrap: wrap;';

  // ── Left: Date dropdown + issues icon ──
  const left = document.createElement('div');
  left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  // Rich date dropdown button
  const dates = scheduleDates ?? fallbackDates(startDate, endDate, selectedDate);
  const selectedDateInfo = dates.find((d) => d.date === selectedDate);
  const dateBtn = document.createElement('button');
  dateBtn.style.cssText = [
    'font-size: 13px', 'font-weight: 600', 'padding: 5px 12px',
    'border-radius: 6px', 'border: 1px solid var(--tmx-border-primary)',
    'background: var(--tmx-bg-primary)', 'color: var(--tmx-color-primary)',
    'cursor: pointer', 'display: inline-flex', 'align-items: center', 'gap: 6px',
  ].join('; ');
  const matchUpCount = selectedDateInfo?.matchUpCount ?? 0;
  dateBtn.innerHTML = `<i class="fa-solid fa-calendar-days" style="font-size: 12px;"></i>${formatDateLabel(selectedDate)}` +
    (matchUpCount > 0 ? ` <span style="font-size: 10px; font-weight: 400; padding: 1px 6px; border-radius: 10px; background: var(--tmx-bg-secondary, rgba(128,128,128,0.1)); color: var(--tmx-muted);">${matchUpCount}</span>` : '') +
    ' <i class="fa-solid fa-chevron-down" style="font-size: 9px; opacity: 0.6;"></i>';

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

  // ── Issues icon (shown only when issues exist) ──
  if (issues && issues.length > 0) {
    const issuesBtn = document.createElement('button');
    issuesBtn.style.cssText = [
      'position: relative', 'font-size: 14px', 'padding: 4px 8px',
      'border-radius: 6px', 'border: 1px solid var(--tmx-border-primary)',
      'background: var(--tmx-bg-primary)', 'cursor: pointer',
      'color: var(--tmx-accent-orange, #f59e0b)', 'display: inline-flex', 'align-items: center', 'gap: 4px',
    ].join('; ');
    issuesBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';

    // Count badge
    const badge = document.createElement('span');
    badge.style.cssText =
      'font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px; background: var(--tmx-accent-orange, #f59e0b); color: #fff;';
    badge.textContent = String(issues.length);
    issuesBtn.appendChild(badge);

    const issuesPopoverContent = buildIssuesPopover(issues);
    let issuesTippy: TippyInstance | undefined;

    left.appendChild(issuesBtn);

    requestAnimationFrame(() => {
      issuesTippy = tippy(issuesBtn, {
        content: issuesPopoverContent,
        trigger: 'click',
        interactive: true,
        placement: 'bottom-start',
        theme: 'light-border',
        appendTo: () => document.body,
        maxWidth: 400,
      });
      // keep reference to suppress unused warning
      void issuesTippy;
    });
  }

  // ── Search field (grid view only) ──
  if (activeView === 'grid' && onSearch) {
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: 4px;';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search schedule\u2026';
    searchInput.style.cssText =
      'font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--tmx-border-primary); background: var(--tmx-bg-primary); color: var(--tmx-color-primary); width: 150px;';

    const modeSelect = document.createElement('select');
    modeSelect.title = 'Search by individual or team name';
    modeSelect.style.cssText =
      'font-size: 11px; padding: 3px 4px; border-radius: 6px; border: 1px solid var(--tmx-border-primary); background: var(--tmx-bg-primary); color: var(--tmx-color-primary); cursor: pointer;';
    const indOpt = document.createElement('option');
    indOpt.value = 'individual';
    indOpt.textContent = 'Individual';
    const teamOpt = document.createElement('option');
    teamOpt.value = 'team';
    teamOpt.textContent = 'Team';
    modeSelect.appendChild(indOpt);
    modeSelect.appendChild(teamOpt);

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const doSearch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onSearch(searchInput.value, modeSelect.value as ScheduleSearchMode);
      }, 200);
    };

    searchInput.addEventListener('input', doSearch);
    modeSelect.addEventListener('change', doSearch);

    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(modeSelect);
    left.appendChild(searchWrap);
  }

  bar.appendChild(left);

  // ── Right: Bulk mode toggle + View switcher ──
  const right = document.createElement('div');
  right.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  // Bulk mode toggle (grid view only, if permitted)
  if (activeView === 'grid' && providerConfig.isAllowed('canUseBulkScheduling')) {
    const bulkLabel = document.createElement('label');
    bulkLabel.style.cssText =
      'font-size: 12px; color: var(--tmx-color-primary); cursor: pointer; display: flex; align-items: center; gap: 6px;';
    bulkLabel.title = 'Queue changes, save all at once';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = bulkMode;
    toggle.style.cssText = 'cursor: pointer; accent-color: var(--tmx-accent-blue);';
    toggle.addEventListener('change', () => onBulkModeChange(toggle.checked));

    bulkLabel.appendChild(toggle);
    bulkLabel.appendChild(document.createTextNode('Bulk mode'));
    right.appendChild(bulkLabel);
  }

  // View switcher (segmented control)
  const viewSwitcher = document.createElement('div');
  viewSwitcher.style.cssText = 'display: flex; align-items: center; gap: 0;';

  const views: { key: Schedule2View; label: string; icon: string }[] = [
    { key: 'grid', label: 'Grid', icon: 'fa-table-cells' },
    { key: 'profile', label: 'Profile', icon: 'fa-layer-group' },
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
    if (v.key === 'grid') btn.style.borderRadius = '6px 0 0 6px';
    else btn.style.borderRadius = '0 6px 6px 0';

    viewSwitcher.appendChild(btn);
  }

  right.appendChild(viewSwitcher);
  bar.appendChild(right);

  return bar;
}

// ── Date Popover ──

function buildDatePopover(
  dates: ScheduleDate[],
  selectedDate: string,
  onSelect: (date: string) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 320px; overflow-y: auto; min-width: 220px;';

  for (const d of dates) {
    const chip = document.createElement('div');
    const isSelected = d.date === selectedDate;
    chip.setAttribute('data-date', d.date);
    chip.style.cssText = [
      'display: flex', 'justify-content: space-between', 'align-items: center',
      'padding: 8px 10px', 'border-radius: 8px', 'cursor: pointer',
      'margin-bottom: 2px', 'transition: background 0.15s',
      isSelected ? 'background: var(--tmx-accent-blue, #3b82f6); color: #fff;' : '',
    ].join('; ');

    chip.addEventListener('mouseenter', () => {
      if (!isSelected) chip.style.background = 'var(--tmx-bg-secondary, rgba(128,128,128,0.08))';
    });
    chip.addEventListener('mouseleave', () => {
      if (!isSelected) chip.style.background = '';
    });

    const leftSide = document.createElement('div');
    const dateLabel = document.createElement('div');
    dateLabel.style.cssText = 'font-weight: 700; font-size: 12px;';
    dateLabel.textContent = formatDateLabel(d.date);
    const statusLabel = document.createElement('div');
    statusLabel.style.cssText = `font-size: 11px; ${isSelected ? 'color: rgba(255,255,255,0.8);' : 'color: var(--tmx-muted);'}`;
    statusLabel.textContent = d.isActive ? 'Active' : 'Inactive';
    leftSide.appendChild(dateLabel);
    leftSide.appendChild(statusLabel);

    const badges = document.createElement('div');
    badges.style.cssText = 'display: flex; gap: 4px; align-items: center;';

    if (d.matchUpCount != null && d.matchUpCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,255,255,0.25); color: #fff;' : 'background: var(--tmx-bg-secondary, rgba(128,128,128,0.1)); color: var(--tmx-muted);'}`;
      b.textContent = `${d.matchUpCount}`;
      badges.appendChild(b);
    }
    if (d.issueCount && d.issueCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,200,100,0.4); color: #fff;' : 'background: rgba(245, 158, 11, 0.15); color: var(--tmx-accent-orange, #f59e0b);'}`;
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

// ── Issues Popover ──

function buildIssuesPopover(issues: ScheduleIssue[]): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 360px; overflow-y: auto; min-width: 280px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 700; font-size: 12px; margin-bottom: 8px; color: var(--tmx-color-primary);';
  title.textContent = `Scheduling Issues (${issues.length})`;
  container.appendChild(title);

  const severityColors: Record<string, { bg: string; color: string }> = {
    ERROR: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    WARN: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    INFO: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  };

  for (const issue of issues.slice(0, 30)) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--tmx-border-primary, #e5e7eb);';

    const badge = document.createElement('span');
    const colors = severityColors[issue.severity] ?? severityColors.WARN;
    badge.style.cssText = `font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap; background: ${colors.bg}; color: ${colors.color};`;
    badge.textContent = issue.severity;

    const msg = document.createElement('span');
    msg.style.cssText = 'font-size: 11px; color: var(--tmx-color-primary); line-height: 1.4;';
    msg.textContent = issue.message;

    row.appendChild(badge);
    row.appendChild(msg);
    container.appendChild(row);
  }

  if (issues.length > 30) {
    const more = document.createElement('div');
    more.style.cssText = 'font-size: 11px; color: var(--tmx-muted); padding: 6px 0; text-align: center;';
    more.textContent = `\u2026and ${issues.length - 30} more`;
    container.appendChild(more);
  }

  return container;
}

// ── Helpers ──

function segmentBtnStyle(active: boolean): string {
  const base =
    'font-size: 12px; padding: 5px 12px; border: 1px solid var(--tmx-border-primary); cursor: pointer; display: inline-flex; align-items: center; transition: background 0.15s;';
  if (active) {
    return base + 'background: var(--tmx-accent-blue); color: #fff; font-weight: 600;';
  }
  return base + 'background: var(--tmx-bg-primary); color: var(--tmx-color-primary);';
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
