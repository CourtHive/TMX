/**
 * Schedule PDF Generator
 * Generates PDF schedules using pdfMake native elements (tables, text)
 * Based on TMX-Suite-Legacy schedule PDF implementation
 */
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
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
 * Generate schedule PDF
 */
export async function generateSchedulePDF(params: ScheduleGeneratorOptions): Promise<void> {
  const { tournament, scheduledDate, courts, rows, options, action } = params;



  // Determine orientation based on court count and user preference
  const pageOrientation = (courts.length >= 5 || options.landscape) ? 'landscape' : 'portrait';
  const portrait = pageOrientation === 'portrait';

  // Create column headers for courts
  const columnHeaders = createColumnHeaders(courts, options.fullCourtNames);
  
  // Convert grid rows to PDF rows (rows already organized by competitionEngine)
  const allPdfRows = convertGridRowsToPDFRows(rows, courts);
  
  // Filter out completely empty rows (rows with no matchUps at all)
  const pdfRows = allPdfRows.filter(row => 
    row.some(cell => cell && Object.keys(cell).length > 0 && cell.matchUpId)
  );
  


  // Build the schedule table
  const scheduleTable = {
    table: {
      widths: ['*'],
      headerRows: 1,
      body: [
        [createHeaderRow(columnHeaders)],
        ...pdfRows.map((row, index) => [createMatchRow(index + 1, row)]),
      ],
    },
    layout: 'noBorders',
  };

  const content = [scheduleTable];

  // Font sizes based on orientation
  const teamFontSize = portrait ? 10 : 8;
  const headerMargin = options.includeHeader ? 80 : 0;
  const footerMargin = options.includeFooter ? 50 : 0;

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageOrientation,
    pageMargins: [20, headerMargin, 20, footerMargin],

    content,

    header: options.includeHeader
      ? () => createScheduleHeader(tournament, scheduledDate)
      : undefined,

    footer: options.includeFooter
      ? createScheduleFooter(tournament, scheduledDate)
      : undefined,

    styles: {
      docTitle: { fontSize: 12, bold: true },
      subtitle: { fontSize: 10, italics: true, bold: true },
      docName: { alignment: 'center', fontSize: 10, bold: true },
      tableHeader: { fontSize: 9 },
      tableData: { fontSize: 9, bold: true },
      headerNotice: { fontSize: 9, bold: true, italics: true, color: 'red' },
      teamName: { alignment: 'center', fontSize: teamFontSize - 1, bold: true },
      centeredText: { alignment: 'center', fontSize: 9, bold: false },
      centeredItalic: { alignment: 'center', fontSize: 8, bold: false, italics: true },
      centeredTableHeader: { alignment: 'center', fontSize: 9, bold: true },
    },
  };

  // Generate and output PDF
  const fileName = `Schedule_${scheduledDate}.pdf`;

  if (action === 'open') {
    await openPDF({ docDefinition });
  } else {
    await savePDF({ docDefinition, filename: fileName });
  }
}

/**
 * Convert grid rows to PDF rows
 * Grid rows from competitionEngine already have matchUps organized by court columns
 * Court keys are in format: C|0, C|1, C|2, etc. (sequential indices)
 */
function convertGridRowsToPDFRows(gridRows: any[], courts: any[]): any[][] {
  return gridRows.map((gridRow) => {
    // Extract matchUp for each court using sequential index
    const rowCells = courts.map((_court, courtIndex) => {
      const courtKey = `C|${courtIndex}`;
      const matchUp = gridRow[courtKey];
      return matchUp || {};
    });
    return rowCells;
  });
}

/**
 * Create column headers for courts
 */
function createColumnHeaders(courts: any[], fullNames: boolean): string[] {
  const minimumColumns = courts.length < 5 ? 1 : 8;
  const headers = new Array(Math.max(minimumColumns, courts.length)).fill('');
  
  courts.forEach((court, index) => {
    headers[index] = fullNames
      ? (court.courtName || court.name || '')
      : (court.courtName || court.name || '').split(' ')[0];
  });

  return headers;
}



/**
 * Create header row with court names
 */
function createHeaderRow(courtNames: string[]): any {
  const headerCells = courtNames.map(name => ({
      table: {
        widths: ['*'],
        body: [[{ text: name || ' ', style: 'centeredTableHeader', margin: [0, 0, 0, 0] }]],
      },
      layout: 'noBorders',
    }));

  const cells = [{ text: ' ', width: 30 }, ...headerCells];
  const widths = [30, ...courtNames.map(() => '*' as const)];

  return {
    table: {
      widths,
      body: [cells],
    },
    layout: 'noBorders',
  };
}

/**
 * Create a match row
 */
function createMatchRow(roundNumber: number, cells: any[]): any {
  const cellsArray = cells.map(matchUp => createMatchCell(matchUp));
  const matchCells = [{ stack: [createMatchCell({ oop: roundNumber })], width: 30 }, ...cellsArray];
  const widths = [30, ...cells.map(() => '*' as const)];

  return {
    unbreakable: true, // Prevent page breaks within match rows
    table: {
      widths,
      body: [matchCells],
    },
    layout: {
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      // All borders
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0,
      vLineWidth: () => 1, // All vertical lines
      hLineColor: () => '#999999',
      vLineColor: () => '#999999',
    },
  };
}

/**
 * Create a single match cell
 */
