import { drawDefinitionConstants, entryStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { compareSegmentRows, withSegmentRanks, type SortState } from './segmentSorter';
import { describe, expect, it } from 'vitest';
import {
  entryPositionBadge,
  entryPositionGroup,
  entryPositionLabel,
  hasEntryPositions,
  withEntryIndex,
  withStatusOrdinals,
} from './entryPosition';

// constants
import { ADD_EVENT, ADD_EVENT_ENTRIES, ADD_PARTICIPANTS, MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, STRUCTURE_SELECTED_STATUSES, UNGROUPED, WILDCARD, WITHDRAWN } =
  entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;

const ALTERNATES_RANK = 2;
const ACCEPTED_RANK = 0;
const defaultSort: SortState = { secondaryField: '', secondaryDir: 'asc' };

// The rows the unified entries table builds from an event's entries, in display order.
function displayRows(eventId: string, sortState: SortState = defaultSort) {
  const { event } = tournamentEngine.getEvent({ eventId });
  const rows = withEntryIndex(withSegmentRanks(event.entries.map((entry: any) => ({ ...entry }))));
  return rows.sort((a, b) => compareSegmentRows(a, b, sortState));
}

const segment = (rows: any[], rank: number) => rows.filter((row) => row._segmentRank === rank);

function setup() {
  const {
    tournamentRecord: { participants },
  } = mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 12 }, setState: true });
  const participantIds = participants.map(({ participantId }: any) => participantId);
  const eventId = 'alternatesEvent';
  const result = tournamentEngine.executionQueue([
    { method: ADD_EVENT, params: { event: { eventId, eventName: 'Alternates' } } },
    { method: ADD_EVENT_ENTRIES, params: { eventId, participantIds: participantIds.slice(0, 8) } },
    { method: ADD_EVENT_ENTRIES, params: { eventId, participantIds: participantIds.slice(8), entryStatus: ALTERNATE } },
  ]);
  expect(result.success).toEqual(true);
  return eventId;
}

function modifyEntriesStatus(eventId: string, participantIds: string[], entryStatus: string) {
  const result = tournamentEngine.executionQueue([
    { method: MODIFY_ENTRIES_STATUS, params: { eventId, participantIds, entryStatus } },
  ]);
  expect(result.success).toEqual(true);
}

