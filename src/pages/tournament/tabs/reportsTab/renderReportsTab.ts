import { tournamentEngine } from 'tods-competition-factory';
import { createReportsTable } from './createReportsTable';
import { exportReportPDF } from './exportReportPDF';
import { downloadJSON } from 'services/export/download';
import { downloadText } from 'services/export/download';
import { controlBar } from 'courthive-components';

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
    onClick: () => selectReport(r.reportId, r.name),
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
  selectReport(reports[0].reportId, reports[0].name);
}

function selectReport(reportId: string, reportName: string): void {
  const result: any = tournamentEngine.generateReport({ reportId });
  if (result.error) return;

  activeReport = { columns: result.columns, rows: result.rows };
  activeReportName = reportName;
  createReportsTable({ columns: result.columns, rows: result.rows });
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
