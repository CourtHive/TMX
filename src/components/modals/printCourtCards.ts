/**
 * Print Court Cards — generates court signage showing current and next match per court.
 */
import { tournamentEngine, factoryConstants } from 'tods-competition-factory';
import { extractCourtCardData, generateCourtCardPDF } from 'pdf-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { openPDF } from 'services/pdf/export/pdfExport';

const IS_WARNING = 'is-warning';
const { IN_PROGRESS } = factoryConstants.matchUpStatusConstants;
const COMPLETED = new Set<string>(factoryConstants.completedMatchUpStatuses);

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
    tmxToast({ message: 'No scheduled matches on this court', intent: IS_WARNING });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

/**
 * Print one court card for a single matchUp (the matchUp populates the
 * "current match" slot of a single card).
 */
export function printMatchUpCourtCard({
  matchUpId,
  scheduledDate,
}: {
  matchUpId: string;
  scheduledDate?: string;
}): void {
  const { matchUps, venues, tournamentName } = getScheduleData({ scheduledDate });
  const matchUp = matchUps.find((m: any) => m.matchUpId === matchUpId);
  if (!matchUp) {
    tmxToast({ message: 'MatchUp not found', intent: IS_WARNING });
    return;
  }

  const cards = extractCourtCardData({ matchUps: [matchUp], venues });
  if (!cards.length) {
    tmxToast({ message: 'No court card data for this matchUp', intent: IS_WARNING });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

/**
 * Print one court card per playable, not-yet-started matchUp on a court.
 * Excludes completed (and walkover-family) matchUps, matchUps already in
 * progress, and matchUps that don't yet have participants on both sides
 * (anything that would render as TBD).
 */
export function printCourtMatchUpCards({ courtId, scheduledDate }: PrintCourtCardParams): void {
  const { matchUps, venues, tournamentName } = getScheduleData({ scheduledDate });

  const sideHasParticipant = (s: any) => !!(s?.participantId || s?.participant?.participantId);
  const bothSidesAssigned = (mu: any) => {
    const sides = mu.sides || [];
    return sides.length >= 2 && sideHasParticipant(sides[0]) && sideHasParticipant(sides[1]);
  };

  const courtMatchUps = matchUps.filter((mu: any) => {
    const onCourt = mu.schedule?.courtId === courtId || mu.schedule?.venueCourtId === courtId;
    if (!onCourt) return false;
    if (COMPLETED.has(mu.matchUpStatus)) return false;
    if (mu.matchUpStatus === IN_PROGRESS) return false;
    if (!bothSidesAssigned(mu)) return false;
    return true;
  });

  if (!courtMatchUps.length) {
    tmxToast({ message: 'No upcoming matches with both participants assigned on this court', intent: IS_WARNING });
    return;
  }

  // One card per matchUp — extractCourtCardData collapses by court, so call per matchUp.
  const cards = courtMatchUps.flatMap((mu: any) => extractCourtCardData({ matchUps: [mu], venues }));
  if (!cards.length) {
    tmxToast({ message: 'No court card data', intent: IS_WARNING });
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
    tmxToast({ message: 'No matches scheduled on courts', intent: IS_WARNING });
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

  const scheduledMatchUps = matchUps.filter((mu: any) => mu.schedule?.courtId);
  const cards = extractCourtCardData({ matchUps: scheduledMatchUps, venues });

  if (!cards.length) {
    tmxToast({ message: 'No matches in this round are assigned to courts', intent: IS_WARNING });
    return;
  }

  const doc = generateCourtCardPDF(cards, { tournamentName });
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
