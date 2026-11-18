import {
  acceptanceEntries,
  composeEntryChanges,
  entryChangeMethods,
  qualifyingPathMethods,
  withEntryChanges,
} from './acceptanceEntries';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * The topology Fit mode's acceptance line on TMX's side: the entries in acceptance order (CA 2026-11-16; first ranked
 * by the active scale, 2026-11-08), the trial entries a fit is asked about, and the changes applied in the request
 * that adds the draw.
 */
const rated = (id: string, scaleName: string, scaleValue: unknown) => ({
  participantId: id,
  participantName: id.toUpperCase(),
  ratings: { SINGLES: [{ scaleName, scaleValue }] },
});
const entry = (
  participantId: string,
  entryStatus = 'DIRECT_ACCEPTANCE',
  entryStage?: string,
  entryPosition?: number,
) => ({
  participantId,
  entryStatus,
  entryStage,
  entryPosition,
});
const ids = (entries: { participantId: string }[]) => entries.map(({ participantId }) => participantId);

describe('acceptanceEntries', () => {
  it('orders the accepted list by entryPosition, then the alternates; the rating is the label, not the order', () => {
    const ordered = acceptanceEntries({
      entries: [
        entry('alt', 'ALTERNATE', undefined, 1),
        entry('a', 'DIRECT_ACCEPTANCE', undefined, 2),
        entry('b', 'DIRECT_ACCEPTANCE', undefined, 1),
        entry('q', 'DIRECT_ACCEPTANCE', 'QUALIFYING', 1),
      ],
      participants: [rated('a', 'ELO', 1500), rated('b', 'ELO', 1200), rated('alt', 'ELO', 2100)],
      eventType: 'SINGLES',
      ratingScale: { scaleName: 'ELO' },
    });
    // the highest rated is an alternate and stays below the accepted list; qualifying entries are not on the line
    expect(ids(ordered)).toEqual(['b', 'a', 'alt']);
    expect(ordered[0]).toEqual({
      participantId: 'b',
      name: 'B',
      entryStatus: 'DIRECT_ACCEPTANCE',
      rankLabel: 'ELO 1200',
      entryStage: 'MAIN',
      rankOrder: 0,
    });
  });

  it('numbers every accepted status in one list: a wildcard keeps its place among the direct acceptances', () => {
    const ordered = acceptanceEntries({
      entries: [
        entry('da2', 'DIRECT_ACCEPTANCE', undefined, 3),
        entry('wc', 'WILDCARD', undefined, 2),
        entry('da1', 'DIRECT_ACCEPTANCE', undefined, 1),
      ],
      participants: [],
    });
    expect(ids(ordered)).toEqual(['da1', 'wc', 'da2']);
  });

  it('entries without a position follow the positioned ones of their list, in event order', () => {
    const ordered = acceptanceEntries({
      entries: [
        entry('x'),
        entry('p2', 'DIRECT_ACCEPTANCE', undefined, 2),
        entry('y'),
        entry('p1', 'DIRECT_ACCEPTANCE', undefined, 1),
      ],
      participants: [],
    });
    expect(ids(ordered)).toEqual(['p1', 'p2', 'x', 'y']);
    // with no positions at all, the event order stands
    expect(ids(acceptanceEntries({ entries: [entry('c'), entry('a'), entry('b')], participants: [] }))).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it("'ALL' keeps both stages, each in its own acceptance order", () => {
    const ordered = acceptanceEntries({
      entries: [
        entry('q2', 'DIRECT_ACCEPTANCE', 'QUALIFYING', 2),
        entry('m', 'DIRECT_ACCEPTANCE', undefined, 1),
        entry('q1', 'DIRECT_ACCEPTANCE', 'QUALIFYING', 1),
      ],
      participants: [],
      stage: 'ALL',
    });
    expect(ids(ordered.filter((e) => e.entryStage === 'QUALIFYING'))).toEqual(['q1', 'q2']);
    expect(ids(ordered.filter((e) => e.entryStage === 'MAIN'))).toEqual(['m']);
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

  it('a MAIN trial preserves a qualifying entry for the same participant', () => {
    const entries = [entry('a'), { ...entry('a'), entryStage: 'QUALIFYING' }];
    const trial = withEntryChanges(entries, changes);
    expect(trial[0].entryStatus).toBe('ALTERNATE');
    expect(trial[1]).toBe(entries[1]);
    expect(entries[0].entryStatus).toBe('DIRECT_ACCEPTANCE');
  });

  it('one modifyEntriesStatus per status they move to', () => {
    expect(entryChangeMethods('e1', changes)).toEqual([
      {
        method: 'modifyEntriesStatus',
        params: {
          eventId: 'e1',
          participantIds: ['a', 'c'],
          entryStatus: 'ALTERNATE',
          stage: 'MAIN',
          entryStage: 'MAIN',
        },
      },
      {
        method: 'modifyEntriesStatus',
        params: {
          eventId: 'e1',
          participantIds: ['b'],
          entryStatus: 'DIRECT_ACCEPTANCE',
          stage: 'MAIN',
          entryStage: 'MAIN',
        },
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

it('keeps sources separate when a main entry and a qualifying entry move to the same status', () => {
  const changes = [
    { participantId: 'main', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE', toStage: 'QUALIFYING' },
    { participantId: 'qualifying', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE', fromStage: 'QUALIFYING' },
  ];
  const methods = entryChangeMethods('event', changes);
  expect(methods).toHaveLength(2);
  expect(methods[0].params).toMatchObject({ participantIds: ['main'], stage: 'MAIN', entryStage: 'QUALIFYING' });
  expect(methods[1].params).toMatchObject({
    participantIds: ['qualifying'],
    stage: 'QUALIFYING',
    entryStage: 'QUALIFYING',
  });
});

it('composes a stage move and a later qualifying demotion without losing the MAIN origin', () => {
  const entries = [entry('main'), entry('q', 'DIRECT_ACCEPTANCE', 'QUALIFYING')];
  const first = [{ participantId: 'main', from: 'DIRECT_ACCEPTANCE', to: 'DIRECT_ACCEPTANCE', toStage: 'QUALIFYING' }];
  const second = [{ participantId: 'main', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE', fromStage: 'QUALIFYING' }];
  const changes = composeEntryChanges(entries, first, second);
  expect(changes).toEqual([
    { participantId: 'main', from: 'DIRECT_ACCEPTANCE', to: 'ALTERNATE', fromStage: 'MAIN', toStage: 'QUALIFYING' },
  ]);
  expect(withEntryChanges(entries, changes)).toEqual([entry('main', 'ALTERNATE', 'QUALIFYING'), entries[1]]);
});

describe('qualifyingPathMethods (CA, 2026-11-18)', () => {
  const band = (structureName: string, roundTarget: number, entryStageSequence: number, ids: string[]) => ({
    structureName,
    roundTarget,
    entryStageSequence,
    participantIds: ids,
  });

  it("writes each band's path: the stronger field to R3, the weaker to R1", () => {
    const methods = qualifyingPathMethods('e1', [band('Stronger', 3, 1, ['a', 'b']), band('Weaker', 1, 1, ['c'])]);
    expect(methods).toEqual([
      {
        method: 'setEntryQualifyingPath',
        params: { eventId: 'e1', participantIds: ['a', 'b'], roundTarget: 3, entryStageSequence: 1 },
      },
      {
        method: 'setEntryQualifyingPath',
        params: { eventId: 'e1', participantIds: ['c'], roundTarget: 1, entryStageSequence: 1 },
      },
    ]);
  });

  it("a flight's draw writes its own entries; an empty band writes nothing", () => {
    const methods = qualifyingPathMethods('e1', [band('Q', 1, 2, ['a']), band('Pre', 1, 1, [])], 'flight-1');
    expect(methods).toEqual([
      {
        method: 'setEntryQualifyingPath',
        params: { eventId: 'e1', drawId: 'flight-1', participantIds: ['a'], roundTarget: 1, entryStageSequence: 2 },
      },
    ]);
  });

  it('one qualifying structure into round 1 changes no entry', () => {
    expect(qualifyingPathMethods('e1', [band('Qualifying', 1, 1, ['a', 'b'])])).toEqual([]);
    expect(qualifyingPathMethods('e1', [])).toEqual([]);
    // one structure into a later round is routing all the same
    expect(qualifyingPathMethods('e1', [band('Qualifying', 3, 1, ['a'])])).toHaveLength(1);
  });
});
