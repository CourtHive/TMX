import { generateReportPDF } from 'pdf-factory';
import { tournamentEngine } from 'tods-competition-factory';
import { openPDF } from 'services/pdf/export/pdfExport';

// ID fields that should not appear in printed PDFs — only names
const HIDDEN_PDF_FIELDS = ['participantId', 'eventId', 'drawId', 'structureId'];

export function exportReportPDF({
  columns,
  rows,
  reportName,
}: {
  columns: any[];
  rows: Record<string, any>[];
  reportName: string;
}): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo() as any;

  const printColumns = columns.filter((c) => !HIDDEN_PDF_FIELDS.includes(c.key));

  const doc = generateReportPDF(printColumns, rows, {
    header: {
      tournamentName: tournamentInfo?.tournamentName || '',
      startDate: tournamentInfo?.startDate,
      endDate: tournamentInfo?.endDate,
      subtitle: reportName,
    },
  });

  openPDF({ doc });
}
