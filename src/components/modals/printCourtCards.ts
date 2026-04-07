/**
 * Print Court Cards — generates court signage showing current and next match per court.
 */
import { extractCourtCardData, generateCourtCardPDF } from 'pdf-factory';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { openPDF } from 'services/pdf/export/pdfExport';

interface PrintCourtCardParams {
  courtId: string;
  courtName?: string;
  scheduledDate?: string;
}

/**
 * Print a court card for a single court.
 */
export function printCourtCard({ courtId, scheduledDate }: PrintCourtCardParams): void {
  const { matchUps, venues, tournamentName } = getScheduleData({ scheduledDate });

  const courtMatchUps = matchUps.filter(
    (mu: any) => mu.schedule?.courtId === courtId || mu.schedule?.venueCourtId === courtId,
  );

  const cards = extractCourtCardData({ matchUps: courtMatchUps, venues });
  if (!cards.length) {
    tmxToast({ message: 'No scheduled matches on this court', intent: 'is-warning' });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

/**
 * Print court cards for all courts with scheduled matchUps.
 */
export function printAllCourtCards({ scheduledDate }: { scheduledDate?: string }): void {
  const { matchUps, venues, tournamentName } = getScheduleData({ scheduledDate });

  const cards = extractCourtCardData({ matchUps, venues, scheduledDate });
  if (!cards.length) {
    tmxToast({ message: 'No matches scheduled on courts', intent: 'is-warning' });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

/**
 * Print court cards scoped to a specific draw/structure round.
 */
export function printRoundCourtCards({ drawId, structureId, roundNumber }: {
  drawId: string;
  structureId: string;
  roundNumber: number;
}): void {
  const { venues, tournamentName } = getScheduleData({});

  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { drawIds: [drawId], structureIds: [structureId], roundNumbers: [roundNumber] },
  });

  console.log('--- printRoundCourtCards debug ---');
  console.log('matchUps count:', matchUps.length);
  console.log('sample matchUp schedule:', JSON.stringify(matchUps[0]?.schedule, null, 2));
  console.log('sample matchUp sides:', JSON.stringify(matchUps[0]?.sides?.map((s: any) => ({ participantId: s.participantId, participant: s.participant?.participantName })), null, 2));
  console.log('venues:', JSON.stringify(venues?.map((v: any) => ({ venueName: v.venueName, courts: v.courts?.map((c: any) => ({ courtId: c.courtId, courtName: c.courtName })) })), null, 2));

  const scheduledMatchUps = matchUps.filter((mu: any) => mu.schedule?.courtId);
  console.log('scheduledMatchUps (with courtId):', scheduledMatchUps.length);

  const cards = extractCourtCardData({ matchUps: scheduledMatchUps, venues });
  console.log('extracted cards:', JSON.stringify(cards, null, 2));

  if (!cards.length) {
    tmxToast({ message: 'No matches in this round are assigned to courts', intent: 'is-warning' });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
  console.log('PDF generated, pages:', doc.getNumberOfPages());
  openPDF({ doc });
}

function getScheduleData({ scheduledDate }: { scheduledDate?: string }) {
  const tournamentName = tournamentEngine.getTournamentInfo()?.tournamentInfo?.tournamentName ?? '';
  const { venues } = tournamentEngine.getVenuesAndCourts();
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { scheduledDate },
  });

  return { matchUps, venues, tournamentName };
}