describe('entries table "#" column and alternates order', () => {
  it('lists alternates by entryPosition and shows each entry its own position', () => {
    const eventId = setup();
    const rows = displayRows(eventId);
    const alternates = segment(rows, ALTERNATES_RANK);
    expect(alternates.length).toEqual(4);

    // every row shows the position the record holds, never a row number
    for (const row of rows) expect(entryPositionLabel(row)).toEqual(String(row.entryPosition));
    expect(alternates.map(entryPositionLabel)).toEqual(['1', '2', '3', '4']);
    expect(hasEntryPositions(rows)).toEqual(true);
  });

  it('keeps alternates in entryPosition order through modifyEntriesStatus moves', () => {
    const eventId = setup();
    const before = displayRows(eventId);
    const [firstAccepted, secondAccepted] = segment(before, ACCEPTED_RANK);
    const [firstAlternate] = segment(before, ALTERNATES_RANK);

    // two accepted entries become alternates, the first alternate is accepted
    modifyEntriesStatus(eventId, [firstAccepted.participantId, secondAccepted.participantId], ALTERNATE);
    modifyEntriesStatus(eventId, [firstAlternate.participantId], DIRECT_ACCEPTANCE);

    const rows = displayRows(eventId);
    const alternates = segment(rows, ALTERNATES_RANK);
    expect(alternates.length).toEqual(5);
    expect(alternates.map((row) => row.participantId)).not.toContain(firstAlternate.participantId);
    expect(alternates.map((row) => row.participantId)).toEqual(
      expect.arrayContaining([firstAccepted.participantId, secondAccepted.participantId]),
    );

    // Displayed faithfully: whatever numbering the factory applied, the list reads in ascending position
    // and each "#" is the entry's own entryPosition. The factory numbers each status group 1..n.
    const positions = alternates.map((row) => row.entryPosition);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(alternates.map(entryPositionLabel)).toEqual(positions.map(String));
    expect(positions).toEqual([1, 2, 3, 4, 5]);

    // the accepted segment keeps array order by default; its "#" is still each entry's position
    const accepted = segment(rows, ACCEPTED_RANK);
    expect(accepted.every((row) => STRUCTURE_SELECTED_STATUSES.includes(row.entryStatus))).toEqual(true);
    expect(accepted.map((row) => row._entryIndex)).toEqual(
      [...accepted.map((row) => row._entryIndex)].sort((a, b) => a - b),
    );
    for (const row of accepted) expect(entryPositionLabel(row)).toEqual(String(row.entryPosition));
  });

  it('puts alternates without a position after the positioned ones, in array order', () => {
    const rows = withEntryIndex(
      withSegmentRanks([
        { participantId: 'n1', entryStatus: ALTERNATE },
        { participantId: 'p2', entryStatus: ALTERNATE, entryPosition: 2 },
        { participantId: 'n2', entryStatus: ALTERNATE },
        { participantId: 'p1', entryStatus: ALTERNATE, entryPosition: 1 },
      ]),
    ).sort((a, b) => compareSegmentRows(a, b, defaultSort));
    expect(rows.map((row) => row.participantId)).toEqual(['p1', 'p2', 'n1', 'n2']);
    expect(rows.map(entryPositionLabel)).toEqual(['1', '2', '', '']);
  });

  it('sorts every segment by position when the "#" header is chosen, and leaves virtual rows blank', () => {
    const sortState: SortState = { secondaryField: 'entryPosition', secondaryDir: 'desc' };
    const rows = withEntryIndex(
      withSegmentRanks([
        { participantId: 'a1', entryStatus: DIRECT_ACCEPTANCE, entryPosition: 1 },
        { participantId: 'a2', entryStatus: DIRECT_ACCEPTANCE, entryPosition: 2 },
        { participantId: 'x', entryStatus: ALTERNATE, entryPosition: 1 },
      ]),
    ).sort((a, b) => compareSegmentRows(a, b, sortState));
    expect(rows.map((row) => row.participantId)).toEqual(['a2', 'a1', 'x']);

    expect(entryPositionLabel({ entryPosition: 3, _grouped: true })).toEqual('');
    expect(entryPositionLabel({ entryPosition: 3, _eventOnly: true })).toEqual('');
    expect(hasEntryPositions([{ participantId: 'y' }])).toEqual(false);
  });

  it('numbers each accepted status within itself, in entryPosition order (e.g. "WC 2")', () => {
    const eventId = setup();
    const [, second, , fourth] = segment(displayRows(eventId), ACCEPTED_RANK);
    modifyEntriesStatus(eventId, [fourth.participantId, second.participantId], WILDCARD);

    const accepted = segment(withStatusOrdinals(displayRows(eventId)), ACCEPTED_RANK);
    const wildcards = accepted
      .filter((row) => row.entryStatus === WILDCARD)
      .sort((a, b) => a.entryPosition - b.entryPosition);
    expect(wildcards.map((row) => row._statusOrdinal)).toEqual([1, 2]);
    const directs = accepted
      .filter((row) => row.entryStatus === DIRECT_ACCEPTANCE)
      .sort((a, b) => a.entryPosition - b.entryPosition);
    expect(directs.map((row) => row._statusOrdinal)).toEqual([1, 2, 3, 4, 5, 6]);
    // the "#" column still shows the record's entryPosition, whichever numbering the factory applied
    for (const row of accepted) expect(entryPositionLabel(row)).toEqual(String(row.entryPosition));
    // alternates are not an accepted status: no ordinal
    expect(
      segment(withStatusOrdinals(displayRows(eventId)), ALTERNATES_RANK).some((row) => row._statusOrdinal),
    ).toEqual(false);
  });
});

