import { peerOccupancyForDate, conflictsForDate, cellLabel } from 'services/facilitySchedule/facilityScheduleHelpers';
import type { FacilityCourtOccupancy } from 'services/facilitySchedule/facilityScheduleHelpers';
import { assembleFacilityGrid } from 'services/facilitySchedule/facilitySchedule';
import { tournamentEngine } from 'services/factory/engine';

const HOST_ID = 'shared-facility-panel';

/** Mount (or refresh) the read-only shared-facility overlay beneath the schedule grid. No-op unless
 * the loaded tournament is linked to others and they share court usage on the selected date. */
export function mountSharedFacilityPanel(container: HTMLElement, scheduledDate: string): void {
  let host = container.querySelector(`#${HOST_ID}`) as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    container.appendChild(host);
  }
  void renderSharedFacilityPanel(host, scheduledDate);
}

async function renderSharedFacilityPanel(host: HTMLElement, scheduledDate: string): Promise<void> {
  const primaryRecord = tournamentEngine.q.tournament();
  const primaryId = primaryRecord?.tournamentId ?? '';
  const assembled = await assembleFacilityGrid(primaryRecord);
  host.innerHTML = '';
  if (!assembled) return; // not linked to any tournament

  const rows = peerOccupancyForDate(assembled.grid, scheduledDate, primaryId);
  const conflicts = conflictsForDate(assembled.grid, scheduledDate);
  if (!rows.length && !conflicts.length) return; // nothing shared on this date

  host.appendChild(buildPanel(rows, conflicts, primaryId));
}

function buildPanel(rows: FacilityCourtOccupancy[], conflicts: any[], primaryId: string): HTMLElement {
  const panel = document.createElement('section');
  panel.style.cssText =
    'margin: 12px 16px; padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--tmx-panel-teal-border); background: var(--tmx-panel-teal-bg);';

  const heading = document.createElement('h3');
  heading.style.cssText = 'margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 8px;';
  heading.innerHTML = '<i class="fa-solid fa-diagram-project"></i> Shared facility — linked tournaments (read-only)';
  panel.appendChild(heading);

  if (conflicts.length) panel.appendChild(buildConflicts(conflicts));

  if (rows.length) {
    for (const row of rows) panel.appendChild(buildCourtRow(row, primaryId));
  } else {
    const none = document.createElement('div');
    none.style.cssText = 'font-size: 0.85rem; color: var(--tmx-text-secondary);';
    none.textContent = 'No shared-court usage by linked tournaments on this date.';
    panel.appendChild(none);
  }
  return panel;
}

function buildConflicts(conflicts: any[]): HTMLElement {
  const warn = document.createElement('div');
  warn.style.cssText =
    'margin-bottom: 8px; padding: 6px 10px; border-radius: 6px; background: var(--tmx-panel-red-bg); border-left: 3px solid var(--tmx-panel-red-border); font-size: 0.85rem;';
  const title = document.createElement('strong');
  title.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${conflicts.length} court double-booking(s)`;
  warn.appendChild(title);
  for (const conflict of conflicts) {
    const line = document.createElement('div');
    line.style.marginTop = '2px';
    const detail =
      conflict.reason === 'SAME_SCHEDULED_TIME' ? `same time ${conflict.scheduledTime}` : `same court order ${conflict.courtOrder}`;
    line.textContent = `${conflict.courtId}: ${detail} — ${(conflict.matchUpIds ?? []).join(', ')}`;
    warn.appendChild(line);
  }
  return warn;
}

function buildCourtRow(row: FacilityCourtOccupancy, primaryId: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top: 6px; font-size: 0.85rem;';
  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.textContent = row.courtId;
  wrap.appendChild(title);

  for (const cell of row.cells) {
    const isPeer = cell?.tournamentId !== primaryId;
    const item = document.createElement('div');
    item.style.cssText = `padding: 2px 0 2px 14px; ${isPeer ? '' : 'opacity: 0.6;'}`;
    const badge = isPeer
      ? '<i class="fa-solid fa-link" style="margin-right:6px; color: var(--tmx-panel-teal-border);"></i>'
      : '<i class="fa-regular fa-circle" style="margin-right:6px;"></i>';
    const suffix = isPeer ? '' : ' — this tournament';
    item.innerHTML = `${badge}<span>${escapeText(cellLabel(cell))}${suffix}</span>`;
    wrap.appendChild(item);
  }
  return wrap;
}

function escapeText(value: string): string {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}
