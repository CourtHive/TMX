/**
 * Schedule 2 header bar — date selector + view switcher.
 *
 * Persistent across view changes. The date selector is a native <select>
 * dropdown listing all competition dates. The view switcher is a segmented
 * control with Grid / Profile buttons.
 */
import { competitionEngine } from 'tods-competition-factory';
import { providerConfig } from 'config/providerConfig';
import type { Schedule2View } from './schedule2Tab';

interface Schedule2HeaderParams {
  selectedDate: string;
  activeView: Schedule2View;
  startDate: string;
  endDate: string;
  bulkMode: boolean;
  onDateChange: (date: string) => void;
  onViewChange: (view: Schedule2View) => void;
  onBulkModeChange: (enabled: boolean) => void;
}

export function buildSchedule2Header(params: Schedule2HeaderParams): HTMLElement {
  const { selectedDate, activeView, startDate, endDate, bulkMode, onDateChange, onViewChange, onBulkModeChange } =
    params;

  const bar = document.createElement('div');
  bar.className = 'sch2-header';
  bar.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; flex-wrap: wrap;';

  // ── Left: Date selector ──
  const left = document.createElement('div');
  left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const dateLabel = document.createElement('span');
  dateLabel.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--tmx-color-primary);';
  dateLabel.textContent = 'Date:';
  left.appendChild(dateLabel);

  const dateSelect = document.createElement('select');
  dateSelect.style.cssText =
    'font-size: 13px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--tmx-border-primary); background: var(--tmx-bg-primary); color: var(--tmx-color-primary); cursor: pointer;';

  const dates = dateRange(startDate, endDate);
  for (const d of dates) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = formatDateLabel(d);
    if (d === selectedDate) opt.selected = true;
    dateSelect.appendChild(opt);
  }
  dateSelect.addEventListener('change', () => onDateChange(dateSelect.value));
  left.appendChild(dateSelect);

  // ── Scheduled matchUp count badge ──
  const countBadge = document.createElement('span');
  countBadge.style.cssText =
    'font-size: 11px; color: var(--tmx-muted); padding: 2px 8px; background: var(--tmx-bg-secondary, rgba(128,128,128,0.1)); border-radius: 10px;';
  const { matchUps } = competitionEngine.competitionScheduleMatchUps({
    matchUpFilters: { scheduledDate: selectedDate },
  });
  const count = matchUps?.length ?? 0;
  countBadge.textContent = `${count} scheduled`;
  left.appendChild(countBadge);

  bar.appendChild(left);

  // ── Center: Bulk mode toggle (grid view only, if permitted) ──
  if (activeView === 'grid' && providerConfig.isAllowed('canUseBulkScheduling')) {
    const center = document.createElement('div');
    center.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const bulkLabel = document.createElement('label');
    bulkLabel.style.cssText =
      'font-size: 12px; color: var(--tmx-color-primary); cursor: pointer; display: flex; align-items: center; gap: 6px;';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = bulkMode;
    toggle.style.cssText = 'cursor: pointer; accent-color: var(--tmx-accent-blue);';
    toggle.addEventListener('change', () => onBulkModeChange(toggle.checked));

    bulkLabel.appendChild(toggle);
    bulkLabel.appendChild(document.createTextNode('Bulk mode'));
    center.appendChild(bulkLabel);

    const bulkHint = document.createElement('span');
    bulkHint.style.cssText = 'font-size: 10px; color: var(--tmx-muted);';
    bulkHint.textContent = '(queue changes, save all at once)';
    center.appendChild(bulkHint);

    bar.appendChild(center);
  }

  // ── Right: View switcher (segmented control) ──
  const right = document.createElement('div');
  right.style.cssText = 'display: flex; align-items: center; gap: 0;';

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

    right.appendChild(btn);
  }

  bar.appendChild(right);

  return bar;
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
