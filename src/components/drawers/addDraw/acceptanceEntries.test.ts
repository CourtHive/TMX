import { acceptanceEntries, entryChangeMethods, withEntryChanges } from './acceptanceEntries';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * The topology Fit mode's acceptance line on TMX's side (CA 2026-11-08): MAIN entries ranked by the active scale,
 * the trial entries a fit is asked about, and the changes applied in the request that adds the draw.
 */
const rated = (id: string, scaleName: string, scaleValue: unknown) => ({
  participantId: id,
  participantName: id.toUpperCase(),
  ratings: { SINGLES: [{ scaleName, scaleValue }] },
});
const entry = (participantId: string, entryStatus = 'DIRECT_ACCEPTANCE', entryStage?: string) => ({
  participantId,
  entryStatus,
  entryStage,
});

describe('acceptanceEntries', () => {
  it('ranks by ELO, highest first, with the rating as the label; qualifying entries are not on the line', () => {
    const ranked = acceptanceEntries({
      entries: [entry('a'), entry('b', 'ALTERNATE'), entry('c'), entry('q', 'DIRECT_ACCEPTANCE', 'QUALIFYING')],
      participants: [rated('a', 'ELO', 1500), rated('b', 'ELO', 2100), rated('c', 'ELO', 1800)],
      eventType: 'SINGLES',
      ratingScale: { scaleName: 'ELO' },
    });
    expect(ranked.map(({ participantId }) => participantId)).toEqual(['b', 'c', 'a']);
    expect(ranked[0]).toEqual({ participantId: 'b', name: 'B', entryStatus: 'ALTERNATE', rankLabel: 'ELO 2100' });
  });

  it('ranks WTN lowest first; the unrated sink to the end in event order', () => {
    const ranked = acceptanceEntries({
      entries: [entry('x'), entry('a'), entry('y'), entry('b')],
      participants: [
        rated('a', 'WTN', { wtnRating: 12.5 }),
        rated('b', 'WTN', { wtnRating: 4.2 }),
        rated('y', 'WTN', { wtnRating: '' }),
      ],
      eventType: 'SINGLES',
      ratingScale: { scaleName: 'WTN', accessor: 'wtnRating' },
    });
    expect(ranked.map(({ participantId }) => participantId)).toEqual(['b', 'a', 'x', 'y']);
    expect(ranked[2].rankLabel).toBeUndefined();
  });

  it('with no scale, the event order stands', () => {
    const ranked = acceptanceEntries({ entries: [entry('c'), entry('a'), entry('b')], participants: [] });
    expect(ranked.map(({ participantId }) => participantId)).toEqual(['c', 'a', 'b']);
  });
});

describe('the changes', () => {
  const changes = [
    { participantId: 'a', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE' },
    { participantId: 'b', from: 'ALTERNATE', to: 'DIRECT_ACCEPTANCE' },
    { participantId: 'c', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE' },
  ];

  it('the trial entries carry them; no changes is the entries unchanged', () => {
    const entries = [entry('a'), entry('b', 'ALTERNATE'), entry('d')];
    expect(withEntryChanges(entries, changes).map(({ entryStatus }) => entryStatus)).toEqual([
      'ALTERNATE',
      'DIRECT_ACCEPTANCE',
      'DIRECT_ACCEPTANCE',
    ]);
    expect(withEntryChanges(entries, [])).toBe(entries);
  });

  it('one modifyEntriesStatus per status they move to', () => {
    expect(entryChangeMethods('e1', changes)).toEqual([
      {
        method: 'modifyEntriesStatus',
        params: { eventId: 'e1', participantIds: ['a', 'c'], entryStatus: 'ALTERNATE' },
      },
      {
        method: 'modifyEntriesStatus',
        params: { eventId: 'e1', participantIds: ['b'], entryStatus: 'DIRECT_ACCEPTANCE' },
      },
    ]);
    expect(entryChangeMethods('e1', [])).toEqual([]);
  });

  it('applied before the draw in one request: the statuses and the draw land together', () => {
    // 36 entered, 32 places: the line moves the four lowest-ranked of the 36 to alternate
    const {
      eventIds: [eventId],
    } = mocksEngine.generateTournamentRecord({
      participantsProfile: { participantsCount: 36 },
      eventProfiles: [{ eventName: 'Line' }],
      setState: true,
    });
    const ids = (tournamentEngine.getParticipants().participants ?? []).map((p: any) => p.participantId);
    let result: any = tournamentEngine.addEventEntries({ eventId, participantIds: ids });
    expect(result.success).toBe(true);

    const demoted = ids
      .slice(32)
      .map((participantId: string) => ({ participantId, from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE' }));
    const event: any = tournamentEngine.getEvent({ eventId }).event;
    const drawEntries: any[] = withEntryChanges(event.entries, demoted).filter(
      ({ entryStatus }: any) => entryStatus === 'DIRECT_ACCEPTANCE',
    );
    const { drawDefinition } = tournamentEngine.generateDrawDefinition({ eventId, drawSize: 32, drawEntries });
    expect(drawDefinition).toBeDefined();

    result = tournamentEngine.executionQueue([
      ...entryChangeMethods(eventId, demoted),
      { method: 'addDrawDefinition', params: { eventId, drawDefinition } },
    ]);
    expect(result.success).toBe(true);

    const after = tournamentEngine.getEvent({ eventId }).event;
    expect(after.entries.filter(({ entryStatus }: any) => entryStatus === 'ALTERNATE')).toHaveLength(4);
    expect(after.drawDefinitions).toHaveLength(1);
  });
});
