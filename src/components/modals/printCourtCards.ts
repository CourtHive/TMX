/**
 * Print Court Cards — generates court signage showing current and next match per court.
 */
import { generateCourtCardPDF } from 'pdf-factory';
import { tournamentEngine } from 'tods-competition-factory';
import { openPDF } from 'services/pdf/export/pdfExport';

// Types
import type { CourtCardData, CourtCardMatch } from 'pdf-factory';

const COMPLETED_STATUSES = new Set(['COMPLETED', 'RETIRED', 'WALKOVER', 'DEFAULTED', 'ABANDONED', 'CANCELLED']);

interface PrintCourtCardParams {
  courtId: string;
  courtName?: string;
  scheduledDate?: string;
}

/**
 * Print a court card for a single court.
 * Shows current match (NOW PLAYING) and next match (UP NEXT).
 */
export function printCourtCard({ courtId, courtName, scheduledDate }: PrintCourtCardParams): void {
  const tournamentName = getTournamentName();
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { scheduledDate },
  });

  const courtMatchUps = matchUps.filter(
    (mu: any) => mu.schedule?.courtId === courtId || mu.schedule?.venueCourtId === courtId,
  );

  const card = buildCourtCard(courtMatchUps, courtId, courtName);
  if (!card) return;

  const doc = generateCourtCardPDF([card], { tournamentName });
  openPDF({ doc });
}

/**
 * Print court cards for all courts with scheduled matchUps on a given date.
 */
export function printAllCourtCards({ scheduledDate }: { scheduledDate?: string }): void {
  const tournamentName = getTournamentName();
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { scheduledDate },
  });

  const cards = buildAllCourtCards(matchUps);
  if (!cards.length) return;

  const doc = generateCourtCardPDF(cards, { tournamentName });
  openPDF({ doc });
}

function getTournamentName(): string {
  return tournamentEngine.getTournamentInfo()?.tournamentInfo?.tournamentName ?? '';
}

function buildAllCourtCards(matchUps: any[]): CourtCardData[] {
  // Group matchUps by court
  const courtGroups = new Map<string, { matchUps: any[]; courtName: string }>();

  for (const mu of matchUps) {
    const courtId = mu.schedule?.courtId || mu.schedule?.venueCourtId;
    if (!courtId) continue;

    if (!courtGroups.has(courtId)) {
      courtGroups.set(courtId, { matchUps: [], courtName: mu.schedule?.courtName || courtId });
    }
    courtGroups.get(courtId)!.matchUps.push(mu);
  }

  const cards: CourtCardData[] = [];
  for (const [courtId, group] of courtGroups) {
    const card = buildCourtCard(group.matchUps, courtId, group.courtName);
    if (card) cards.push(card);
  }

  return cards.sort((a, b) => a.courtName.localeCompare(b.courtName));
}

function buildCourtCard(matchUps: any[], courtId: string, courtName?: string): CourtCardData | undefined {
  if (!matchUps.length) return undefined;

  // Sort by scheduled time
  const sorted = [...matchUps].sort((a, b) => {
    const ta = a.schedule?.scheduledTime || '';
    const tb = b.schedule?.scheduledTime || '';
    return ta.localeCompare(tb);
  });

  // Find current (IN_PROGRESS or first non-completed) and next
  const inProgress = sorted.find((m) => m.matchUpStatus === 'IN_PROGRESS');
  const upcoming = sorted.filter((m) => !COMPLETED_STATUSES.has(m.matchUpStatus));

  const currentMu = inProgress || upcoming[0];
  const nextMu = inProgress ? upcoming.find((m: any) => m !== inProgress) : upcoming[1];

  const resolvedName = courtName || currentMu?.schedule?.courtName || courtId;

  return {
    courtName: resolvedName,
    venueName: currentMu?.schedule?.venueName || '',
    currentMatch: currentMu ? mapMatch(currentMu) : undefined,
    nextMatch: nextMu ? mapMatch(nextMu) : undefined,
  };
}

function mapMatch(mu: any): CourtCardMatch {
  const side1 = mu.sides?.[0];
  const side2 = mu.sides?.[1];

  return {
    eventName: mu.eventName || '',
    roundName: mu.roundName || mu.abbreviatedRoundName || '',
    scheduledTime: mu.schedule?.scheduledTime,
    side1: {
      name: side1?.participant?.participantName || 'TBD',
      nationality: side1?.participant?.nationalityCode || '',
    },
    side2: {
      name: side2?.participant?.participantName || 'TBD',
      nationality: side2?.participant?.nationalityCode || '',
    },
  };
}
