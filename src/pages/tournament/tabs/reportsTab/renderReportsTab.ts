import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { downloadJSON, downloadText } from 'services/export/download';
import { openStructureAuditModal } from './structureAudit';
import { resolveAuditBaseUrl } from './resolveAuditBaseUrl';
import { tournamentEngine } from 'services/factory/engine';
import { createReportsTable } from './createReportsTable';
import { exportReportPDF } from './exportReportPDF';
import { controlBar } from 'courthive-components';
import { env } from 'settings/env';
import axios from 'axios';

import { LEFT, REPORTS_CONTROL, RIGHT, TOURNAMENT_REPORTS } from 'constants/tmxConstants';

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

// admin/director-only structure-integrity audit launcher for the reports control bar
const auditControlItem = () => ({
  onClick: () => openStructureAuditModal(),
  label: 'Audit',
  intent: 'is-warning',
  location: RIGHT,
  id: 'structureAudit',
});

export function renderReportsTab(): void {
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

  // Restore the previously selected report if it's still available; otherwise
  // fall back to the first.
  const storedReportId = getStoredReportId();
  const initialReport = reports.find((r: any) => r.reportId === storedReportId) ?? reports[0];

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
        row.varianceMinutes = Math.round((called.getTime() - planned.getTime()) / 60000);
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
