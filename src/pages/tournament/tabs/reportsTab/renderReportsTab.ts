import { tournamentEngine } from 'tods-competition-factory';
import { createReportsTable } from './createReportsTable';
import { exportReportPDF } from './exportReportPDF';
import { downloadJSON } from 'services/export/download';
import { downloadText } from 'services/export/download';
import { controlBar } from 'courthive-components';
import { env } from 'settings/env';
import axios from 'axios';

import { LEFT, REPORTS_CONTROL, RIGHT, TOURNAMENT_REPORTS } from 'constants/tmxConstants';

let activeReport: any;
let activeReportName = '';

export function renderReportsTab(): void {
  const reportContainer = document.getElementById(TOURNAMENT_REPORTS);
  const controlTarget = document.getElementById(REPORTS_CONTROL);
  if (!reportContainer || !controlTarget) return;

  reportContainer.innerHTML = '';
  controlTarget.innerHTML = '';

  const result: any = tournamentEngine.getAvailableReports();
  const reports = (result?.availableReports ?? []).filter((r: any) => r.computableNow);

  if (!reports.length) {
    reportContainer.innerHTML = `<div style="padding: 2em; color: var(--tmx-text-secondary);">No reports available for this tournament.</div>`;
    return;
  }

  const reportOptions = reports.map((r: any) => ({
    label: r.name,
    value: r.reportId,
    onClick: () => selectReport(r),
  }));

  const items = [
    {
      options: reportOptions,
      label: reports[0].name,
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
  ];

  controlBar({ target: controlTarget, items });

  // Auto-select first report
  selectReport(reports[0]);
}

async function selectReport(report: any): Promise<void> {
  const { reportId, name, source } = report;
  activeReportName = name;

  if (source === 'server') {
    await fetchServerReport(reportId);
  } else {
    const result: any = tournamentEngine.generateReport({ reportId });
    if (result.error) return;
    activeReport = { columns: result.columns, rows: result.rows };
    createReportsTable({ columns: result.columns, rows: result.rows });
  }
}

async function fetchServerReport(reportId: string): Promise<void> {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId) return;

  const baseUrl = env.auditWorkerUrl || `${globalThis.location?.origin?.replace(/:\d+$/, '')}:8385`;
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