function createMatchCell(matchUp: any): any {
  // Round number cell (for first column)
  if (matchUp?.oop !== undefined) {
    return {
      table: {
        widths: ['*'],
        body: [
          [{ text: matchUp.oop || ' ', style: 'centeredText', margin: [0, 0, 0, 0] }],
        ],
      },
      layout: {
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
        hLineWidth: () => 0,
        vLineWidth: () => 0,
      },
    };
  }
  
  // Empty cell - no matchUpId means no match scheduled
  if (!matchUp?.matchUpId) {
    return {
      table: {
        widths: ['*'],
        body: [
          [{ text: ' ', style: 'centeredText', margin: [0, 0, 0, 0] }],
        ],
      },
      layout: {
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
        hLineWidth: () => 0,
        vLineWidth: () => 0,
      },
    };
  }

  // Extract match details
  const scheduledTime = matchUp.schedule?.scheduledTime || '';
  const timeModifiers = matchUp.schedule?.timeModifiers || [];
  const timeModifierText = timeModifiers[0] || '';
  
  // Format time display
  let timeDisplay = '';
  if (timeModifierText) {
    // Map time modifier codes to display text
    const modifierMap: Record<string, string> = {
      'FOLLOWED_BY': 'Followed by',
      'NOT_BEFORE': 'Not before',
      'AFTER_REST': 'After rest',
    };
    const modifierDisplay = modifierMap[timeModifierText] || timeModifierText;
    timeDisplay = scheduledTime ? `${modifierDisplay} ${scheduledTime}` : modifierDisplay;
  } else {
    timeDisplay = scheduledTime;
  }
  
  const roundName = matchUp.roundName || '';
  const eventName = matchUp.eventName || '';
  const category = matchUp.category?.categoryName || '';
  
  // Get participant names - handle both actual participants and potentials
  const getPotentialName = (participant: any) =>
    participant?.person?.standardFamilyName?.toUpperCase() || participant?.participantName || '';
  
  const potentialParticipants = matchUp.potentialParticipants || [];
  
  // Create array of potential strings for each side
  const potentialsArray = potentialParticipants.map((potential: any) => {
    if (!potential || !Array.isArray(potential)) return '';
    const names = potential.map(getPotentialName).filter(Boolean);
    return names.join(' or ');
  });
  
  const getParticipantName = (sideNumber: number) => {
    const side = matchUp.sides?.find((s: any) => s.sideNumber === sideNumber);
    return side?.participant?.participantName || '';
  };
  
  const side1 = getParticipantName(1) || potentialsArray[0] || 'TBD';
  const side2 = getParticipantName(2) || potentialsArray[1] || 'TBD';
  
  // Check if participants contain "or" (are potentials)
  const side1HasOr = side1.includes(' or ');
  const side2HasOr = side2.includes(' or ');
  
  const score = matchUp.score?.scoreStringSide1 || '';
  const x = ' ';
  
  // If we have a matchUpId, we always render (even if no participants yet)
  
  return {
    table: {
      widths: ['*'],
      body: [
        [{ text: timeDisplay || x, style: 'centeredText', margin: [0, 1, 0, 1], border: [false, false, false, false] }],
        [{ text: `${eventName} ${roundName}` || x, style: 'centeredItalic', margin: [0, 1, 0, 1], border: [false, false, false, false] }],
        [{ text: category || x, style: 'centeredText', margin: [0, 1, 0, 1], border: [false, false, false, false] }],
        [{ text: side1 || x, style: 'teamName', margin: [0, 1, 0, 1], border: [false, false, false, false], color: side1HasOr ? '#555555' : undefined }],
        [{ text: (side1 && side2) ? 'vs.' : x, style: 'centeredText', margin: [0, 1, 0, 1], border: [false, false, false, false] }],
        [{ text: side2 || x, style: 'teamName', margin: [0, 1, 0, 1], border: [false, false, false, false], color: side2HasOr ? '#555555' : undefined }],
        [{ text: x, style: 'centeredText', margin: [0, 0, 0, 0], border: [false, false, false, false] }],
        [{ text: score || x, style: 'centeredText', margin: [0, 1, 0, 1], border: [false, false, false, false] }],
      ],
    },
    layout: {
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 1,
      paddingBottom: () => 1,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
  };
}

/**
 * Create schedule header
 */
function createScheduleHeader(tournament: any, scheduledDate: string): any {
  const tournamentName = tournament.tournamentName || '';
  const organization = tournament.organizationName || '';
  
  return {
    margin: [20, 10, 20, 10],
    fontSize: 10,
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          { text: tournamentName, colSpan: 3, style: 'docTitle', margin: [0, 0, 0, 5] },
          {},
          {},
        ],
        [
          { text: 'Order of Play', colSpan: 3, style: 'docName', margin: [0, 0, 0, 5] },
          {},
          {},
        ],
        [
          { text: scheduledDate, colSpan: 3, style: 'centeredText', margin: [0, 0, 0, 5] },
          {},
          {},
        ],
        [
          { text: organization || '', style: 'tableData' },
          {},
          {},
        ],
      ],
    },
    layout: 'noBorders',
  };
}

/**
 * Create schedule footer
 */
function createScheduleFooter(tournament: any, scheduledDate: string): any {
  return {
    margin: [20, 10, 20, 10],
    text: `${tournament.tournamentName || ''} - ${scheduledDate}`,
    alignment: 'center',
    fontSize: 9,
  };
}
