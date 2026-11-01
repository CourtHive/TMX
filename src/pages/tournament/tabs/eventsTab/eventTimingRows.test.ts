import { expectedAverageMinutes } from 'pages/tournament/tabs/scheduleViews/matchUpExpectedMinutes';
import { mocksEngine, version as factoryVersion } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addedTimingRow,
  buildTimingMethods,
  buildUseDefaultsMethod,
  customisedFormatCount,
  eventTimingRows,
} from './eventTimingRows';

// constants and types
import { MODIFY_EVENT_MATCHUP_FORMAT_TIMING, REMOVE_EVENT_MATCHUP_FORMAT_TIMING } from 'constants/mutationConstants';

const FORMAT = 'SET3-S:6/TB7';
const SHORT_SETS = 'SET3-S:4/TB7';
const EVENT_DEFAULT = 'SET1-S:6/TB7';
// the default scheduling policy's figures for FORMAT and SHORT_SETS in a JUNIOR SINGLES event
const POLICY = { averageMinutes: 90, recoveryMinutes: 60 };
const POLICY_SHORT_SETS = { averageMinutes: 60, recoveryMinutes: 60 };

function seed(eventProfiles: any[]): string[] {
  const { eventIds }: any = mocksEngine.generateTournamentRecord({ eventProfiles, setState: true });
  return eventIds;
}

const junior = (categoryName: string) => ({ categoryName, categoryType: 'JUNIOR' });

function seedSingles(): string[] {
  return seed([
    { eventName: 'U18', category: junior('U18'), drawProfiles: [{ drawSize: 4, matchUpFormat: FORMAT }] },
    { eventName: 'U16', category: junior('U16'), drawProfiles: [{ drawSize: 4, matchUpFormat: FORMAT }] },
  ]);
}

function send(methods: any[]) {
  let result: any = tournamentEngine.executionQueue(methods);
  expect(result.success).toBe(true);
  return result;
}

function save(eventId: string, edits: Record<string, any>) {
  const { methods, refusal } = buildTimingMethods({ eventId, rows: eventTimingRows({ eventId }), edits });
  expect(refusal).toBeUndefined();
  return send(methods);
}

describe('eventTimingRows', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it("lists the draw's format at the scheduling policy's timing", () => {
    const [eventId] = seedSingles();
    expect(eventTimingRows({ eventId })).toEqual([
      { matchUpFormat: FORMAT, uses: [{ kind: 'draw', name: expect.any(String) }], ...POLICY, override: false },
    ]);
  });

  it("lists the event's default ahead of its draws' formats", () => {
    const [eventId] = seedSingles();
    send([{ method: 'setMatchUpFormat', params: { eventId, matchUpFormat: EVENT_DEFAULT } }]);
    const rows = eventTimingRows({ eventId });
    expect(rows.map((row) => row.matchUpFormat)).toEqual([EVENT_DEFAULT, FORMAT]);
    expect(rows[0].uses).toEqual([{ kind: 'event' }]);
  });

  it("lists a TEAM event's collection formats", () => {
    const [eventId] = seed([
      { eventName: 'Team', eventType: 'TEAM', category: junior('U16'), drawProfiles: [{ drawSize: 4 }] },
    ]);
    const rows = eventTimingRows({ eventId });
    const { event }: any = tournamentEngine.getEvent({ eventId });
    const collectionFormats = event.tieFormat.collectionDefinitions.map((collection: any) => collection.matchUpFormat);
    expect(rows.map((row) => row.matchUpFormat)).toEqual([...new Set(collectionFormats)]);
    expect(rows.every((row) => row.uses.every((use) => use.kind === 'collection'))).toBe(true);
  });

  it('returns no rows for an unknown event', () => {
    seedSingles();
    expect(eventTimingRows({ eventId: 'missing' })).toEqual([]);
  });

  it("marks a saved row as the event's own, and leaves another event on the policy", () => {
    const [eventId, otherEventId] = seedSingles();
    save(eventId, { [FORMAT]: { averageMinutes: '75', recoveryMinutes: '30' } });
    expect(eventTimingRows({ eventId })[0]).toMatchObject({ averageMinutes: 75, recoveryMinutes: 30, override: true });
    expect(eventTimingRows({ eventId: otherEventId })[0]).toMatchObject({ ...POLICY, override: false });
    expect(customisedFormatCount(eventTimingRows({ eventId }))).toBe(1);
  });

  it("is what the schedule grid reads for the event's matchUps", () => {
    const [eventId] = seedSingles();
    save(eventId, { [FORMAT]: { averageMinutes: 75, recoveryMinutes: 30 } });
    const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const matchUp = matchUps.find((candidate: any) => candidate.eventId === eventId);
    expect(expectedAverageMinutes(matchUp)).toBe(75);
  });

  it('"Use the defaults" returns every format to the policy', () => {
    const [eventId] = seedSingles();
    save(eventId, { [FORMAT]: { averageMinutes: 75, recoveryMinutes: 30 } });
    const method = buildUseDefaultsMethod(eventId);
    expect(method).toEqual({ method: REMOVE_EVENT_MATCHUP_FORMAT_TIMING, params: { eventId } });
    send([method]);
    expect(eventTimingRows({ eventId })).toEqual([expect.objectContaining({ ...POLICY, override: false })]);
  });
});

