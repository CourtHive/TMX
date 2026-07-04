import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { downloadJSON, downloadText } from 'services/export/download';
import { openStructureAuditModal } from './structureAudit';
import { resolveAuditBaseUrl } from './resolveAuditBaseUrl';
import { tournamentEngine } from 'services/factory/engine';
import { createReportsTable } from './createReportsTable';
import { exportReportPDF } from './exportReportPDF';
import { controlBar } from 'courthive-components';
import { context } from 'services/context';
import { env } from 'settings/env';
import axios from 'axios';

import { LEFT, REPORTS_CONTROL, REPORTS_TAB, RIGHT, TOURNAMENT, TOURNAMENT_REPORTS } from 'constants/tmxConstants';

let activeReport: any;
let activeReportName = '';

// Remembers the last report the user viewed so it re-opens across tab/tournament
// navigation instead of always resetting to the first report.
const SELECTED_REPORT_KEY = 'tmx_selectedReport';
const getStoredReportId = (): string | null => {
  try {
    return localStorage.getItem(SELECTED_REPORT_KEY);
  } catch {
    return null;
  }
};
const storeReportId = (reportId: string): void => {
  try {
    localStorage.setItem(SELECTED_REPORT_KEY, reportId);
  } catch {
    /* localStorage unavailable (private mode / quota) — selection just won't persist */
  }
};

