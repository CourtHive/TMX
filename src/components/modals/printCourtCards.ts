/**
 * Print Court Cards — generates court signage showing current and next match per court.
 */
import { extractCourtCardData, generateCourtCardPDF } from 'pdf-factory';
import { tournamentEngine } from 'tods-competition-factory';
import { openPDF } from 'services/pdf/export/pdfExport';

interface PrintCourtCardParams {
  courtId: string;
  courtName?: string;
  scheduledDate?: string;
}

/**
 * Print a court card for a single court.
 * Shows current match (NOW PLAYING) and next match (UP NEXT).
 */
export function printCourtCard({ courtId, scheduledDate }: PrintCourtCardParams): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournamentName = tournamentInfoResult?.tournamentInfo?.tournamentName ?? '';
  const { venues } = tournamentEngine.getVenues();
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { scheduledDate },
  });

  // Filter to matchUps on this court
  const courtMatchUps = matchUps.filter(
    (mu: any) => mu.schedule?.venueCourtId === courtId || mu.schedule?.courtId === courtId,
  );

  const cards = extractCourtCardData({ matchUps: courtMatchUps, venues });
  if (!cards.length) return;

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

/**
 * Print court cards for all courts with scheduled matchUps on a given date.
 */
export function printAllCourtCards({ scheduledDate }: { scheduledDate?: string }): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournamentName = tournamentInfoResult?.tournamentInfo?.tournamentName ?? '';
  const { venues } = tournamentEngine.getVenues();
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { scheduledDate },
  });

  const cards = extractCourtCardData({ matchUps, venues, scheduledDate });
  if (!cards.length) return;

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}
