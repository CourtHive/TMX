/**
 * Draw Sheet PDF Generator
 * Generates PDF documents for tournament draws
 */
import { savePDF, openPDF } from '../export/pdfExport';
import { formatDate } from '../utils/primitives';
import { renderDrawToPNG, canRenderDraw } from '../utils/drawRenderer';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

interface DrawPDFOptions {
  drawTitle?: string;
  includeSeeding?: boolean;
  includeRankings?: boolean;
  includeTimestamp?: boolean;
  includeOrganizers?: boolean;
}

interface GenerateDrawPDFParams {
  tournament?: any;
  event: any;
  drawDefinition: any;
  structureId?: string;
  options?: DrawPDFOptions;
  action?: 'open' | 'download';
}

/**
 * Generate a PDF for a draw
 */
export async function generateDrawPDF({
  tournament,
  event,
  drawDefinition,
  structureId,
  options = {},
  action = 'download',
}: GenerateDrawPDFParams): Promise<void> {
  const {
    drawTitle = drawDefinition.drawName || event.eventName,
    includeSeeding = true,
    includeTimestamp = true,
    includeOrganizers = true,
  } = options;

  // Try to render the draw
  let drawImageDataURI: string | undefined;
  const canRender = canRenderDraw(drawDefinition.drawId, structureId);
  
  if (canRender) {
    try {
      drawImageDataURI = await renderDrawToPNG({
        drawId: drawDefinition.drawId,
        structureId,
        width: 1600,
        height: 10000, // Very tall to capture full draw
      });
    } catch (error) {
      console.error('Error rendering draw to PNG:', error);
      // Continue without draw image
    }
  }

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageOrientation: 'portrait',
    pageMargins: [20, 40, 20, 40], // Smaller margins for more space

    content: [
      // Header
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: tournament?.tournamentName || event.eventName || 'Tournament',
                style: 'tournamentName',
              },
              {
                text: formatDate(tournament?.startDate || event.startDate || new Date()),
                style: 'tournamentDate',
              },
            ],
          },
          // Space for logo (future)
          {
            width: 80,
            text: '',
          },
        ],
      },
      {
        text: drawTitle,
        style: 'drawTitle',
        alignment: 'center',
        margin: [0, 10, 0, 20],
      },

      // Event details - compact inline format
      {
        text: [
          { text: 'Event: ', bold: true },
          { text: event.eventName || '' },
          { text: ' | Category: ', bold: true },
          { text: event.category?.categoryName || '' },
          { text: ' | Draw Size: ', bold: true },
          { text: drawDefinition.drawSize || '' },
        ],
        fontSize: 9,
        margin: [0, 5, 0, 10],
      },

      // Draw content
      ...(drawImageDataURI
        ? [
            {
              image: drawImageDataURI,
              width: 550, // Full width in portrait
              alignment: 'center',
              margin: [0, 10, 0, 10],
            },
          ]
        : [
            {
              text: '[Draw Bracket]',
              alignment: 'center',
              fontSize: 14,
              italics: true,
              color: '#999',
              margin: [0, 40, 0, 40],
            },
            {
              text: 'Unable to render draw bracket. Ensure draw has participants and matches.',
              alignment: 'center',
              fontSize: 10,
              color: '#666',
              margin: [0, 0, 0, 40],
            },
          ]),

      // Seeding information (if enabled)
      ...(includeSeeding ? getSeededPlayersContent() : []),

      // Footer information
      ...(includeTimestamp
        ? [
            {
              text: `Generated: ${new Date().toLocaleString()}`,
              fontSize: 8,
              color: '#666',
              margin: [0, 20, 0, 0],
            },
          ]
        : []),
      ...(includeOrganizers && tournament?.organizers
        ? [
            {
              text: `Organizers: ${tournament.organizers}`,
              fontSize: 8,
              color: '#666',
            },
          ]
        : []),
    ],

    styles: {
      tournamentName: {
        fontSize: 16,
        bold: true,
      },
      tournamentDate: {
        fontSize: 10,
        color: '#666',
      },
      drawTitle: {
        fontSize: 18,
        bold: true,
      },
      label: {
        fontSize: 10,
        bold: true,
        color: '#666',
      },
      value: {
        fontSize: 10,
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      seededPlayer: {
        fontSize: 9,
      },
    },
  };

  // Execute action based on parameter
  if (action === 'open') {
    await openPDF({ docDefinition });
  } else {
    const filename = `${drawTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    await savePDF({ docDefinition, filename });
  }
}

/**
 * Get seeded players content for PDF
 */
function getSeededPlayersContent(): any[] {
  // TODO: Extract seeded participants from drawDefinition
  // For now, return placeholder
  
  const content = [
    {
      text: 'Seeded Players',
      style: 'sectionHeader',
    },
    {
      text: 'Seeded players list will be populated from draw data.',
      fontSize: 9,
      italics: true,
      color: '#999',
      margin: [0, 5, 0, 0],
    },
  ];

  // Example of how seeded players would be displayed:
  // const seededPlayers = extractSeededParticipants(drawDefinition);
  // if (seededPlayers.length > 0) {
  //   content.push({
  //     ol: seededPlayers.map(p => {
  //       const name = fullName(p.participant);
  //       const ranking = includeRankings ? ` [${p.ranking || 'NR'}]` : '';
  //       return `${name}${ranking}`;
  //     }),
  //     fontSize: 9,
  //   });
  // }

  return content;
}

/**
 * Extract seeded participants from draw definition
 * TODO: Implement when integrating with factory data
 */
// function extractSeededParticipants(drawDefinition: any): any[] {
//   // Get all participants from structures
//   // Filter for seeded participants
//   // Sort by seed number
//   // Return formatted list
//   return [];
// }