// Reflect the current report in the URL (…/reports/:reportId) so it can be
// bookmarked and deep-linked. Replace (not push) and skip the route handler so
// updating the address bar never re-renders the tab.
const syncReportUrl = (reportId: string): void => {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  if (!tournamentId) return;
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${REPORTS_TAB}/${reportId}`, {
    callHandler: false,
    historyAPIMethodName: 'replaceState',
    updateBrowserURL: true,
  });
};

// admin/director-only structure-integrity audit launcher for the reports control bar
const auditControlItem = () => ({
  onClick: () => openStructureAuditModal(),
  label: 'Audit',
  intent: 'is-warning',
  location: RIGHT,
  id: 'structureAudit',
});

export function renderReportsTab(options: { reportId?: string } = {}): void {
  const reportContainer = document.getElementById(TOURNAMENT_REPORTS);
  const controlTarget = document.getElementById(REPORTS_CONTROL);
  if (!reportContainer || !controlTarget) return;

  reportContainer.innerHTML = '';
  controlTarget.innerHTML = '';

  const result: any = tournamentEngine.getAvailableReports();
  const reports = (result?.availableReports ?? []).filter((r: any) => r.computableNow);
  const canAudit = isActiveProviderAdmin();

  if (!reports.length) {
    // admins/directors can still run the structure audit even when no data reports compute
    if (canAudit) controlBar({ target: controlTarget, items: [auditControlItem()] });
    reportContainer.innerHTML = `<div style="padding: 2em; color: var(--tmx-text-secondary);">No reports available for this tournament.</div>`;
    return;
  }

  // Initial selection priority: an explicit report id from the URL (deep link),
  // then the last-viewed report from localStorage, then the first available.
  const findById = (id?: string | null) => (id ? reports.find((r: any) => r.reportId === id) : undefined);
  const initialReport = findById(options.reportId) ?? findById(getStoredReportId()) ?? reports[0];

  const reportOptions = reports.map((r: any) => ({
    label: r.name,
    value: r.reportId,
    close: true,
    onClick: () => selectReport(r),
  }));

  const items = [
    {
      options: reportOptions,
      label: initialReport.name,
      modifyLabel: true,
      intent: 'is-info',
      location: LEFT,
      id: 'reportSelector',
    },
    {
      onClick: () => activeReport && exportReportPDF({ ...activeReport, reportName: activeReportName }),
      label: 'PDF',
      intent: 'is-info',
      location: RIGHT,
      id: 'exportPDF',
    },
    {
      onClick: () => activeReport && exportCSV(activeReport, activeReportName),
      label: 'CSV',
      intent: 'is-info',
      location: RIGHT,
      id: 'exportCSV',
    },
    {
      onClick: () => activeReport && downloadJSON(`${activeReportName}.json`, activeReport),
      label: 'JSON',
      intent: 'is-info',
      location: RIGHT,
      id: 'exportJSON',
    },
    ...(canAudit ? [auditControlItem()] : []),
  ];

  controlBar({ target: controlTarget, items });

  // Open the restored (or first) report.
  selectReport(initialReport);
}

async function selectReport(report: any): Promise<void> {
  const { reportId, name, source } = report;
  activeReportName = name;
  storeReportId(reportId);
  syncReportUrl(reportId);

  if (source === 'server') {
    await fetchServerReport(reportId);
  } else {
    const result: any = tournamentEngine.generateReport({ reportId });
    if (result.error) return;
    localizeReportTimes(result.rows);
    activeReport = { columns: result.columns, rows: result.rows };
    createReportsTable({ columns: result.columns, rows: result.rows });
  }
}

/**
 * Recompute any UTC timestamps a report carries (rows with a `calledAtIso`
 * field, e.g. Call Timing Variance) into the operator's local wall-clock —
 * which on-site is the venue timezone. Doing this in the browser uses the
 * runtime's own tz (DST-correct) instead of a passed offset, so the displayed
 * clock and variance always match what the director actually saw.
 *
 * `calledAt` becomes a bare HH:mm (date-prefixed only when the call landed on a
 * different calendar day than the scheduled date); `varianceMinutes` is the
 * signed difference between the actual call instant and the planned local time.
 */
function localizeReportTimes(rows: Record<string, any>[]): void {
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const row of rows ?? []) {
    if (!row.calledAtIso) continue;
    const called = new Date(row.calledAtIso);
    if (Number.isNaN(called.getTime())) continue;

    const localDate = `${called.getFullYear()}-${pad(called.getMonth() + 1)}-${pad(called.getDate())}`;
    const localTime = `${pad(called.getHours())}:${pad(called.getMinutes())}`;
    row.calledAt = localDate === row.scheduledDate ? localTime : `${localDate} ${localTime}`;

    if (row.scheduledDate && row.scheduledTime) {
      // No trailing "Z" ⇒ parsed as local wall-clock, matching the venue plan.
      const planned = new Date(`${row.scheduledDate}T${row.scheduledTime}:00`);
      if (!Number.isNaN(planned.getTime())) {
        // Compare at whole-minute resolution so the number agrees with the HH:mm
        // shown: a call at 15:05:45 displays as 15:05, so 15:00 → 15:05 reads as
        // 5, not 6 (which a seconds-aware round would give).
        row.varianceMinutes = Math.floor(called.getTime() / 60000) - Math.floor(planned.getTime() / 60000);
      }
    }
  }
}

async function fetchServerReport(reportId: string): Promise<void> {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId) return;

  const baseUrl = resolveAuditBaseUrl(globalThis.location?.origin ?? '', env.auditWorkerUrl);
  const reportType = reportId;

  const reportContainer = document.getElementById(TOURNAMENT_REPORTS);
  if (reportContainer) reportContainer.innerHTML = '<div style="padding: 2em;">Loading audit data...</div>';

  try {
    const response = await axios.post(`${baseUrl}/condense/${tournamentId}/${reportType}`);
    const data = response?.data;
    if (data?.columns && data?.rows) {
      activeReport = { columns: data.columns, rows: data.rows };
      createReportsTable({ columns: data.columns, rows: data.rows });
    } else {
      if (reportContainer) reportContainer.innerHTML = '<div style="padding: 2em; color: var(--tmx-text-secondary);">No audit data available.</div>';
    }
  } catch (err: any) {
    console.warn('[reports] audit-worker fetch failed:', err.message);
    if (reportContainer) reportContainer.innerHTML = '<div style="padding: 2em; color: var(--tmx-accent-red);">Audit worker unavailable. Ensure the audit worker is running.</div>';
  }
}

function exportCSV(report: { columns: any[]; rows: any[] }, reportName: string): void {
  const header = report.columns.map((c: any) => c.title).join(',');
  const csvRows = report.rows.map((row: any) =>
    report.columns
      .map((c: any) => {
        let val = row[c.key] ?? '';
        val = String(val);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      })
      .join(','),
  );
  const csv = [header, ...csvRows].join('\n');
  downloadText(`${reportName}.csv`, csv);
}
