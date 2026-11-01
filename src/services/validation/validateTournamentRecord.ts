/**
 * Run both record checks: the CODES schema (lazy ajv) and the factory's
 * getTournamentInconsistencies. Never throws and never blocks a load: callers start it
 * after the record is in the engine and render whatever comes back.
 */
import { summarizeRecordValidation, type RecordValidationSummary } from './recordValidationSummary';
import { tournamentGovernor } from 'tods-competition-factory';
import { validateAgainstSchema } from './schemaValidator';

export async function validateTournamentRecord({
  tournamentRecord,
}: {
  tournamentRecord: any;
}): Promise<RecordValidationSummary> {
  // Integrity first and synchronously, so it reads the record as it was handed in.
  let inconsistencies: any[] = [];
  try {
    const result: any = tournamentGovernor.getTournamentInconsistencies({ tournamentRecord });
    inconsistencies = result?.inconsistencies ?? [];
  } catch (error) {
    console.warn('[validateTournamentRecord] getTournamentInconsistencies failed', error);
  }

  const { schemaErrors, unavailable } = await validateAgainstSchema(tournamentRecord);
  return summarizeRecordValidation({ schemaErrors, inconsistencies, schemaUnavailable: unavailable });
}
