/**
 * Draw Sheet PDF Generator — uses pdf-factory
 *
 * Generates PDFs for tournament draws using getEventData/drawsData pipeline.
 * Context-sensitive: detects draw type and routes to the appropriate renderer.
 */

import { tournamentEngine } from 'tods-competition-factory';
import {
  structureToDrawData,
  findStructure,
  generateTraditionalDrawPDF,
  generateSplitDrawPDF,
  generateConsolationDrawPDF,
  generateDoubleEliminationPDF,
  generateBackdrawPDF,
  generateMirroredDrawPDF,
} from 'pdf-factory';
import { openPDF, savePDF } from '../export/pdfExport';

interface DrawPDFOptions {
  drawTitle?: string;
  includeSeeding?: boolean;
  includeTimestamp?: boolean;
  includeOrganizers?: boolean;
  catalogPreset?: string;
  headerLayout?: string;
  footerLayout?: string;
  mirrored?: boolean;
  backdraw?: boolean;
  splitPages?: boolean;
}

interface GenerateDrawPDFParams {
  tournament?: any;
  event?: any;
  drawDefinition?: any;
  drawId?: string;
  eventId?: string;
  structureId?: string;
  options?: DrawPDFOptions;
  action?: 'open' | 'download';
}

/**
 * Generate a PDF for a draw structure.
 *
 * Uses getEventData() → drawsData pipeline for all draw data.
 * Automatically detects draw type (single elimination, consolation,
 * double elimination, feed-in, etc.) and routes to the correct renderer.
 */
export function generateDrawPDF({
  tournament,
  event,
  drawId,
  structureId,
  options = {},
  action = 'download',
}: GenerateDrawPDFParams): void {
  const { drawTitle, includeTimestamp = true, catalogPreset, headerLayout, footerLayout } = options;

  // Get eventData via the standard pipeline
  const { eventData } = tournamentEngine.getEventData({ drawId }) as any;
  if (!eventData?.drawsData?.length) return;

  const tournamentInfo = eventData.tournamentInfo || tournament || {};
  const eventInfo = eventData.eventInfo || event || {};

  // Build header from tournament/event info
  const header: any = {
    layout: headerLayout || 'itf',
    tournamentName: drawTitle || tournamentInfo.tournamentName || eventInfo.eventName || 'Tournament',
    subtitle: eventInfo.eventName,
    startDate: tournamentInfo.startDate,
    endDate: tournamentInfo.endDate,
    location: tournamentInfo.venues?.[0]?.venueName,
    city: tournamentInfo.venues?.[0]?.city,
    country: tournamentInfo.hostCountryCode,
    surface: eventInfo.surfaceCategory,
  };

  const footer: any = {
    layout: footerLayout || 'standard',
    showPageNumbers: true,
    showTimestamp: includeTimestamp,
  };

  const pdfOpts = { header, footer, preset: catalogPreset || 'itfJunior' };

  // Detect draw type from structures
  const structures = eventData.drawsData[0].structures || [];
  const hasConsolation = structures.some((s: any) => s.stage === 'CONSOLATION');
  const hasPlayOff = structures.some((s: any) => s.stage === 'PLAY_OFF');
  const mainStruct = structures.find((s: any) => s.stage === 'MAIN');

  let doc;

  // Mirrored bracket (NCAA)
  if (options.mirrored && mainStruct) {
    doc = generateMirroredDrawPDF(structureToDrawData(mainStruct), pdfOpts);
  }
  // Backdraw (USTA Playback — FIRST_ROUND_LOSER_CONSOLATION)
  else if (options.backdraw && hasConsolation && mainStruct) {
    doc = generateBackdrawPDF(
      {
        mainDraw: structureToDrawData(mainStruct),
        consolation: structureToDrawData(findStructure(eventData.drawsData, 'CONSOLATION')),
      },
      pdfOpts,
    );
  }
  // Double elimination (MAIN + CONSOLATION + PLAY_OFF)
  else if (hasConsolation && hasPlayOff) {
    doc = generateDoubleEliminationPDF(
      {
        winnersBracket: mainStruct ? structureToDrawData(mainStruct) : emptyDraw(),
        losersBracket: findStructure(eventData.drawsData, 'CONSOLATION')
          ? structureToDrawData(findStructure(eventData.drawsData, 'CONSOLATION'))
          : emptyDraw(),
        deciderMatch: findStructure(eventData.drawsData, 'PLAY_OFF')
          ? structureToDrawData(findStructure(eventData.drawsData, 'PLAY_OFF'))
          : undefined,
      },
      pdfOpts,
    );
  }
  // Consolation (MAIN + CONSOLATION)
  else if (hasConsolation) {
    const consolStructures = structures.map((s: any) => ({
      name: s.structureName,
      stage: s.stage,
      drawData: structureToDrawData(s),
    }));
    doc = generateConsolationDrawPDF(consolStructures, pdfOpts);
  }
  // Specific structure requested
  else if (structureId) {
    const targetStruct = structures.find((s: any) => s.structureId === structureId) || mainStruct;
    if (targetStruct) {
      const drawData = structureToDrawData(targetStruct);
      doc = options.splitPages ? generateSplitDrawPDF(drawData, pdfOpts) : generateTraditionalDrawPDF(drawData, pdfOpts);
    }
  }
  // Single structure — auto-detect
  else if (mainStruct) {
    const drawData = structureToDrawData(mainStruct);
    doc = generateTraditionalDrawPDF(drawData, pdfOpts);
  }

  if (!doc) return;

  const filename = `${(header.tournamentName || 'draw').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

  if (action === 'open') {
    openPDF({ doc });
  } else {
    savePDF({ doc, filename });
  }
}

function emptyDraw() {
  return { drawName: '', drawSize: 0, drawType: '', totalRounds: 0, slots: [], matchUps: [], seedAssignments: [] };
}