describe('addedTimingRow', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it("opens a format not yet in use at the policy's timing for it", () => {
    const [eventId] = seedSingles();
    const { row, refusal } = addedTimingRow({ eventId, matchUpFormat: SHORT_SETS, rows: eventTimingRows({ eventId }) });
    expect(refusal).toBeUndefined();
    expect(row).toEqual({ matchUpFormat: SHORT_SETS, uses: [], ...POLICY_SHORT_SETS, override: false });
  });

  it('refuses a format already listed, and one the factory cannot read', () => {
    const [eventId] = seedSingles();
    const rows = eventTimingRows({ eventId });
    expect(addedTimingRow({ eventId, matchUpFormat: FORMAT, rows }).refusal).toBe('DUPLICATE_FORMAT');
    expect(addedTimingRow({ eventId, matchUpFormat: 'NOT-A-FORMAT', rows }).refusal).toBe('INVALID_FORMAT');
  });

  it('keeps an added format as a row once its timing is saved', () => {
    const [eventId] = seedSingles();
    const { row }: any = addedTimingRow({ eventId, matchUpFormat: SHORT_SETS, rows: eventTimingRows({ eventId }) });
    const rows = [...eventTimingRows({ eventId }), row];
    const { methods } = buildTimingMethods({
      edits: { [SHORT_SETS]: { averageMinutes: 50, recoveryMinutes: 45 } },
      eventId,
      rows,
    });
    send(methods);
    expect(eventTimingRows({ eventId }).map((saved) => [saved.matchUpFormat, saved.override])).toEqual([
      [FORMAT, false],
      [SHORT_SETS, true],
    ]);
  });
});

describe('buildTimingMethods', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it('sends one method per changed row, and nothing for a row left as it was', () => {
    const [eventId] = seedSingles();
    send([{ method: 'setMatchUpFormat', params: { eventId, matchUpFormat: EVENT_DEFAULT } }]);
    const rows = eventTimingRows({ eventId });
    const { methods } = buildTimingMethods({
      edits: {
        [EVENT_DEFAULT]: { averageMinutes: rows[0].averageMinutes, recoveryMinutes: rows[0].recoveryMinutes },
        [FORMAT]: { averageMinutes: '80', recoveryMinutes: '60' },
      },
      eventId,
      rows,
    });
    expect(methods).toEqual([
      {
        method: MODIFY_EVENT_MATCHUP_FORMAT_TIMING,
        params: { eventId, matchUpFormat: FORMAT, averageMinutes: 80, recoveryMinutes: 60 },
      },
    ]);
  });

  it('refuses an average that is not a whole number above zero', () => {
    const [eventId] = seedSingles();
    const rows = eventTimingRows({ eventId });
    for (const averageMinutes of ['0', '', '7.5', 'abc']) {
      const result = buildTimingMethods({
        eventId,
        rows,
        edits: { [FORMAT]: { averageMinutes, recoveryMinutes: 30 } },
      });
      expect(result).toEqual({ methods: [], refusal: 'INVALID_AVERAGE' });
    }
  });

  it('refuses a negative or missing recovery, and accepts zero', () => {
    const [eventId] = seedSingles();
    const rows = eventTimingRows({ eventId });
    const build = (recoveryMinutes: any) =>
      buildTimingMethods({ eventId, rows, edits: { [FORMAT]: { averageMinutes: 70, recoveryMinutes } } });
    expect(build('-5').refusal).toBe('INVALID_RECOVERY');
    expect(build('').refusal).toBe('INVALID_RECOVERY');
    expect(build('0').methods).toHaveLength(1);
  });
});

// Published factory 7.27.0 ignores an UNCATEGORIZED event's own timing in `getMatchUpFormatTiming` (the grid's and
// the schedulers' read), although `getEventMatchUpFormatTiming` reports it. Fixed in the release after 7.27.0; this
// runs once TMX resolves that release.
const [major, minor, patch] = String(factoryVersion).split('.').map(Number);
const uncategorizedFixed = major > 7 || (major === 7 && (minor > 27 || (minor === 27 && patch > 0)));

describe('an event without a category', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it.runIf(uncategorizedFixed)('has its own timing read by the schedule grid', () => {
    const [eventId] = seed([{ eventName: 'Open', drawProfiles: [{ drawSize: 4, matchUpFormat: FORMAT }] }]);
    save(eventId, { [FORMAT]: { averageMinutes: 75, recoveryMinutes: 30 } });
    expect(eventTimingRows({ eventId })[0]).toMatchObject({ averageMinutes: 75, override: true });
    const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const matchUp = matchUps.find((candidate: any) => candidate.eventId === eventId);
    expect(expectedAverageMinutes(matchUp)).toBe(75);
  });
});
