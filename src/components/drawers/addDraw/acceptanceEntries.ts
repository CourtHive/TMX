/**
 * The topology Fit mode's acceptance line, on TMX's side (TOPOLOGY_FIT_MODE.md § levers, step 3; CA 2026-11-08).
 *
 * The control (courthive-components) draws the line through entries TMX ranks: the event's MAIN entries by the
 * active rating scale, best first. A cut makes pending entry changes; the fit is asked with them as trial
 * `drawEntries`, and Generate applies them in the same request that adds the draw, so the statuses and the draw
 * land together or not at all.
 *
 * Pure: the participants and the scale are handed in.
 */
import { ratingSortValue } from 'components/tables/eventsTable/seeding/ratingSortValue';
import { fixtures, resolveScaleValueNumber } from 'tods-competition-factory';

import { MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';

type Entry = { participantId: string; entryStatus?: string; entryStage?: string; entryPosition?: number };
type Scale = { scaleName: string; accessor?: string };
export type EntryChange = { participantId: string; from: string; to: string };
export type AcceptanceEntry = { participantId: string; name: string; entryStatus: string; rankLabel?: string };

const MAIN = 'MAIN';

/**
 * The event's MAIN entries for the acceptance line, ranked best first by `ratingScale`. A scale where a lower value is
 * stronger (WTN) ranks ascending. Unrated entries sink to the end, in event order; with no `ratingScale`, the
 * event order stands.
 */
export function acceptanceEntries({
  entries,
  participants,
  eventType = 'SINGLES',
  ratingScale: scale,
}: {
  entries: Entry[];
  participants: any[];
  /** the ratings read are the event type's; an event without one reads singles ratings */
  eventType?: string;
  ratingScale?: Scale;
}): AcceptanceEntry[] {
  const byId = new Map(participants.map((participant) => [participant.participantId, participant]));
  const ascending = !!(scale && (fixtures.ratingsParameters as any)[scale.scaleName]?.ascending);

  const ranked = entries
    .filter(({ entryStage }) => !entryStage || entryStage === MAIN)
    .map((entry, order) => {
      const participant = byId.get(entry.participantId);
      const rawValue = scale
        ? participant?.ratings?.[eventType]?.find((rating: any) => rating.scaleName === scale.scaleName)?.scaleValue
        : undefined;
      const value = scale
        ? resolveScaleValueNumber(rawValue, { accessor: scale.accessor, scaleName: scale.scaleName })
        : undefined;
      const sortValue = scale
        ? ratingSortValue({ rawValue, accessor: scale.accessor, scaleName: scale.scaleName, reversed: ascending })
        : 0;
      return { entry, participant, value, sortValue, order };
    });

  ranked.sort((a, b) => {
    if (a.sortValue !== b.sortValue) return ascending ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
    return a.order - b.order;
  });

  return ranked.map(({ entry, participant, value }) => ({
    participantId: entry.participantId,
    name: participant?.participantName ?? entry.participantId,
    entryStatus: entry.entryStatus ?? '',
    ...(value !== undefined && scale && { rankLabel: `${scale.scaleName} ${value}` }),
  }));
}

/** The entries with the acceptance line's changes: the trial a fit is asked about, and the draw generated from. */
export function withEntryChanges<T extends Entry>(entries: T[], changes: EntryChange[] = []): T[] {
  if (!changes.length) return entries;
  const to = new Map(changes.map(({ participantId, to }) => [participantId, to]));
  return entries.map((entry) =>
    to.has(entry.participantId) ? { ...entry, entryStatus: to.get(entry.participantId) } : entry,
  );
}

/** The changes as mutations, one per status they move to, to run before the draw is added. */
export function entryChangeMethods(eventId: string, changes: EntryChange[] = []): any[] {
  const byStatus = new Map<string, string[]>();
  for (const { participantId, to } of changes) byStatus.set(to, [...(byStatus.get(to) ?? []), participantId]);
  return [...byStatus].map(([entryStatus, participantIds]) => ({
    method: MODIFY_ENTRIES_STATUS,
    params: { eventId, participantIds, entryStatus },
  }));
}
