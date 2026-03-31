/**
 * Print Match Cards — generates umpire scorecards for selected matchUps
 */
import { tournamentEngine } from 'tods-competition-factory';
import { generateMatchCardPDF } from 'pdf-factory';
import type { MatchCardData } from 'pdf-factory';
import { openPDF, savePDF } from 'services/pdf/export/pdfExport';

interface PrintMatchCardsParams {
  matchUpIds: string[];
  drawId: string;
  action?: 'open' | 'download';
}

/**
 * Generate match cards for one or more matchUps.
 *
 * Can be called from:
 * - Individual matchUp context menu ("Print Match Card")
 * - Round header menu ("Print Round Match Cards")
 * - Bulk selection
 */
export function printMatchCards({ matchUpIds, action = 'open' }: PrintMatchCardsParams): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournament = tournamentInfoResult?.tournamentInfo;

  const { matchUps } = tournamentEngine.allTournamentMatchUps();
  const targetMatchUps = matchUps.filter((mu: any) => matchUpIds.includes(mu.matchUpId));

  if (!targetMatchUps.length) return;

  const cards: MatchCardData[] = targetMatchUps.map((mu: any) => {
    const side1 = mu.sides?.[0];
    const side2 = mu.sides?.[1];

    return {
      tournamentName: tournament?.tournamentName,
      eventName: mu.eventName || '',
      roundName: mu.roundName || mu.abbreviatedRoundName || '',
      matchUpId: mu.matchUpId,
      courtName: mu.schedule?.courtName,
      scheduledTime: mu.schedule?.scheduledTime,
      side1: {
        name: side1?.participant?.participantName || 'TBD',
        nationality: side1?.participant?.nationalityCode || '',
        seedValue: side1?.seedValue,
      },
      side2: {
        name: side2?.participant?.participantName || 'TBD',
        nationality: side2?.participant?.nationalityCode || '',
        seedValue: side2?.seedValue,
      },
    };
  });

  const doc = generateMatchCardPDF(cards, { cardsPerPage: 2, includeScoreBoxes: true });
  const filename = `match-cards-${cards.length}.pdf`;

  if (action === 'open') {
    openPDF({ doc });
  } else {
    savePDF({ doc, filename });
  }
}

/**
 * Print match cards for all matchUps in a round.
 */
export function printRoundMatchCards({
  drawId,
  structureId,
  roundNumber,
  action = 'open',
}: {
  drawId: string;
  structureId: string;
  roundNumber: number;
  action?: 'open' | 'download';
}): void {
  const { matchUps } = tournamentEngine.allTournamentMatchUps();
  const roundMatchUps = matchUps.filter(
    (mu: any) => mu.drawId === drawId && mu.structureId === structureId && mu.roundNumber === roundNumber,
  );

  const matchUpIds = roundMatchUps.map((mu: any) => mu.matchUpId);
  if (matchUpIds.length) {
    printMatchCards({ matchUpIds, drawId, action });
  }
}
