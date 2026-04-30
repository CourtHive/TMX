/**
 * Schedule PDF Generator — uses pdf-factory
 *
 * Generates OOP/schedule PDFs from TMX schedule grid data.
 */

import { generateOrderOfPlayPDF } from 'pdf-factory';
import { openPDF, savePDF } from '../export/pdfExport';

interface ScheduleGeneratorOptions {
  tournament: any;
  scheduledDate: string;
  courts: any[];
  rows: any[];
  options: {
    includeHeader: boolean;
    includeFooter: boolean;
    landscape: boolean;
    fullCourtNames: boolean;
  };
  action: 'open' | 'save';
}

/**
 * Generate schedule PDF from TMX grid data.
 */
export function generateSchedulePDF(params: ScheduleGeneratorOptions): void {
  const { tournament, scheduledDate, courts, rows, options, action } = params;

  // Convert TMX grid rows to pdf-factory ScheduleData
  const courtNames = courts.map((c: any) =>
    options.fullCourtNames ? c.courtName || c.name || '' : (c.courtName || c.name || '').split(' ')[0],
  );

  const timeSlotMap = new Map<string, any[]>();

  for (const gridRow of rows) {
    for (let ci = 0; ci < courts.length; ci++) {
      const courtKey = `C|${ci}`;
      const mu = gridRow[courtKey];
      if (!mu?.matchUpId) continue;

      const time = mu.schedule?.scheduledTime || '00:00';
      const notBefore = mu.schedule?.timeModifiers?.includes('NOT_BEFORE');

      if (!timeSlotMap.has(time)) timeSlotMap.set(time, []);
      timeSlotMap.get(time)!.push({
        courtName: courtNames[ci],
        scheduledTime: time,
        eventName: mu.eventName || '',
        eventAbbr: (mu.eventName || '').split(' ').map((w: string) => w[0]).join(''),
        roundName: mu.roundName || '',
        side1: extractSide(mu, 1),
        side2: extractSide(mu, 2),
        score: mu.score?.scoreStringSide1,
        matchUpStatus: mu.matchUpStatus,
        notBeforeTime: notBefore ? time : undefined,
      });
    }
  }

  const sortedTimes = [...timeSlotMap.keys()].sort();
  const scheduleData = {
    scheduledDate,
    courts: courtNames,
    timeSlots: sortedTimes.map((time) => ({
      time,
      label: formatTime(time),
      matches: timeSlotMap.get(time) || [],
    })),
  };

  const orientation = courts.length >= 5 || options.landscape ? 'landscape' : 'portrait';

  const doc = generateOrderOfPlayPDF(scheduleData, {
    header: options.includeHeader
      ? {
          layout: 'itf',
          tournamentName: tournament.tournamentName || 'Tournament',
          subtitle: `ORDER OF PLAY — ${scheduledDate}`,
          startDate: tournament.startDate,
          location: tournament.organizationName,
        }
      : undefined,
    footer: options.includeFooter
      ? { layout: 'standard', showPageNumbers: true, showTimestamp: true }
      : undefined,
    page: { orientation },
    cellStyle: 'detailed',
  });

  const filename = `Schedule_${scheduledDate}.pdf`;

  if (action === 'open') {
    openPDF({ doc });
  } else {
    savePDF({ doc, filename });
  }
}

function extractSide(mu: any, sideNumber: number): { name: string; nationality: string } {
  const side = mu.sides?.find((s: any) => s.sideNumber === sideNumber);
  if (side?.participant) {
    return {
      name: side.participant.participantName || '',
      nationality: side.participant.nationalityCode || '',
    };
  }
  return { name: '', nationality: '' };
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}
