import { defined } from 'functions/testing/defined';
import {
  summarizeRecordValidation,
  formatFinding,
  isValidationIncomplete,
  DEFAULT_PREVIEW_COUNT,
} from './recordValidationSummary';
import { validateTournamentRecord } from './validateTournamentRecord';
import { validateAgainstSchema } from './schemaValidator';
import { mocksEngine, version } from 'tods-competition-factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The factory's module namespace is not configurable under ESM, so `vi.spyOn(tournamentGovernor, …)` fails against a
// real install. Replace the governor with a copy whose getTournamentInconsistencies a test can override.
const inconsistencies = vi.hoisted(() => ({ override: undefined as undefined | ((...args: any[]) => any) }));
vi.mock('tods-competition-factory', async (importOriginal) => {
  const factory: any = await importOriginal();
  const governor = factory.tournamentGovernor;
  return {
    ...factory,
    tournamentGovernor: {
      ...governor,
      getTournamentInconsistencies: (...args: any[]) =>
        (inconsistencies.override ?? governor.getTournamentInconsistencies)(...args),
    },
  };
});

function mockRecord() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 8 }, { drawSize: 4, eventType: 'DOUBLES' }],
    venueProfiles: [{ courtsCount: 2 }],
    completeAllMatchUps: true,
    setState: true,
  });
  return structuredClone(tournamentRecord);
}

describe('record validation (real ajv + real factory engine)', () => {
  it('a valid mocksEngine record yields no findings', async () => {
    const summary = await validateTournamentRecord({ tournamentRecord: mockRecord() });
    expect(summary.schemaUnavailable).toBeUndefined();
    expect(summary.count).toEqual(0);
    expect(summary.findings).toEqual([]);
    expect(summary.text).toEqual('');
  });

  it('a bad enum value yields a schema error at its instancePath', async () => {
    const tournamentRecord = mockRecord();
    // values the types rule out, written as a record edited outside the engine would carry them
    Object.assign(defined(tournamentRecord.events)[0], { eventType: 'NOT_AN_EVENT_TYPE' });
    Object.assign(tournamentRecord, { indoorOutdoor: 'SIDEWAYS' });

    const { schemaErrors } = await validateAgainstSchema(tournamentRecord);
    const paths = schemaErrors.map((error) => error.instancePath);
    expect(paths).toContain('/events/0/eventType');
    expect(paths).toContain('/indoorOutdoor');
    const enumError = schemaErrors.find((error) => error.instancePath === '/events/0/eventType');
    expect(enumError?.keyword).toEqual('enum');
    expect(enumError?.message).toMatch(/allowed values/);

    const summary = await validateTournamentRecord({ tournamentRecord });
    expect(summary.schemaErrorCount).toEqual(schemaErrors.length);
    expect(summary.count).toBeGreaterThanOrEqual(2);
    expect(summary.findings.every((finding) => finding.source === 'schema')).toEqual(true);
  });

  it("includes the factory's getTournamentInconsistencies findings in the same summary", async () => {
    const tournamentRecord = mockRecord();
    // an event that starts before the tournament: schema-valid, but an integrity finding
    defined(tournamentRecord.events)[0].startDate = '1999-01-01';

    const summary = await validateTournamentRecord({ tournamentRecord });
    expect(summary.schemaErrorCount).toEqual(0);
    const integrity = summary.findings.filter((finding) => finding.source === 'integrity');
    expect(integrity.map((finding) => finding.issueType)).toContain('EVENT_DATES_OUTSIDE_TOURNAMENT');
    expect(integrity[0].path).toContain(`event ${defined(tournamentRecord.events)[0].eventId}`);
    expect(summary.inconsistencyCount).toEqual(integrity.length);
  });

  // factory 7.29.0: getTournamentInconsistencies reads every stored matchUpFormat, so the import warning list shows a
  // malformed code as an error and a code refused for new use as a warning, each naming where it is stored
  it('lists a malformed matchUpFormat as an integrity error, naming the code and where it is stored', async () => {
    const tournamentRecord = mockRecord();
    defined(tournamentRecord.events)[0].matchUpFormat = 'NOT-A-FORMAT';

    const summary = await validateTournamentRecord({ tournamentRecord });
    const finding = summary.findings.find((finding) => finding.issueType === 'MATCHUP_FORMAT_MALFORMED');
    expect(finding).toMatchObject({ source: 'integrity', severity: 'error' });
    expect(finding?.path).toContain(`event ${defined(tournamentRecord.events)[0].eventId}`);
    expect(finding?.message).toContain('NOT-A-FORMAT (tournamentRecord.events[0].matchUpFormat)');
    expect(summary.text).toContain('[error] MATCHUP_FORMAT_MALFORMED');
  });

  it('lists a matchUpFormat refused for new use as an integrity warning', async () => {
    const tournamentRecord = mockRecord();
    // well-formed, but an implicit best-of with an even count is refused when a format is set now
    defined(tournamentRecord.events)[0].matchUpFormat = 'SET2-S:6/TB7';

    const summary = await validateTournamentRecord({ tournamentRecord });
    const finding = summary.findings.find((finding) => finding.issueType === 'MATCHUP_FORMAT_REFUSED_FOR_NEW_USE');
    expect(finding).toMatchObject({ source: 'integrity', severity: 'warning' });
    expect(finding?.message).toContain('SET2-S:6/TB7');
    expect(summary.findings.some((finding) => finding.issueType === 'MATCHUP_FORMAT_MALFORMED')).toEqual(false);
  });

  it('reuses one compiled validator across calls', async () => {
    const { loadSchemaValidator } = await import('./schemaValidator');
    expect(await loadSchemaValidator()).toBe(await loadSchemaValidator());
  });
});

