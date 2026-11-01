import { summarizeRecordValidation, formatFinding, DEFAULT_PREVIEW_COUNT } from './recordValidationSummary';
import { validateTournamentRecord } from './validateTournamentRecord';
import { validateAgainstSchema } from './schemaValidator';
import { mocksEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

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
    tournamentRecord.events[0].eventType = 'NOT_AN_EVENT_TYPE';
    tournamentRecord.indoorOutdoor = 'SIDEWAYS';

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
    tournamentRecord.events[0].startDate = '1999-01-01';

    const summary = await validateTournamentRecord({ tournamentRecord });
    expect(summary.schemaErrorCount).toEqual(0);
    const integrity = summary.findings.filter((finding) => finding.source === 'integrity');
    expect(integrity.map((finding) => finding.issueType)).toContain('EVENT_DATES_OUTSIDE_TOURNAMENT');
    expect(integrity[0].path).toContain(`event ${tournamentRecord.events[0].eventId}`);
    expect(summary.inconsistencyCount).toEqual(integrity.length);
  });

  it('reuses one compiled validator across calls', async () => {
    const { loadSchemaValidator } = await import('./schemaValidator');
    expect(await loadSchemaValidator()).toBe(await loadSchemaValidator());
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
});
