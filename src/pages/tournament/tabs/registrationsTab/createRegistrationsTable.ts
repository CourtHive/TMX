/**
 * Tabulator table for HiveID applicant entries (Phase 2-B). Renders rows
 * from /admin/tournaments/:tournamentId/registrations and provides the
 * per-row action surface (accept / waitlist / reject). Bulk-select
 * checkbox column powers the bulk-action buttons in the control bar
 * (registrationActions.ts is the wiring).
 */
import { TabulatorFull as Tabulator } from 'tabulator-tables';

import type { RegistrationEntry } from 'services/apis/registrationsApi';
import { collapseRegistrationPairs } from './collapseRegistrationPairs';
import { TOURNAMENT_REGISTRATIONS } from 'constants/tmxConstants';
import { t } from 'i18n';

interface CreateRegistrationsTableParams {
  entries: RegistrationEntry[];
  onSelectionChange: (selectedRegistrationIds: string[]) => void;
  onRowAction: (action: 'accept' | 'waitlist' | 'reject', registrationId: string) => void;
}

const STATUS_PILL_COLORS: Record<string, string> = {
  applied: '#3273dc',
  accepted: '#23d160',
  seeded: '#23d160',
  waitlisted: '#ffdd57',
  rejected: '#ff3860',
  withdrawn: '#ff3860',
};

function statusPillFormatter(cell: any): string {
  const status = String(cell.getValue() ?? '');
  const color = STATUS_PILL_COLORS[status] ?? '#7a7a7a';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">${status}</span>`;
}

function actionsFormatter(cell: any): string {
  const data = cell.getData() as RegistrationEntry;
  const isTerminal = data.status === 'rejected' || data.status === 'withdrawn';
  if (isTerminal) {
    return `<span style="color:var(--tmx-text-secondary);font-size:12px">no actions</span>`;
  }
  return `
    <button type="button" data-action="accept" style="margin-right:4px">Accept</button>
    <button type="button" data-action="waitlist" style="margin-right:4px">Waitlist</button>
    <button type="button" data-action="reject">Reject</button>
  `;
}

export function createRegistrationsTable(params: CreateRegistrationsTableParams): {
  table: any;
  setEntries: (rows: RegistrationEntry[]) => void;
} {
  const container = document.getElementById(TOURNAMENT_REGISTRATIONS);
  if (!container) throw new Error(`Missing #${TOURNAMENT_REGISTRATIONS}`);
  container.innerHTML = '';

  const table = new Tabulator(container, {
    // Decorated, not raw: every column below reads a derived field
    // (`applicantName`, `eventCount`, …), so raw entries paint an empty grid
    // until the first setData lands.
    data: decorateRows(params.entries),
    layout: 'fitColumns',
    selectableRows: true,
    selectableRowsCheck: (row: any) => !!row.getElement(),
    // 100% of the flex-sized host rather than a guess at the chrome above it —
    // `calc(100vh - 280px)` subtracted 280px for ~112px of nav and control bar,
    // leaving the table 168px short of the fold.
    height: '100%',
    rowFormatter: (row: any) => {
      // Listen for action button clicks once per row.
      row.getElement().addEventListener('click', (e: any) => {
        const action = e.target?.dataset?.action;
        if (action === 'accept' || action === 'waitlist' || action === 'reject') {
          params.onRowAction(action, row.getData().registrationId);
          e.stopPropagation();
        }
      });
    },
    columns: [
      { formatter: 'rowSelection', titleFormatter: 'rowSelection', hozAlign: 'center', headerSort: false, width: 40 },
      { title: t('registrations.applicant'), field: 'applicantName', widthGrow: 2, headerFilter: 'input' },
      { title: t('schedule.status'), field: 'status', formatter: statusPillFormatter, width: 130 },
      { title: 'Events', field: 'eventCount', hozAlign: 'right', width: 80 },
      { title: 'Applied', field: 'appliedAtShort', width: 110 },
      { title: 'Partner', field: 'partnerSummary', widthGrow: 1 },
      { title: 'Reason', field: 'statusReason', widthGrow: 1 },
      { title: t('actions.actions'), field: 'actions', formatter: actionsFormatter, headerSort: false, widthGrow: 1 },
    ],
  });

  table.on('rowSelectionChanged', (data: any[]) => {
    params.onSelectionChange(data.map((d: any) => d.registrationId));
  });

  // `setData` before Tabulator has finished building throws inside the library:
  // `_wipeElements` calls `adjustTableSize`, which reads
  // `rowManager.renderer.verticalFillMode` while `renderer` is still null. It
  // throws from inside setData's own promise, and nothing awaits that promise,
  // so it surfaced as an unhandled rejection on every visit to this tab.
  //
  // The tab builds the table with `entries: []` and calls `setEntries` as soon
  // as the fetch resolves, so a fast response really can land inside the build
  // window — deferring to `tableBuilt` is the fix, not just ordering luck.
  let built = false;
  table.on('tableBuilt', () => {
    built = true;
  });

  function setEntries(rows: RegistrationEntry[]): void {
    const decorated = decorateRows(rows);
    if (built) {
      table.setData(decorated);
      return;
    }
    // Registered after the flag-setter above, so `built` is already true by the
    // time this runs; a second pre-build call simply overwrites with the later
    // data, which is the same order the caller asked for.
    table.on('tableBuilt', () => {
      table.setData(decorated);
    });
  }

  return { table, setEntries };
}

function decorateRows(rows: RegistrationEntry[]): any[] {
  // Collapse complete doubles pairs into one row (decision #3). A pair row keys on its
  // first half's registrationId — accepting it folds the whole pair server-side (CFS
  // accept-PAIR is idempotent + stamps both), so the existing accept action just works.
  return collapseRegistrationPairs(rows).map((row) => {
    if (row.kind === 'pair') {
      const [a, b] = row.entries;
      return {
        ...a,
        registrationId: a.registrationId,
        registrationIds: row.registrationIds,
        isPair: true,
        applicantName: `${deriveApplicantName(a)} & ${deriveApplicantName(b)}`,
        eventCount: a.eventIds.length,
        appliedAtShort: a.appliedAt ? a.appliedAt.slice(0, 10) : '',
        partnerSummary: 'doubles pair',
      };
    }
    const r = row.entries[0];
    return {
      ...r,
      applicantName: deriveApplicantName(r),
      eventCount: r.eventIds.length,
      appliedAtShort: r.appliedAt ? r.appliedAt.slice(0, 10) : '',
      partnerSummary: r.partnerUserId ? `partner: ${r.partnerUserId.slice(0, 8)}…` : '',
    };
  });
}

function deriveApplicantName(r: RegistrationEntry): string {
  const given = (r.applicantGivenName ?? '').trim();
  const family = (r.applicantFamilyName ?? '').trim();
  const full = [given, family].filter(Boolean).join(' ');
  if (full) return r.applicantEmail ? `${full} <${r.applicantEmail}>` : full;
  if (r.applicantEmail) return r.applicantEmail;
  return r.userId ? `user:${r.userId.slice(0, 8)}…` : '(unknown)';
}
