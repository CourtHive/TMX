/**
 * The topology Fit mode's acceptance line, on TMX's side (TOPOLOGY_FIT_MODE.md § levers, step 3; CA 2026-11-08).
 *
 * The control (courthive-components) draws the line through the event's entries in ACCEPTANCE ORDER (CA, 2026-11-16;
 * the plan's first version ranked them by the active rating scale): the stage's accepted entries as the one list the
 * factory numbers with `entryPosition`, then its alternates by theirs, then the rest; entries without a position follow
 * the positioned ones of their group in event order — the entries table's own order (`compareEntryPosition`). The
 * active scale's rating is the row's label, not its order. A cut makes pending entry changes; the fit is asked with them as trial
 * `drawEntries`, and Generate applies them in the same request that adds the draw, so the statuses and the draw
 * land together or not at all.
 *
 * Pure: the participants and the scale are handed in.
 */
import { drawDefinitionConstants, entryStatusConstants, resolveScaleValueNumber } from 'tods-competition-factory';
import { compareEntryPosition } from 'components/tables/eventsTable/unified/entryPosition';

import { MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';

type Entry = { participantId: string; entryStatus?: string; entryStage?: string; entryPosition?: number };
type Scale = { scaleName: string; accessor?: string };
export type EntryChange = { participantId: string; from: string; to: string; fromStage?: string; toStage?: string };
export type AcceptanceEntry = {
  participantId: string;
  name: string;
  entryStatus: string;
  entryStage?: string;
  rankLabel?: string;
  rankOrder?: number;
};

const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { ALTERNATE, STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const ACCEPTED = new Set<string>(STRUCTURE_SELECTED_STATUSES);

// the lists acceptance order is kept in: the accepted statuses together, then alternates, then the rest
const groupRank = (entryStatus?: string) =>
  entryStatus && ACCEPTED.has(entryStatus) ? 0 : entryStatus === ALTERNATE ? 1 : 2;
const ENTRY_STAGES = new Set<string>([MAIN, QUALIFYING]);

/**
 * The event's entries for the acceptance line, in acceptance order (see the module comment), each labelled with its
 * rating on `ratingScale` when it has one. `stage` 'ALL' keeps MAIN and QUALIFYING, each in its own order.
 */
export function acceptanceEntries({
  entries,
  participants,
  eventType = 'SINGLES',
  ratingScale: scale,
  stage = MAIN,
}: {
  entries: Entry[];
  stage?: string;
  participants: any[];
  /** the ratings read are the event type's; an event without one reads singles ratings */
  eventType?: string;
  ratingScale?: Scale;
}): AcceptanceEntry[] {
  const byId = new Map(participants.map((participant) => [participant.participantId, participant]));

  const ordered = entries
    .map((entry, index) => ({ entry, entryPosition: entry.entryPosition, _entryIndex: index }))
    .filter(({ entry }) =>
      stage === 'ALL' ? ENTRY_STAGES.has(entry.entryStage ?? MAIN) : (entry.entryStage ?? MAIN) === stage,
    )
    .sort((a, b) => groupRank(a.entry.entryStatus) - groupRank(b.entry.entryStatus) || compareEntryPosition(a, b));

  return ordered.map(({ entry }, rankOrder) => {
    const participant = byId.get(entry.participantId);
    const rawValue = scale
      ? participant?.ratings?.[eventType]?.find((rating: any) => rating.scaleName === scale.scaleName)?.scaleValue
      : undefined;
    const value = scale
      ? resolveScaleValueNumber(rawValue, { accessor: scale.accessor, scaleName: scale.scaleName })
      : undefined;
    return {
      rankOrder,
      entryStage: entry.entryStage ?? MAIN,
      participantId: entry.participantId,
      name: participant?.participantName ?? entry.participantId,
      entryStatus: entry.entryStatus ?? '',
      ...(value !== undefined && scale && { rankLabel: `${scale.scaleName} ${value}` }),
    };
  });
}

/** The entries with the acceptance line's changes: the trial a fit is asked about, and the draw generated from. */
export function withEntryChanges<T extends Entry>(entries: T[], changes: EntryChange[] = []): T[] {
  if (!changes.length) return entries;
  const bySource = new Map(changes.map((change) => [`${change.fromStage ?? MAIN}:${change.participantId}`, change]));
  return entries.map((entry) => {
    const change = bySource.get(`${entry.entryStage ?? MAIN}:${entry.participantId}`);
    return change ? { ...entry, entryStatus: change.to, entryStage: change.toStage ?? entry.entryStage } : entry;
  });
}

/** Keep the original source through successive previews, so stage moves are applied once at Generate. */
export function composeEntryChanges(entries: Entry[], ...groups: EntryChange[][]): EntryChange[] {
  return entries.flatMap((entry) => {
    const fromStage = entry.entryStage ?? MAIN;
    let stage = fromStage;
    let status = entry.entryStatus;
    for (const changes of groups) {
      const change = changes.find(
        (change) => change.participantId === entry.participantId && (change.fromStage ?? MAIN) === stage,
      );
      if (change) {
        status = change.to;
        stage = change.toStage ?? stage;
      }
    }
    return status === entry.entryStatus && stage === fromStage
      ? []
      : [
          {
            participantId: entry.participantId,
            from: entry.entryStatus ?? '',
            to: status ?? '',
            fromStage,
            ...(stage !== fromStage && { toStage: stage }),
          },
        ];
  });
}

/** The changes as mutations, one per status they move to, to run before the draw is added. */
export function entryChangeMethods(eventId: string, changes: EntryChange[] = []): any[] {
  const groups = new Map<
    string,
    { stage: string; entryStage: string; entryStatus: string; participantIds: Set<string> }
  >();
  for (const { participantId, to, fromStage = MAIN, toStage = fromStage } of changes) {
    const key = `${fromStage}:${toStage}:${to}`;
    const group = groups.get(key) ?? {
      stage: fromStage,
      entryStage: toStage,
      entryStatus: to,
      participantIds: new Set<string>(),
    };
    group.participantIds.add(participantId);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ participantIds, ...group }) => ({
    method: MODIFY_ENTRIES_STATUS,
    params: { eventId, ...group, participantIds: [...participantIds] },
  }));
}
