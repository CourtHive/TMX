/**
 * The validator TMX ships is compiled at build time (ajv standalone, see `precompiledSchemaValidator` in
 * vite.shared.ts). It must report exactly what ajv's runtime compile of the same schema, with the same options,
 * reports: otherwise precompiling would have changed what the post-import check finds.
 */
import schema from 'tods-competition-factory/schema/tournament.schema.json';
import precompiled from 'virtual:tournament-schema-validator';
import { mocksEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';

function runtimeValidator() {
  const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function mockRecord() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 8 }, { drawSize: 4, eventType: 'DOUBLES' }],
    participantsProfile: { scaledParticipantsCount: 8 },
    venueProfiles: [{ courtsCount: 2 }],
    completeAllMatchUps: true,
  });
  return structuredClone(tournamentRecord);
}

const errorsOf = (validate: any, record: any) => {
  validate(record);
  return (validate.errors ?? []).map(({ instancePath, keyword, message, params }: any) => ({
    instancePath,
    keyword,
    message,
    params,
  }));
};

describe('precompiled schema validator', () => {
  const runtime = runtimeValidator();

  it('accepts a valid record, as the runtime compile does', () => {
    const record = mockRecord();
    expect(precompiled(record)).toEqual(true);
    expect(runtime(record)).toEqual(true);
  });

  it('reports the same errors as the runtime compile for broken enums, types, formats and required fields', () => {
    const record: any = mockRecord();
    record.indoorOutdoor = 'SIDEWAYS';
    record.events[0].eventType = 'NOT_AN_EVENT_TYPE';
    record.events[0].drawDefinitions[0].structures[0].matchUps[0].matchUpStatus = 42;
    record.participants[0].person.birthDate = 'not-a-date';
    delete record.participants[1].participantId;
    record.venues[0].courts[0].courtDimensions = ['wide'];

    const expected = errorsOf(runtime, record);
    expect(expected.length).toBeGreaterThanOrEqual(5);
    expect(errorsOf(precompiled, record)).toEqual(expected);
  });
});
