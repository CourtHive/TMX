/**
 * Tabulator table for HiveID applicant entries (Phase 2-B). Renders rows
 * from /admin/tournaments/:tournamentId/registrations and provides the
 * per-row action surface (accept / waitlist / reject). Bulk-select
 * checkbox column powers the bulk-action buttons in the control bar
 * (registrationActions.ts is the wiring).
 */
import { TabulatorFull as Tabulator } from 'tabulator-tables';

import type { RegistrationEntry } from 'services/apis/registrationsApi';
import { TOURNAMENT_REGISTRATIONS } from 'constants/tmxConstants';

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

export function createRegistrationsTable(params: CreateRegistrationsTableParams): { table: any; setEntries: (rows: RegistrationEntry[]) => void } {
  const container = document.getElementById(TOURNAMENT_REGISTRATIONS);
  if (!container) throw new Error(`Missing #${TOURNAMENT_REGISTRATIONS}`);
  container.innerHTML = '';

  const table = new Tabulator(container, {
    data: params.entries,
    layout: 'fitColumns',
    selectableRows: true,
    selectableRowsCheck: (row: any) => !!row.getElement(),
    height: 'calc(100vh - 280px)',
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
      { title: 'Applicant', field: 'applicantName', widthGrow: 2, headerFilter: 'input' },
      { title: 'Status', field: 'status', formatter: statusPillFormatter, width: 130 },
      { title: 'Events', field: 'eventCount', hozAlign: 'right', width: 80 },
      { title: 'Applied', field: 'appliedAtShort', width: 110 },
      { title: 'Partner', field: 'partnerSummary', widthGrow: 1 },
      { title: 'Reason', field: 'statusReason', widthGrow: 1 },
      { title: 'Actions', field: 'actions', formatter: actionsFormatter, headerSort: false, widthGrow: 1 },
    ],
  });

  table.on('rowSelectionChanged', (data: any[]) => {
    params.onSelectionChange(data.map((d: any) => d.registrationId));
  });

  function setEntries(rows: RegistrationEntry[]): void {
    table.setData(decorateRows(rows));
  }

  table.setData(decorateRows(params.entries));

  return { table, setEntries };
}

function decorateRows(rows: RegistrationEntry[]): any[] {
  return rows.map((r) => ({
    ...r,
    applicantName: deriveApplicantName(r),
    eventCount: r.eventIds.length,
    appliedAtShort: r.appliedAt ? r.appliedAt.slice(0, 10) : '',
    partnerSummary: r.partnerUserId ? `partner: ${r.partnerUserId.slice(0, 8)}…` : '',
  }));
}

function deriveApplicantName(r: RegistrationEntry): string {
  const given = (r.applicantGivenName ?? '').trim();
  const family = (r.applicantFamilyName ?? '').trim();
  const full = [given, family].filter(Boolean).join(' ');
  if (full) return r.applicantEmail ? `${full} <${r.applicantEmail}>` : full;
  if (r.applicantEmail) return r.applicantEmail;
  return r.userId ? `user:${r.userId.slice(0, 8)}…` : '(unknown)';
}