describe('an integrity check that could not run is not a clean record', () => {
  afterEach(() => {
    inconsistencies.override = undefined;
    vi.restoreAllMocks();
  });

  it('a clean record is fully checked: neither unavailable flag is set', async () => {
    const summary = await validateTournamentRecord({ tournamentRecord: mockRecord() });
    expect(summary.count).toEqual(0);
    expect(summary.integrityUnavailable).toBeUndefined();
    expect(summary.schemaUnavailable).toBeUndefined();
    expect(summary.factoryVersion).toEqual(version());
  });

  it('flags integrityUnavailable with the reason when getTournamentInconsistencies throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    inconsistencies.override = () => {
      throw new Error('engine exploded');
    };

    const summary = await validateTournamentRecord({ tournamentRecord: mockRecord() });
    expect(summary.count).toEqual(0);
    expect(summary.integrityUnavailable).toEqual(true);
    expect(summary.integrityUnavailableReason).toEqual('engine exploded');
    expect(summary.factoryVersion).toEqual(version());
    expect(warn).toHaveBeenCalled();
  });

  it('flags integrityUnavailable when getTournamentInconsistencies returns { error }', async () => {
    inconsistencies.override = () =>
      ({
        error: { message: 'Missing tournamentRecord', code: 'ERR_MISSING_TOURNAMENT' },
      }) as any;

    const summary = await validateTournamentRecord({ tournamentRecord: mockRecord() });
    expect(summary.count).toEqual(0);
    expect(summary.integrityUnavailable).toEqual(true);
    expect(summary.integrityUnavailableReason).toEqual('Missing tournamentRecord');
  });

  it('still reports schema errors when the integrity check is unavailable', async () => {
    inconsistencies.override = () => ({ error: 'nope' });
    const tournamentRecord = mockRecord();
    // a value the type rules out, written as a record edited outside the engine would carry it
    Object.assign(tournamentRecord, { indoorOutdoor: 'SIDEWAYS' });

    const summary = await validateTournamentRecord({ tournamentRecord });
    expect(summary.schemaErrorCount).toBeGreaterThan(0);
    expect(summary.integrityUnavailable).toEqual(true);
    expect(summary.integrityUnavailableReason).toEqual('nope');
  });
});

describe('summarizeRecordValidation', () => {
  const schemaErrors = Array.from({ length: 7 }, (_, index) => ({
    instancePath: `/participants/${index}/participantRole`,
    message: 'must be equal to one of the allowed values',
  }));
  const inconsistencies = [
    { issueType: 'NOTE_ONLY', message: 'an advisory', severity: 'info', scope: 'TOURNAMENT' },
    { issueType: 'EVENT_DATES_OUTSIDE_TOURNAMENT', message: 'outside', severity: 'warning', eventId: 'e1' },
  ];

  it('counts both sources, previews the first few and keeps every finding in the copy text', () => {
    const summary = summarizeRecordValidation({ schemaErrors, inconsistencies });
    expect(summary.count).toEqual(9);
    expect(summary.schemaErrorCount).toEqual(7);
    expect(summary.inconsistencyCount).toEqual(2);
    expect(summary.preview).toHaveLength(DEFAULT_PREVIEW_COUNT);
    expect(summary.preview[0].path).toEqual('/participants/0/participantRole');
    expect(summary.text.split('\n')).toHaveLength(9);
    // integrity findings follow the schema errors, warnings before notes
    expect(summary.findings.slice(7).map((finding) => finding.issueType)).toEqual([
      'EVENT_DATES_OUTSIDE_TOURNAMENT',
      'NOTE_ONLY',
    ]);
    expect(formatFinding(summary.findings[7])).toEqual('[warning] EVENT_DATES_OUTSIDE_TOURNAMENT event e1: outside');
    expect(formatFinding(summary.findings[0])).toEqual(
      '[error] /participants/0/participantRole: must be equal to one of the allowed values',
    );
  });

  it('is empty for no findings', () => {
    expect(summarizeRecordValidation({})).toMatchObject({ count: 0, preview: [], text: '' });
  });

  it('carries the unavailable flags, and only carries a reason alongside integrityUnavailable', () => {
    const unavailable = summarizeRecordValidation({ integrityUnavailable: true, integrityUnavailableReason: 'x' });
    expect(unavailable).toMatchObject({ count: 0, integrityUnavailable: true, integrityUnavailableReason: 'x' });
    expect(isValidationIncomplete(unavailable)).toEqual(true);
    expect(isValidationIncomplete(summarizeRecordValidation({ schemaUnavailable: true }))).toEqual(true);

    const clean = summarizeRecordValidation({ integrityUnavailableReason: 'ignored' });
    expect(clean.integrityUnavailableReason).toBeUndefined();
    expect(isValidationIncomplete(clean)).toEqual(false);
  });
});