describe('entries table "#" badge: group tint, words and no duplicated number', () => {
  it('classifies every entry by its group and names the group and position in words', () => {
    const eventId = setup();
    const qualifierId = 'qualifier1';
    const qualifier = {
      participantId: qualifierId,
      participantType: 'INDIVIDUAL',
      participantRole: 'COMPETITOR',
      person: { standardGivenName: 'Quinn', standardFamilyName: 'Qualifier' },
    };
    const result = tournamentEngine.executionQueue([
      { method: ADD_PARTICIPANTS, params: { participants: [qualifier] } },
      { method: ADD_EVENT_ENTRIES, params: { eventId, participantIds: [qualifierId], entryStage: QUALIFYING } },
    ]);
    expect(result.success).toEqual(true);
    const [, , last] = segment(displayRows(eventId), ALTERNATES_RANK);
    modifyEntriesStatus(eventId, [last.participantId], WITHDRAWN);

    const rows = withStatusOrdinals(displayRows(eventId));
    const groupOf = (rank: number) => [...new Set(segment(rows, rank).map(entryPositionGroup))];
    expect(groupOf(ACCEPTED_RANK)).toEqual(['accepted']);
    expect(groupOf(1)).toEqual(['qualifying']);
    expect(groupOf(ALTERNATES_RANK)).toEqual(['alternate']);
    expect(groupOf(4)).toEqual(['withdrawn']);

    const words: Record<string, string> = {
      accepted: 'Accepted',
      qualifying: 'Qualifying',
      alternate: 'Alternate',
      withdrawn: 'Withdrawn',
    };
    for (const row of rows) {
      const badge = entryPositionBadge(row);
      expect(badge?.text).toEqual(String(row.entryPosition));
      expect(badge?.group).toEqual(entryPositionGroup(row));
      expect(badge?.tooltip).toEqual(`${words[badge?.group ?? '']} #${row.entryPosition}`);
    }
  });

  it('tells "#n accepted" from "#n alternate" when the two positions are equal', () => {
    const eventId = setup();
    const rows = displayRows(eventId);
    const accepted = segment(rows, ACCEPTED_RANK).find((row) => row.entryPosition === 1);
    const alternate = segment(rows, ALTERNATES_RANK).find((row) => row.entryPosition === 1);
    const a = entryPositionBadge(accepted);
    const b = entryPositionBadge(alternate);
    expect(a?.text).toEqual(b?.text);
    expect(a?.group).not.toEqual(b?.group);
    expect(a?.tooltip).not.toEqual(b?.tooltip);
  });

  it('adds the status ordinal to the words only, never a second number on the badge', () => {
    const eventId = setup();
    const [, second, , fourth] = segment(displayRows(eventId), ACCEPTED_RANK);
    modifyEntriesStatus(eventId, [fourth.participantId, second.participantId], WILDCARD);

    const accepted = segment(withStatusOrdinals(displayRows(eventId)), ACCEPTED_RANK);
    const wildcards = accepted
      .filter((row) => row.entryStatus === WILDCARD)
      .sort((a, b) => a.entryPosition - b.entryPosition);
    expect(wildcards.length).toEqual(2);
    wildcards.forEach((row, index) => {
      const badge = entryPositionBadge(row);
      expect(badge?.text).toEqual(String(row.entryPosition));
      expect(badge?.tooltip).toEqual(`Accepted #${row.entryPosition} · Wildcard ${index + 1}`);
    });
    // a plain direct acceptance carries no status chip, so its words carry no ordinal
    const direct = accepted.find((row) => row.entryStatus === DIRECT_ACCEPTANCE);
    expect(entryPositionBadge(direct)?.tooltip).toEqual(`Accepted #${direct?.entryPosition}`);
  });

  it('puts Ungrouped and unknown statuses in "other", and gives virtual or unpositioned rows no badge', () => {
    const [ungrouped, unknown] = withSegmentRanks([
      { participantId: 'u', entryStatus: UNGROUPED, entryPosition: 2 },
      { participantId: 'k', entryStatus: 'SOMETHING_ELSE', entryPosition: 4 },
    ]);
    expect(entryPositionBadge(ungrouped)).toEqual({ group: 'other', text: '2', tooltip: 'Ungrouped #2' });
    expect(entryPositionBadge(unknown)).toEqual({ group: 'other', text: '4', tooltip: 'Position #4' });

    expect(entryPositionBadge({ entryPosition: 3, _segmentRank: 0, _grouped: true })).toBeNull();
    expect(entryPositionBadge({ entryPosition: 3, _segmentRank: 0, _eventOnly: true })).toBeNull();
    expect(entryPositionBadge({ participantId: 'y', _segmentRank: 0 })).toBeNull();
  });
});
